/**
 * Is this still our desk, and does the ledger agree with the database? (Shijima `wake.ts` step 1 + `reconcile.ts`.)
 * Live (C8f, K-090): the `DeskMandate` is read; its holdings are priced at each Window's fair price on the venue's
 * ladder; an unknown send is settled by its update id or by the sealed hash in the desk's decisions (found by the
 * operator's deterministic command id); a Window that settled paid the owner's seat, so its lots leave the desk as an
 * outside change;
 * a chain ahead of the record is explained by sealed actions the record knows, or the desk stops for attention; a
 * held name whose account is frozen or whose mint is paused stops it too. Then balances are compared with the last
 * snapshot plus the desk's own confirmed actions: anything left over came from outside (the owner adding or taking
 * money) and moves the loss-limit baseline, never the loss. Practice: the paper ledger is the state.
 */
import { MIN_TRADE_E6 } from "@agari/core/desk";
import { PRE_IPO_SYMBOLS, type PreIpoSymbol } from "@agari/core/market";
import { isUpdateId } from "@agari/core/types";
import type { DeskRow } from "@agari/db";
import { deskStateOf, findLeasedMandate, lotPriceE8, mintOf, quotingWindow, readDeskEventsOf, readDeskHistory, sealedActionsOf, signatureOutcome, symbolOfMarket } from "@agari/markets/desk/server";
import type { DeskMandateC } from "@agari/markets/ops/agents";
import type { Ladder } from "@agari/markets/runtime";
import { errorText } from "../../runtime/env";
import { leasePartyOf } from "./lease";
import { loadPaper, paperPositions } from "./paper";
import type { DeskStanding, RunnerContext } from "./types";

/** A send whose deadline passed this long ago without any status can never land. */
const NEVER_LANDS_AFTER_SEC = 120;

export interface OutsideChange {
  /** `USDC` or a name. */
  asset: string;
  /** Positive arrived, negative left; base units. */
  delta: bigint;
  /** The same change in USDC E6 at the valuation price; not a real number when `priced` is false. */
  valueE6: bigint;
  priced: boolean;
}

export interface Reconciled {
  standing: DeskStanding;
  /** Why the desk needs attention, or null. */
  trouble: string | null;
  changes: OutsideChange[];
  /** Cash of at least one trade arrived from outside since the last snapshot: an event wake. */
  depositSeen: boolean;
  /**
   * Why this row is no longer its owner's desk (C4d, K-210): the owner holds no lease any more, so the seat's party may
   * already be the next visitor's. The wake closes the row and nothing is read, valued or traded.
   */
  ended?: string;
}

/** The owner of a live desk row no longer leases a seat: its party may be someone else's now. */
export const LEASE_ENDED = "the seat this desk belonged to was reset or passed on, so the desk is closed";

/** What the balances should be now: the last snapshot plus and minus the desk's own confirmed fills since it. */
export function findOutsideChanges(
  previous: { cashE6: bigint; positions: Record<string, bigint> },
  fillsSince: readonly { kind: string; symbol: string | null; amountIn: bigint; amountOut: bigint }[],
  current: { cashE6: bigint; positions: Record<string, bigint> },
  priceE8: Record<string, (raw: bigint) => bigint | null>,
): OutsideChange[] {
  const expected = { cashE6: previous.cashE6, positions: { ...previous.positions } };
  for (const f of fillsSince) {
    if (!f.symbol) continue;
    const held = expected.positions[f.symbol] ?? 0n;
    if (f.kind === "buy") {
      expected.cashE6 -= f.amountIn;
      expected.positions[f.symbol] = held + f.amountOut;
    } else if (f.kind === "sell") {
      expected.cashE6 += f.amountOut;
      expected.positions[f.symbol] = held - f.amountIn;
    }
  }
  const changes: OutsideChange[] = [];
  const cashDelta = current.cashE6 - expected.cashE6;
  if (cashDelta !== 0n) changes.push({ asset: "USDC", delta: cashDelta, valueE6: cashDelta, priced: true });
  for (const symbol of new Set([...Object.keys(expected.positions), ...Object.keys(current.positions)])) {
    const delta = (current.positions[symbol] ?? 0n) - (expected.positions[symbol] ?? 0n);
    if (delta === 0n) continue;
    const value = priceE8[symbol]?.(delta) ?? null;
    changes.push({ asset: symbol, delta, valueE6: value ?? 0n, priced: value !== null });
  }
  return changes;
}

export const netFlowE6 = (changes: readonly OutsideChange[]): bigint => changes.reduce((sum, c) => sum + c.valueE6, 0n);
export const allPriced = (changes: readonly OutsideChange[]): boolean => changes.every((c) => c.priced);

/**
 * Where the loss-limit baseline moves after money came in or went out: it SCALES, so the loss stays exactly where it
 * was. A first deposit, or a baseline of nothing, starts afresh at what the desk is worth now.
 */
export function scaledBaseline(baselineE6: bigint, totalNowE6: bigint, netFlowE6: bigint): bigint {
  if (netFlowE6 === 0n) return baselineE6;
  const before = totalNowE6 - netFlowE6;
  if (before <= 0n || baselineE6 <= 0n) return totalNowE6;
  return (baselineE6 * totalNowE6) / before;
}

/** Settles every action the runner sent without seeing confirmed, from the chain, never from memory. */
async function settleUnresolved(ctx: RunnerContext, desk: DeskRow, address: string, nowSec: number): Promise<{ stillUnknown: number; note: string[] }> {
  const rpc = ctx.rpc!;
  const note: string[] = [];
  let stillUnknown = 0;
  for (const a of await ctx.q.unresolvedActions(desk.id)) {
    const record = await ctx.q.getRecord({ deskId: desk.id, seq: a.recordSeq });
    const hash = record?.record.recordHash ?? null;
    const confirm = async (signature: string, chainSeq: bigint, head: string) => {
      await ctx.q.resolveAction({ id: a.id, state: "confirmed", signature, chainSeq: Number(chainSeq), nowSec });
      await ctx.q.markSealed({ deskId: desk.id, seq: a.recordSeq, signature, chainSeq: Number(chainSeq) });
      await ctx.q.setChainPosition({ deskId: desk.id, chainSeq: Number(chainSeq), chainHead: head, nowSec });
      note.push(`record ${a.recordSeq} landed in ${signature.slice(0, 8)}`);
    };
    try {
      if (a.signature && isUpdateId(a.signature)) {
        const fate = await signatureOutcome(rpc, a.signature);
        if (fate.kind === "confirmed") {
          const sealed = sealedActionsOf(await readDeskEventsOf(rpc, a.signature as never)).find((s) => hash && s.decisionHash.toLowerCase() === hash.toLowerCase());
          if (sealed) await confirm(a.signature, sealed.seq, sealed.head);
          else await ctx.q.resolveAction({ id: a.id, state: "confirmed", signature: a.signature, nowSec });
          continue;
        }
        if (fate.kind === "failed") {
          await ctx.q.resolveAction({ id: a.id, state: "reverted", error: "the chain recorded the transaction as failed", nowSec });
          continue;
        }
      } else if (hash) {
        // Died between signing and confirming: the sealed hash in the desk's own history is the receipt.
        const history = await readDeskHistory(rpc, address as never, { limit: 20 });
        const hit = history.flatMap((h) => sealedActionsOf(h.events).map((s) => ({ ...s, signature: h.signature }))).find((s) => s.decisionHash.toLowerCase() === hash.toLowerCase());
        if (hit) {
          await confirm(hit.signature, hit.seq, hit.head);
          continue;
        }
      }
      if (a.deadlineSec !== null && nowSec > a.deadlineSec + NEVER_LANDS_AFTER_SEC) {
        await ctx.q.resolveAction({ id: a.id, state: "refused", error: "never landed: its deadline passed with no trace on chain", nowSec });
        note.push(`record ${a.recordSeq} never landed`);
        continue;
      }
      stillUnknown += 1;
    } catch (error) {
      stillUnknown += 1;
      note.push(`record ${a.recordSeq} still unknown: ${errorText(error)}`);
    }
  }
  return { stillUnknown, note };
}

/**
 * Each name's lot price: the value-weighted fair price of the Windows the desk holds (every one must be quoting), or
 * the current Window's fair price when it holds none (the needs size with it).
 */
export function lotPrices(m: DeskMandateC, ladders: readonly Ladder[], nowSec: number): Record<string, { priceE8: bigint | null; why?: string }> {
  const byMarket = new Map(ladders.filter((l) => l.state === "quoting").map((l) => [l.damlMarketId, l]));
  const out: Record<string, { priceE8: bigint | null; why?: string }> = {};
  for (const symbol of PRE_IPO_SYMBOLS) {
    const held = m.holdings.filter((h) => h.side === "SideUp" && h.refundAfterSec > nowSec && symbolOfMarket(h.marketId) === symbol);
    if (held.length === 0) {
      const w = quotingWindow(ladders, symbol);
      out[symbol] = w && w.fairTicks ? { priceE8: lotPriceE8(w.fairTicks, w.cashUnit) } : { priceE8: null, why: "no Window of this company is quoting" };
      continue;
    }
    let lots = 0n;
    let valueE8 = 0n;
    let closed = false;
    for (const h of held) {
      const l = byMarket.get(h.marketId);
      if (!l || !l.fairTicks) {
        closed = true;
        break;
      }
      lots += h.lots;
      valueE8 += h.lots * lotPriceE8(l.fairTicks, l.cashUnit);
    }
    out[symbol] = closed || lots === 0n ? { priceE8: null, why: "its Window is closed and settling into your seat" } : { priceE8: valueE8 / lots };
  }
  return out;
}

async function reconcileLive(ctx: RunnerContext, desk: DeskRow, nowSec: number, say: (line: string) => void): Promise<Reconciled> {
  if (!ctx.rpc?.ledger || !desk.address) throw new Error("no ledger reader to read the desk with");
  // Only the row owner's CURRENT lease party's mandate, at the row's address (K-210): never the next visitor's desk.
  const party = await (ctx.leasePartyOf ?? leasePartyOf)(desk.owner);
  if (!party) return { standing: { kind: "practice", positions: {}, cashE6: 0n }, trouble: null, changes: [], depositSeen: false, ended: LEASE_ENDED };
  const found = await findLeasedMandate(ctx.rpc.ledger, { party, address: desk.address });
  if (!found) throw new Error("the desk's mandate was not found on the ledger (closed, or never opened)");
  const indexMode = desk.mode === "ask_first" || desk.mode === "on_its_own" ? desk.mode : null;
  const chain = deskStateOf({ mandate: found.data, offset: found.offset, nowSec, mintOf, marks: found.marks.filter((mk) => mk.venue === found.data.venue), indexMode });
  const positions: Record<string, bigint> = {};
  const frozen: Record<string, boolean> = {};
  for (const t of chain.tokens) {
    if (!t.symbol) continue;
    positions[t.symbol] = t.raw;
    frozen[t.symbol] = t.frozen;
  }
  const ladders = await ctx.ladders().catch(() => [] as readonly Ladder[]);
  const standing: DeskStanding = { kind: "live", chain, positions, frozen, cashE6: chain.usdc.raw, prices: lotPrices(found.data, ladders, nowSec) };
  const settled = await settleUnresolved(ctx, desk, chain.address, nowSec);
  for (const line of settled.note) say(line);
  if (settled.stillUnknown === 0) ctx.holding.delete(desk.id);
  else ctx.holding.add(desk.id);

  let trouble: string | null = null;
  if (ctx.operator && chain.operator !== ctx.operator.address) trouble = chain.operator ? "the desk names a different operator" : "you revoked the operator";
  if (!trouble && !ctx.operator && !chain.operator) trouble = "you revoked the operator";
  const known = (await ctx.q.getDeskById(desk.id))?.chainSeq ?? desk.chainSeq;
  const chainSeq = Number(chain.seq);
  if (!trouble && chainSeq > known) {
    // Every sealed action between the record's position and the chain's must be one this desk wrote.
    const history = await readDeskHistory(ctx.rpc, chain.address, { limit: 50 });
    const sealed = history.flatMap((h) => sealedActionsOf(h.events).map((s) => ({ ...s, signature: h.signature }))).filter((s) => Number(s.seq) > known && Number(s.seq) <= chainSeq);
    const explained = sealed.length === chainSeq - known && (await Promise.all(sealed.map(async (s) => ({ s, seq: await ctx.q.recordSeqByHash({ deskId: desk.id, hash: s.decisionHash }) })))).every(({ seq }) => seq !== null);
    if (explained) {
      for (const s of sealed) {
        const seq = await ctx.q.recordSeqByHash({ deskId: desk.id, hash: s.decisionHash });
        if (seq !== null) await ctx.q.markSealed({ deskId: desk.id, seq, signature: s.signature, chainSeq: Number(s.seq) });
      }
      await ctx.q.setChainPosition({ deskId: desk.id, chainSeq, chainHead: chain.head, nowSec });
      say(`chain at ${chainSeq}, record caught up from ${known}`);
    } else trouble = `the chain is at ${chainSeq} and the record at ${known}: ${chainSeq - known} action(s) this desk cannot explain`;
  } else if (!trouble && chainSeq < known) trouble = `the chain is at ${chainSeq}, behind the record at ${known}`;
  return { standing, trouble, ...(await outsideChanges(ctx, desk, standing, nowSec)) };
}

async function reconcilePractice(ctx: RunnerContext, desk: DeskRow, nowSec: number): Promise<Reconciled> {
  const ledger = await loadPaper(ctx.q, desk.id);
  if (!ledger) throw new Error("the practice desk has no paper ledger");
  const standing: DeskStanding = { kind: "practice", positions: paperPositions(ledger), cashE6: ledger.cashE6 };
  return { standing, trouble: null, ...(await outsideChanges(ctx, desk, standing, nowSec)) };
}

/** Balances against the last snapshot plus the desk's own fills since; the price of a name is its last snapshot price. */
async function outsideChanges(ctx: RunnerContext, desk: DeskRow, standing: DeskStanding, nowSec: number): Promise<{ changes: OutsideChange[]; depositSeen: boolean }> {
  const previous = await ctx.q.latestSnapshot(desk.id);
  if (!previous) return { changes: [], depositSeen: standing.cashE6 >= MIN_TRADE_E6 && desk.createdAtSec < nowSec - 60 };
  const fills = (await ctx.q.confirmedActionsSince({ deskId: desk.id, sinceSec: previous.takenAtSec })).map((a) => ({ kind: a.kind, symbol: a.symbol, amountIn: BigInt(a.amountIn ?? "0"), amountOut: BigInt(a.amountOut ?? a.expectedOut ?? "0") }));
  const priceOf: Record<string, (raw: bigint) => bigint | null> = {};
  for (const h of previous.holdings) {
    const price = BigInt(h.priceE8);
    const raw = BigInt(h.raw);
    priceOf[h.symbol] = (delta) => (price > 0n && raw > 0n ? (delta * BigInt(h.valueE6)) / raw : null);
  }
  const changes = findOutsideChanges(
    { cashE6: BigInt(previous.usdcE6), positions: Object.fromEntries(previous.holdings.map((h) => [h.symbol, BigInt(h.raw)])) },
    fills,
    { cashE6: standing.cashE6, positions: standing.positions },
    priceOf,
  );
  const cash = changes.find((c) => c.asset === "USDC");
  return { changes, depositSeen: Boolean(cash && cash.delta >= MIN_TRADE_E6) };
}

export async function reconcile(ctx: RunnerContext, desk: DeskRow, nowSec: number, say: (line: string) => void): Promise<Reconciled> {
  return desk.mode === "practice" || !desk.address ? reconcilePractice(ctx, desk, nowSec) : reconcileLive(ctx, desk, nowSec, say);
}

export const symbolsHeld = (standing: DeskStanding): PreIpoSymbol[] => (Object.keys(standing.positions) as PreIpoSymbol[]).filter((s) => (standing.positions[s] ?? 0n) > 0n);
