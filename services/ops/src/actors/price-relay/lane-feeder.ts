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
import { assertCommandId } from "@agari/ledger";
import { archivePrints } from "@agari/db";
import { TEMPLATE_IDS } from "@agari/daml";
import { parsePrintSource, type PrintSourceParts } from "@agari/core/market";
import { cmd, decodeOpenPrint, decodePriceQuote, decodeTerms, decodeWindowState, failureText, pick, readActive, submit, type RoleSession, type TermsC } from "@agari/markets/ops/canton";
import { runActor, type PassResult } from "../../runtime/actor";
import { errorText } from "../../runtime/env";
import { ORACLE_ROLES, type OracleRole } from "../../runtime/keys";
import { createAttestedReader, type AttestedReader, type AttestedReaderDeps, type ReadSlot } from "../../prices/attested-read";
import { oracleName, type VenueContext } from "../venue/context";
import { emitVenueEvent } from "../venue/events";

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

interface OracleFeed {
  role: OracleRole;
  session: RoleSession;
  reader: AttestedReader;
  log: (why: string) => void;
}

interface LaneFeederState {
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

async function feedOne(state: LaneFeederState, feed: OracleFeed, slot: LaneSlot, nowSec: number): Promise<{ line: string | null; retrySec: number | null }> {
  const name = oracleName(feed.role);
  const key = `${feed.session.party}|${slotKey(slot.symbol, slot.boundarySec, slot.barLenSec, slot.policyVersion)}`;
  const label = `${slot.symbol} @${new Date(slot.boundarySec * 1000).toISOString().slice(11, 16)}Z (${slot.parts.source})`;
  let outcome;
  try {
    outcome = await feed.reader.read(slot.parts, slot, nowSec);
  } catch (error) {
    return { line: `${name} ${label}: read failed, retrying: ${errorText(error)}`, retrySec: nowSec + 5 };
  }
  if (outcome.kind === "wait") return { line: null, retrySec: outcome.retrySec };
  if (outcome.kind === "missed") {
    state.done.add(key);
    state.counters.missed++;
    return { line: `${name} ${label}: no print, ${outcome.why}; ${slot.markets.join(", ")} will void on a missing print`, retrySec: null };
  }
  const r = outcome.read;
  const fetchedAtSec = Math.max(r.fetchedAtSec, slot.boundarySec);
  try {
    await archive(`${name}:${slot.parts.source}:${slot.symbol}`, slot.boundarySec, r.payload, r.signers, r.priceE8, fetchedAtSec);
    const out = await submit(feed.session, {
      commandId: lanePrintCommandId(name, slot.symbol, slot.boundarySec, slot.policyVersion),
      commands: [cmd.createPriceQuote({
        oracle: feed.session.party, venue: state.venue.party, resolver: state.resolver, symbol: slot.symbol, boundarySec: slot.boundarySec, priceE8: r.priceE8,
        barLenSec: slot.barLenSec, fetchedAtSec, payloadHash: hash(r.payload), policyVersion: slot.policyVersion,
      })],
    });
    if (out.kind === "dry") return { line: `${out.note}: ${name} ${label} ${r.priceE8}`, retrySec: null };
    state.done.add(key);
    if (out.recovered) state.counters.recovered++;
    else state.counters.posted++;
    emitVenueEvent({ kind: "printed", oracle: name, boundarySec: slot.boundarySec, symbols: [slot.symbol], atMs: Date.now() });
    return { line: `${name} posted ${label} ${r.priceE8} e-8 at T+${fetchedAtSec - slot.boundarySec}s (${r.note}, ${out.ms} ms)`, retrySec: null };
  } catch (error) {
    state.counters.failed++;
    return { line: `${name} ${label}: post failed (retrying under the same command id): ${failureText(error)}`, retrySec: nowSec + 3 };
  }
}

export async function laneFeederPass(state: LaneFeederState): Promise<PassResult> {
  const acs = await readActive(state.venue, [TEMPLATE_IDS.WindowState, TEMPLATE_IDS.OpenPrint, TEMPLATE_IDS.PriceQuote]);
  const states = pick(acs, TEMPLATE_IDS.WindowState, decodeWindowState);
  const opens = pick(acs, TEMPLATE_IDS.OpenPrint, decodeOpenPrint);
  const cids = [...states.map((s) => s.data.termsCid), ...opens.map((o) => o.data.termsCid)];
  if (cids.some((c) => !state.terms.has(c))) {
    for (const t of pick(await readActive(state.venue, [TEMPLATE_IDS.MarketTerms]), TEMPLATE_IDS.MarketTerms, decodeTerms)) state.terms.set(t.cid, t.data);
  }
  const waiting = [
    ...states.flatMap((s) => (state.terms.has(s.data.termsCid) ? [{ terms: state.terms.get(s.data.termsCid)!, slot: "open" as const }] : [])),
    ...opens.flatMap((o) => (state.terms.has(o.data.termsCid) ? [{ terms: state.terms.get(o.data.termsCid)!, slot: "close" as const }] : [])),
  ];
  const have = new Set(pick(acs, TEMPLATE_IDS.PriceQuote, decodePriceQuote).map((q) => `${q.data.oracle}|${slotKey(q.data.symbol, q.data.boundarySec, q.data.barLenSec, q.data.policyVersion)}`));
  const nowSec = Math.floor(Date.now() / 1000);
  const slots = laneSlots(waiting);
  let wakeSec = nowSec + 15;
  const lines: string[] = [];
  const due = slots.filter((s) => nowSec <= s.deadlineSec);
  for (const s of due) if (nowSec < s.earliestSec) wakeSec = Math.min(wakeSec, s.earliestSec);
  await Promise.all(
    state.feeds.map(async (feed) => {
      for (const slot of due) {
        if (nowSec < slot.earliestSec || !slot.oracles.has(feed.session.party)) continue;
        const key = `${feed.session.party}|${slotKey(slot.symbol, slot.boundarySec, slot.barLenSec, slot.policyVersion)}`;
        if (have.has(key) || state.done.has(key)) continue;
        const r = await feedOne(state, feed, slot, nowSec);
        if (r.line) {
          lines.push(r.line);
          feed.log(r.line);
        }
        if (r.retrySec !== null) wakeSec = Math.min(wakeSec, r.retrySec);
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
