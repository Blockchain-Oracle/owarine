/**
 * The lane feeders (C6, plan "Prices and lanes"): the stock, xStock, PreStocks and basket lanes' prints on the same
 * attested path as crypto. Each oracle party reads its lane's original source itself (`prices/attested-read.ts`: RedStone,
 * Pyth Hermes, Switchboard Surge, the PreStocks catalogue) and posts one `PriceQuote` per (symbol, boundary, bar,
 * policy version) that a live Window needs, `commandId` `lprint:<oracle>:<symbol>:<T>:v<version>`. The terms' own
 * `printSource` names the source, so every receipt says where the number came from.
 *
 * Unlike the crypto feeders, which post every minute, these post only for the boundaries of listed Windows: an open
 * print at `tradingStart` while its `WindowState` waits, a close print at `expiry` while its `OpenPrint` waits. Planning
 * reads the venue's view (the oracle parties are not stakeholders of the terms); every write is the oracle's own.
 * A read that cannot be made inside the slot's window is given up and logged, and the Window voids on the missing print.
 */
import { createHash } from "node:crypto";
import { appendFileSync } from "node:fs";
import { assertCommandId } from "@owarine/ledger";
import { archivePrints } from "@owarine/db";
import { TEMPLATE_IDS } from "@owarine/daml";
import { parsePrintSource, type PrintSourceParts } from "@owarine/core/market";
import { cmd, createdOf, decodeOpenPrint, decodePriceQuote, decodeWindowState, digest, failureText, learnTerms, pick, readActive, submit, type RoleSession, type TermsC } from "@owarine/markets/ops/canton";
import { runActor, type PassResult } from "../../runtime/actor";
import { errorText } from "../../runtime/env";
import { ORACLE_ROLES, type OracleRole } from "../../runtime/keys";
import { createAttestedReader, type AttestedReader, type AttestedReaderDeps, type ReadSlot } from "../../prices/attested-read";
import { oracleName, type VenueContext } from "../venue/context";
import { emitVenueEvent } from "../venue/events";
import { emitFreshQuotes } from "./quote-bus";

export interface LaneSlot extends ReadSlot {
  symbol: string;
  barLenSec: number;
  policyVersion: number;
  parts: PrintSourceParts;
  printSource: string;
  oracles: ReadonlySet<string>;
  /** Market ids waiting on this print, for logs. */
  markets: string[];
}

const slotKey = (symbol: string, boundarySec: number, barLenSec: number, policyVersion: number) => `${symbol}|${boundarySec}|${barLenSec}|${policyVersion}`;

/** A lane source the feeders read (not the crypto exchanges, which print every minute, nor a committee, which attests by hand). */
const fedHere = (parts: PrintSourceParts | null): parts is PrintSourceParts => parts !== null && parts.source !== "exchanges" && parts.source !== "committee";

/**
 * The prints live Windows are waiting for, one slot per (symbol, T, bar, version), with the widest deadline of the
 * Windows sharing it (a 5 m close and the next 5 m open at the same T are one print). Pure over the ledger shapes.
 */
export function laneSlots(waiting: ReadonlyArray<{ terms: TermsC; slot: "open" | "close" }>): LaneSlot[] {
  const out = new Map<string, LaneSlot>();
  for (const { terms: t, slot } of waiting) {
    const parts = parsePrintSource(t.printSource);
    if (!fedHere(parts)) continue;
    const boundarySec = slot === "open" ? t.tradingStartSec : t.expirySec;
    const deadlineSec = slot === "open" ? t.openDeadlineSec : t.closeDeadlineSec;
    const key = slotKey(t.symbol, boundarySec, t.barLenSec, t.policyVersion);
    const have = out.get(key);
    if (have) {
      have.deadlineSec = Math.max(have.deadlineSec, deadlineSec);
      have.earliestSec = Math.min(have.earliestSec, boundarySec + t.minDelaySec);
      for (const o of t.oracles) (have.oracles as Set<string>).add(o);
      have.markets.push(`${t.marketId} ${slot}`);
      continue;
    }
    out.set(key, {
      symbol: t.symbol, boundarySec, earliestSec: boundarySec + t.minDelaySec, deadlineSec, barLenSec: t.barLenSec, policyVersion: t.policyVersion,
      parts, printSource: t.printSource, oracles: new Set(t.oracles), markets: [`${t.marketId} ${slot}`],
    });
  }
  return [...out.values()].sort((a, b) => a.boundarySec - b.boundarySec || (a.symbol < b.symbol ? -1 : 1));
}

export const lanePrintCommandId = (oracle: string, symbol: string, boundarySec: number, policyVersion: number) =>
  assertCommandId(`lprint:${oracle}:${symbol}:${boundarySec}:v${policyVersion}`);

/** One oracle's prints for one boundary, in one transaction: the slot keys are sorted, so a retry of the same set lands once. */
export const lanePrintsCommandId = (oracle: string, boundarySec: number, slotKeys: readonly string[]) =>
  assertCommandId(`lprints:${oracle}:${boundarySec}:${digest(...[...slotKeys].sort())}`);

export interface OracleFeed {
  role: OracleRole;
  session: RoleSession;
  reader: AttestedReader;
  log: (why: string) => void;
}

export interface LaneFeederState {
  venue: RoleSession;
  resolver: string;
  feeds: OracleFeed[];
  terms: Map<string, TermsC>;
  /** `<oracle>|<slot key>` given up on (missed their window) or posted, so they are not retried. */
  done: Set<string>;
  counters: { posted: number; recovered: number; missed: number; failed: number };
  log: (why: string) => void;
}

const hash = (payload: string) => createHash("sha256").update(payload, "utf8").digest("hex");

async function archive(feed: string, boundarySec: number, payload: string, signers: number, priceE8: bigint, fetchedAtSec: number): Promise<void> {
  const row = { source: "attested" as const, feed, boundarySec, payload, signers, priceE8: priceE8.toString(), fetchedAtMs: fetchedAtSec * 1000 };
  try {
    if ((await archivePrints([row])) !== null) return;
  } catch {
    // The archive is evidence, never a gate on posting; fall through to the file when configured.
  }
  const file = process.env.OPS_PRINT_ARCHIVE_FILE;
  if (file) appendFileSync(file, `${JSON.stringify(row)}\n`);
}

type SlotRead =
  | { kind: "ready"; slot: LaneSlot; key: string; label: string; priceE8: bigint; payload: string; signers: number; note: string; fetchedAtSec: number }
  | { kind: "skip"; line: string | null; retrySec: number | null };

/** Reads one slot's print for one oracle: ready to post, waiting, or missed (given up, the Windows void). */
async function readOne(state: LaneFeederState, feed: OracleFeed, slot: LaneSlot, nowSec: number): Promise<SlotRead> {
  const name = oracleName(feed.role);
  const key = `${feed.session.party}|${slotKey(slot.symbol, slot.boundarySec, slot.barLenSec, slot.policyVersion)}`;
  const label = `${slot.symbol} @${new Date(slot.boundarySec * 1000).toISOString().slice(11, 16)}Z (${slot.parts.source})`;
  let outcome;
  try {
    outcome = await feed.reader.read(slot.parts, slot, nowSec);
  } catch (error) {
    return { kind: "skip", line: `${name} ${label}: read failed, retrying: ${errorText(error)}`, retrySec: nowSec + 5 };
  }
  if (outcome.kind === "wait") return { kind: "skip", line: null, retrySec: outcome.retrySec };
  if (outcome.kind === "missed") {
    state.done.add(key);
    state.counters.missed++;
    return { kind: "skip", line: `${name} ${label}: no print, ${outcome.why}; ${slot.markets.join(", ")} will void on a missing print`, retrySec: null };
  }
  const r = outcome.read;
  const fetchedAtSec = Math.max(r.fetchedAtSec, slot.boundarySec);
  await archive(`${name}:${slot.parts.source}:${slot.symbol}`, slot.boundarySec, r.payload, r.signers, r.priceE8, fetchedAtSec);
  return { kind: "ready", slot, key, label, priceE8: r.priceE8, payload: r.payload, signers: r.signers, note: r.note, fetchedAtSec };
}

const quoteOf = (state: LaneFeederState, feed: OracleFeed, x: Extract<SlotRead, { kind: "ready" }>) =>
  cmd.createPriceQuote({
    oracle: feed.session.party, venue: state.venue.party, resolver: state.resolver, symbol: x.slot.symbol, boundarySec: x.slot.boundarySec, priceE8: x.priceE8,
    barLenSec: x.slot.barLenSec, fetchedAtSec: x.fetchedAtSec, payloadHash: hash(x.payload), policyVersion: x.slot.policyVersion,
  });

/**
 * Posts one oracle's ready prints for one boundary in ONE transaction (13 lane symbols were 39 transactions a boundary,
 * landing T+15 to T+65 s on DevNet), as the crypto feeder already does. A refused batch falls back to one print per
 * transaction under each print's own command id, so one bad print never holds the others back.
 */
export async function postBoundary(state: LaneFeederState, feed: OracleFeed, ready: Extract<SlotRead, { kind: "ready" }>[], nowSec: number): Promise<{ lines: string[]; retrySec: number | null }> {
  const name = oracleName(feed.role);
  const boundarySec = ready[0]!.slot.boundarySec;
  const landed = (out: Awaited<ReturnType<typeof submit>>, xs: typeof ready): string[] => {
    if (out.kind === "dry") return xs.map((x) => `${out.note}: ${name} ${x.label} ${x.priceE8}`);
    for (const x of xs) state.done.add(x.key);
    if (out.recovered) state.counters.recovered += xs.length;
    else state.counters.posted += xs.length;
    // The resolver's fast path: it records the boundary the moment the quotes exist, not on its next poll.
    emitFreshQuotes(createdOf(out.created, TEMPLATE_IDS.PriceQuote).map((e) => ({ cid: e.contractId, data: decodePriceQuote(e.createArgument) })));
    emitVenueEvent({ kind: "printed", oracle: name, boundarySec, symbols: xs.map((x) => x.slot.symbol), atMs: Date.now() });
    return [`${name} posted ${xs.length} lane print(s) @${new Date(boundarySec * 1000).toISOString().slice(11, 16)}Z in one transaction (${xs.map((x) => `${x.slot.symbol} T+${x.fetchedAtSec - boundarySec}s`).join(", ")}; ${out.ms} ms)`];
  };
  try {
    const out = await submit(feed.session, { commandId: lanePrintsCommandId(name, boundarySec, ready.map((x) => x.key)), commands: ready.map((x) => quoteOf(state, feed, x)) });
    return { lines: landed(out, ready), retrySec: null };
  } catch (error) {
    if (ready.length === 1) {
      state.counters.failed++;
      return { lines: [`${name} ${ready[0]!.label}: post failed (retrying): ${failureText(error)}`], retrySec: nowSec + 3 };
    }
  }
  const lines: string[] = [];
  let retrySec: number | null = null;
  for (const x of ready) {
    try {
      const out = await submit(feed.session, { commandId: lanePrintCommandId(name, x.slot.symbol, x.slot.boundarySec, x.slot.policyVersion), commands: [quoteOf(state, feed, x)] });
      lines.push(...landed(out, [x]));
    } catch (error) {
      state.counters.failed++;
      lines.push(`${name} ${x.label}: post failed (retrying under the same command id): ${failureText(error)}`);
      retrySec = nowSec + 3;
    }
  }
  return { lines, retrySec };
}

export async function laneFeederPass(state: LaneFeederState): Promise<PassResult> {
  // The quotes (every oracle's, kept for the retention: 700 KB on DevNet) are read only when a lane print is due now.
  const acs = await readActive(state.venue, [TEMPLATE_IDS.WindowState, TEMPLATE_IDS.OpenPrint]);
  const states = pick(acs, TEMPLATE_IDS.WindowState, decodeWindowState);
  const opens = pick(acs, TEMPLATE_IDS.OpenPrint, decodeOpenPrint);
  const cids = [...states.map((s) => s.data.termsCid), ...opens.map((o) => o.data.termsCid)];
  // Each new Window's terms by id (C4g): paging MarketTerms returns every Window the venue ever ran.
  await learnTerms(state.venue, state.terms, cids);
  const waiting = [
    ...states.flatMap((s) => (state.terms.has(s.data.termsCid) ? [{ terms: state.terms.get(s.data.termsCid)!, slot: "open" as const }] : [])),
    ...opens.flatMap((o) => (state.terms.has(o.data.termsCid) ? [{ terms: state.terms.get(o.data.termsCid)!, slot: "close" as const }] : [])),
  ];
  const nowSec = Math.floor(Date.now() / 1000);
  const slots = laneSlots(waiting);
  let wakeSec = nowSec + 15;
  const lines: string[] = [];
  const due = slots.filter((s) => nowSec <= s.deadlineSec);
  for (const s of due) if (nowSec < s.earliestSec) wakeSec = Math.min(wakeSec, s.earliestSec);
  const postable = due.some((s) => nowSec >= s.earliestSec);
  const quotes = postable ? pick(await readActive(state.venue, [TEMPLATE_IDS.PriceQuote]), TEMPLATE_IDS.PriceQuote, decodePriceQuote) : [];
  const have = new Set(quotes.map((q) => `${q.data.oracle}|${slotKey(q.data.symbol, q.data.boundarySec, q.data.barLenSec, q.data.policyVersion)}`));
  const note = (feed: OracleFeed, line: string | null, retrySec: number | null) => {
    if (line) {
      lines.push(line);
      feed.log(line);
    }
    if (retrySec !== null) wakeSec = Math.min(wakeSec, retrySec);
  };
  await Promise.all(
    state.feeds.map(async (feed) => {
      const mine = due.filter((slot) => {
        if (nowSec < slot.earliestSec || !slot.oracles.has(feed.session.party)) return false;
        const key = `${feed.session.party}|${slotKey(slot.symbol, slot.boundarySec, slot.barLenSec, slot.policyVersion)}`;
        return !have.has(key) && !state.done.has(key);
      });
      const reads = await Promise.all(mine.map((slot) => readOne(state, feed, slot, nowSec)));
      const byBoundary = new Map<number, Extract<SlotRead, { kind: "ready" }>[]>();
      for (const r of reads) {
        if (r.kind === "skip") note(feed, r.line, r.retrySec);
        else byBoundary.set(r.slot.boundarySec, [...(byBoundary.get(r.slot.boundarySec) ?? []), r]);
      }
      for (const ready of byBoundary.values()) {
        const posted = await postBoundary(state, feed, ready, nowSec);
        for (const l of posted.lines) note(feed, l, null);
        if (posted.retrySec !== null) wakeSec = Math.min(wakeSec, posted.retrySec);
      }
    }),
  );
  if (state.done.size > 5_000) state.done.clear();
  const c = state.counters;
  const pending = due.length ? `${due.length} lane print(s) due or upcoming` : "no lane Window waiting on a print";
  return {
    why: `${pending}; posted ${c.posted}, recovered ${c.recovered}, missed ${c.missed}, failed ${c.failed}${lines.length ? ` · ${lines.slice(0, 3).join(" · ")}` : ""}`,
    detail: { counters: { ...c }, slots: due.map((s) => `${s.symbol}@${s.boundarySec} ${s.parts.source}`) },
    nextDelayMs: Math.min(15_000, Math.max(1_000, (wakeSec - nowSec) * 1000)),
  };
}

/** Starts the lane feeders: one actor over every oracle role that has a party, each with its own source reader. */
export function startLaneFeeders(venue: VenueContext, readerDeps: AttestedReaderDeps, log: (actor: string) => (why: string) => void): { stop: () => void } {
  const vs = venue.session("venue");
  const resolver = venue.parties.resolver;
  const feeds: OracleFeed[] = [];
  for (const role of ORACLE_ROLES) {
    const session = venue.session(role);
    if (session) feeds.push({ role, session, reader: createAttestedReader(readerDeps), log: log(`oracle-${oracleName(role)}`) });
  }
  const actorLog = log("lane-oracles");
  if (!vs || !resolver || feeds.length === 0) {
    actorLog("no venue, resolver or oracle party: the lane feeders do not run");
    return { stop: () => {} };
  }
  const state: LaneFeederState = { venue: vs, resolver, feeds, terms: new Map(), done: new Set(), counters: { posted: 0, recovered: 0, missed: 0, failed: 0 }, log: actorLog };
  actorLog(`lane prints (RedStone, Pyth, Switchboard, PreStocks, baskets) as ${feeds.map((f) => oracleName(f.role)).join(", ")}${readerDeps.pythKey ? "" : " · no PYTH_API_KEY"}`);
  return runActor({ name: "lane-oracles", log: actorLog, dryRun: vs.dryRun, everyMs: 2_000, pass: () => laneFeederPass(state) });
}
