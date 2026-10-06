/**
 * `POST /internal/tickets/earn` (C8c): a provider's supply (`Nav_IssueSupply`, priced from the live statement) or
 * withdrawal (`Earn_IssueWithdraw`, paid only from the reserve's liquid cash) on one ticket reserve, as a firm quote the
 * seat alone accepts. Both run on the reserve's queue, since each reads its one live statement.
 */
import { randomUUID } from "node:crypto";
import { TEMPLATE_IDS } from "@agari/daml";
import { diagnosis } from "@agari/core/types";
import { decodeSupplyQuote, decodeWithdrawQuote, tcmd } from "@agari/markets/ops/tickets";
import { earnRequestWire } from "@agari/markets/server";
import { createdOne, type Desk } from "./desk";
import { handleMakerEarn } from "../maker-vault/earn";
import { DeskRefusal, failed, isAnswer, lease, nowSec, onReserve, refused, reply, seatOf, split, type Answer } from "./common";
import { venueModeRefusalNow } from "../../runtime/venue-mode";

export const LIQUIDITY_QUOTE_LIFE_SEC = 30;

export async function handleEarn(d: Desk, body: unknown): Promise<Answer> {
  const parts = split(body);
  if (!parts) return { status: 400, body: { diagnosis: diagnosis("unknown", "body must be an object") } };
  const parsed = earnRequestWire.safeParse(parts.rest);
  if (!parsed.success) return { status: 400, body: { diagnosis: diagnosis("unknown", `bad earn request: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`) } };
  const req = parsed.data;
  const seat = seatOf(d, parts.seat);
  if (isAnswer(seat)) return seat;
  // abu-pm-main 0.5.0 (K-200): the maker vault is its own book, not a ticket reserve.
  if (req.reserve === "maker") {
    if (!d.maker || !d.deskCid) return refused("not-deployed", "no maker vault in this ops process");
    return handleMakerEarn(d.maker, req, seat, d.deskCid);
  }
  if (req.op !== "supply" && req.op !== "withdraw") return refused("unknown", "merge and settle are the maker vault's");
  const reserve = req.reserve;
  const validUntilSec = nowSec() + LIQUIDITY_QUOTE_LIFE_SEC;
  const requestId = randomUUID();
  if (req.op === "supply") {
    if (req.amountBase <= 0n) return refused("below-min-quantity", "supply must be positive");
    // C-DAML-02: new supply asks the venue mode; a withdrawal (below) never does.
    const modeWhy = venueModeRefusalNow("supply");
    if (modeWhy) return refused("market-not-trading", modeWhy);
    try {
      const out = await onReserve(d, reserve, [], ({ navCid }) => ({ commandId: `earn:supply:${requestId}`, commands: [tcmd.issueSupply(navCid, { provider: seat.party, cashIn: req.amountBase, validUntilSec })] }));
      if (out.kind === "dry") return refused("not-deployed", `DRY RUN: ${out.note}`);
      const q = createdOne(out, TEMPLATE_IDS.SupplyQuote, decodeSupplyQuote);
      if (!q) return refused("unknown", "the issue landed without a supply quote");
      d.log(`earn ${reserve} supply ${q.data.cashIn} → ${q.data.sharesOut} shares for ${seat.party.split("::")[0]}`);
      return reply({ kind: "supply-quote", quoteCid: q.cid, cashIn: q.data.cashIn, sharesOut: q.data.sharesOut, validUntilMs: validUntilSec * 1000 });
    } catch (error) {
      return failed(d, `earn supply ${requestId}`, error);
    }
  }
  const snap = await d.refresh();
  const shares = snap.lpShares.filter((s) => s.data.provider === seat.party && s.data.reserveId === reserve).sort((a, b) => (a.data.shares > b.data.shares ? -1 : 1));
  const share = shares[0];
  if (!share) return refused("insufficient-collateral", `this seat holds no ${reserve} reserve shares`);
  if (req.shares <= 0n || req.shares > share.data.shares) {
    return refused("insufficient-collateral", shares.length > 1 ? `withdraw at most ${share.data.shares} shares at once (merge the seat's shares first)` : `this seat holds ${share.data.shares} shares`);
  }
  const nav = snap.navs.get(reserve);
  if (!nav || nav.data.shares === 0n) return refused("not-deployed", `the ${reserve} reserve has no live statement`);
  const cashOut = (req.shares * nav.data.assets) / nav.data.shares;
  if (cashOut <= 0n) return refused("below-min-quantity", "these shares redeem for nothing at this NAV");
  const pool = d.reservePools.get(reserve)!;
  const shard = await lease(pool, cashOut, `reserve ${reserve}`);
  if (isAnswer(shard)) return refused("reserve-cap", `the ${reserve} reserve's liquid cash cannot pay ${cashOut} right now: the rest is locked behind live tickets`);
  try {
    const earnDesk = d.earnDeskCid;
    if (!earnDesk) throw new DeskRefusal("not-deployed", "no EarnDesk on this participant: run the bootstrap");
    const out = await onReserve(d, reserve, [[pool, [shard]]], ({ navCid }) => ({
      commandId: `earn:withdraw:${requestId}`,
      commands: [tcmd.issueWithdraw(earnDesk, { navCid, provider: seat.party, lpShareCid: share.cid, sharesIn: req.shares, shardCid: shard.cid, validUntilSec })],
    }));
    if (out.kind === "dry") return refused("not-deployed", `DRY RUN: ${out.note}`);
    const q = createdOne(out, TEMPLATE_IDS.WithdrawQuote, decodeWithdrawQuote);
    if (!q) return refused("unknown", "the issue landed without a withdraw quote");
    d.log(`earn ${reserve} withdraw ${q.data.sharesIn} shares → ${q.data.cashOut} for ${seat.party.split("::")[0]}`);
    return reply({ kind: "withdraw-quote", quoteCid: q.cid, sharesIn: q.data.sharesIn, cashOut: q.data.cashOut, validUntilMs: validUntilSec * 1000 });
  } catch (error) {
    return failed(d, `earn withdraw ${requestId}`, error);
  }
}


/**
 * C9d, a draining seat's Earn shares: each share is quoted for withdrawal at the live NAV (the same `Earn_IssueWithdraw`
 * a seat asks for) and the quote is accepted as the seat (`Withdraw_Accept`), so the seat's cash, not its shares, is
 * what the recycle then sweeps. A reserve whose liquid cash cannot pay now is tried again on the next pass.
 */
export async function redeemSeatShares(d: Desk, seat: string, shares: ReadonlyArray<{ cid: string; reserveId: string; shares: bigint }>): Promise<string[]> {
  const notes: string[] = [];
  const who = seat.split("::")[0];
  for (const share of shares) {
    const answer = await handleEarn(d, { party: seat, leaseId: "seat-drain", op: "withdraw", reserve: share.reserveId, shares: share.shares.toString() });
    const body = answer.body as { kind?: string; quoteCid?: string; cashOut?: bigint; diagnosis?: { technical?: string } };
    if (body.kind !== "withdraw-quote" || !body.quoteCid) {
      notes.push(`${who}: ${share.reserveId} shares not redeemed yet: ${body.diagnosis?.technical ?? `status ${answer.status}`}`);
      continue;
    }
    if (d.venue.dryRun) continue;
    try {
      await d.venue.client.submitAndWaitForTransaction({ actAs: [seat], commandId: `drain-earn:${body.quoteCid.slice(0, 48)}`, commands: [tcmd.acceptWithdraw(body.quoteCid)] });
      notes.push(`${who}: redeemed ${share.shares} ${share.reserveId} shares for ${body.cashOut}`);
    } catch (error) {
      notes.push(`${who}: accepting the ${share.reserveId} withdraw quote failed: ${error instanceof Error ? error.message.slice(0, 160) : String(error)}`);
    }
  }
  return notes;
}
