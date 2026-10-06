/**
 * The three oracle feeders (plan "Venue operations": price-relay becomes Coinbase, Kraken and Bitstamp feeders). Each
 * is its own role party and posts, at T + 10 s (K-025), one command per boundary covering every symbol: a `PriceQuote`
 * per symbol carrying the close of that exchange's 1-minute candle ending at T, `commandId` `print:<oracle>:<T>`.
 *
 * The raw response is archived byte-identical (`print_archive`, source `attested`, feed `<oracle>:<symbol>`) and its
 * sha-256 is the quote's `payloadHash`, so the proof page can re-verify a print from the archive or the exchange.
 * This is a new sourcing decision, not a port: the reference relay fetched Pyth, RedStone, Switchboard and Jupiter.
 */
import { createHash } from "node:crypto";
import { appendFileSync } from "node:fs";
import { archivePrints, getDb, openDependentSpans, quoteIsCited, type DependentSpan } from "@agari/db";
import { TEMPLATE_IDS } from "@agari/daml";
import { cmd, decodePriceQuote, failureText, pick, printCommandId, readActive, retireCommandId, submit, type RoleSession } from "@agari/markets/ops/canton";
import { runActor, type PassResult } from "../../runtime/actor";
import { errorText } from "../../runtime/env";
import { ORACLE_ROLES, type OracleRole } from "../../runtime/keys";
import { fetchCandle, type Candle, type Exchange, type Fetch } from "../../prices/candles";
import { oracleName, type VenueContext } from "../venue/context";
import { emitVenueEvent } from "../venue/events";

/** K-025: every exchange served the closed candle by T + 5 s at 59 of 60 boundaries; feeders post at T + 10 s. */
export const POST_DELAY_SEC = 10;
/** A symbol whose candle is not final yet is waited for until T + this, then the rest is posted without it. */
export const WAIT_ALL_SEC = 20;
/**
 * The widest admission of any exchange-printed Window: the 1-minute lane's close admits to T + 40, every other crypto
 * lane's open and close to T + 60 (`scripts/bootstrap-local.ts` `cryptoLanes`).
 */
export const WIDEST_ADMISSION_SEC = 60;
/**
 * Past T + this the boundary is abandoned. It leaves the resolver 10 s inside the widest admission. A print posted past
 * a 1-minute lane's T + 40 simply does not count there, but a 5 m or 15 m close at the same T still needs it: a feeder
 * that wakes late (a host sleep, a stalled loop) must not drop a print those Windows can still use (C9c: both 15 m duel
 * cards voided `MissingPrint(CloseSlot)` when the feeder woke at T + 39 and gave up at T + 35).
 */
export const GIVE_UP_SEC = WIDEST_ADMISSION_SEC - 10;
export const BAR_SEC = 60;

export interface FeederSettings {
  symbols: readonly string[];
  /** Quotes older than this are retired (the Resolution embeds the evidence it used). */
  retainSec: number;
  fetchImpl?: Fetch;
  /** Wall clock, seconds; a test pins it. */
  nowSec?: () => number;
}

export function readFeederSettings(env: NodeJS.ProcessEnv = process.env): FeederSettings {
  const symbols = (env.ORACLE_SYMBOLS ?? "BTC,ETH").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
  const retain = Number(env.ORACLE_RETAIN_SEC);
  return { symbols, retainSec: Number.isInteger(retain) && retain >= 600 ? retain : 2 * 3_600 };
}

/** The boundary a pass at `nowSec` works on: the latest T with T + POST_DELAY ≤ now. */
export const boundaryFor = (nowSec: number) => Math.floor((nowSec - POST_DELAY_SEC) / BAR_SEC) * BAR_SEC;

export const payloadHash = (payload: string) => createHash("sha256").update(payload, "utf8").digest("hex");

interface FeederState {
  role: OracleRole;
  exchange: Exchange;
  session: RoleSession;
  venue: string;
  resolver: string;
  policyVersion: number;
  settings: FeederSettings;
  /** Boundaries already posted (or given up), newest last. */
  done: Set<number>;
  pending: Map<number, Map<string, Candle>>;
  lastRetireMs: number;
  counters: { posted: number; recovered: number; partial: number; missed: number; failed: number; retired: number };
  log: (why: string) => void;
}

async function archive(state: FeederState, candles: readonly Candle[]): Promise<string> {
  const rows = candles.map((c) => ({ source: "attested" as const, feed: `${state.exchange}:${c.symbol}`, boundarySec: c.boundarySec, payload: c.payload, signers: 1, priceE8: c.priceE8.toString(), fetchedAtMs: c.fetchedAtMs }));
  try {
    const stored = await archivePrints(rows);
    if (stored !== null) return `archived ${stored}`;
  } catch (error) {
    return `archive failed: ${errorText(error)}`;
  }
  // No database: an append-only JSONL file keeps the bytes when OPS_PRINT_ARCHIVE_FILE is set.
  const file = process.env.OPS_PRINT_ARCHIVE_FILE;
  if (!file) return "no archive configured";
  appendFileSync(file, rows.map((r) => `${JSON.stringify(r)}\n`).join(""));
  return `archived ${rows.length} to file`;
}

async function gather(state: FeederState, boundarySec: number): Promise<Map<string, Candle>> {
  const have = state.pending.get(boundarySec) ?? new Map<string, Candle>();
  state.pending.set(boundarySec, have);
  const wanted = state.settings.symbols.filter((s) => !have.has(s));
  await Promise.all(
    wanted.map(async (symbol) => {
      try {
        const c = await fetchCandle(state.exchange, symbol, boundarySec, state.settings.fetchImpl);
        if (c) have.set(symbol, c);
      } catch (error) {
        state.log(`${state.exchange} ${symbol} @${boundarySec}: ${errorText(error)}`);
      }
    }),
  );
  return have;
}

async function post(state: FeederState, boundarySec: number, candles: Candle[], nowSec: number): Promise<string> {
  const fetchedAtSec = Math.max(boundarySec, Math.floor(Math.max(...candles.map((c) => c.fetchedAtMs)) / 1000));
  const commands = candles.map((c) =>
    cmd.createPriceQuote({
      oracle: state.session.party, venue: state.venue, resolver: state.resolver, symbol: c.symbol, boundarySec, priceE8: c.priceE8,
      barLenSec: BAR_SEC, fetchedAtSec, payloadHash: payloadHash(c.payload), policyVersion: state.policyVersion,
    }),
  );
  const archived = await archive(state, candles);
  const out = await submit(state.session, { commandId: printCommandId(oracleName(state.role), boundarySec), commands });
  const prices = candles.map((c) => `${c.symbol} ${c.closeText}`).join(", ");
  if (out.kind === "dry") return `${out.note}: ${prices}`;
  if (out.recovered) state.counters.recovered++;
  else state.counters.posted++;
  emitVenueEvent({ kind: "printed", oracle: state.exchange, boundarySec, symbols: candles.map((c) => c.symbol), atMs: Date.now() });
  return `posted @${new Date(boundarySec * 1000).toISOString().slice(11, 16)}Z T+${nowSec - boundarySec}s ${prices} (${out.ms} ms, ${archived})${out.recovered ? " · already posted" : ""}`;
}

/**
 * C-DAML-03: the Windows open products still depend on, from the projection (null when this process has none). A quote
 * inside such a Window's life may yet be cited by a boost's knock-out or a product's settlement, so it is kept.
 */
async function dependentSpans(): Promise<DependentSpan[] | null> {
  const db = getDb();
  return db ? openDependentSpans(db) : null;
}

/** Retires this oracle's quotes older than the retention, one batch per pass, keeping any an open product may cite. */
async function retire(state: FeederState, nowSec: number): Promise<string | null> {
  if (Date.now() - state.lastRetireMs < 10 * 60_000) return null;
  state.lastRetireMs = Date.now();
  const mine = pick(await readActive(state.session, [TEMPLATE_IDS.PriceQuote]), TEMPLATE_IDS.PriceQuote, decodePriceQuote).filter((q) => q.data.oracle === state.session.party);
  const aged = mine.filter((q) => q.data.boundarySec < nowSec - state.settings.retainSec);
  if (aged.length === 0) return null;
  // A projection that cannot be read now retires nothing this pass: a quote retired in error cannot be posted again.
  const spans = await dependentSpans().catch(() => undefined);
  if (spans === undefined) return `kept ${aged.length} aged quotes: the projection's dependents could not be read`;
  const cited = spans ? aged.filter((q) => quoteIsCited(spans, q.data.symbol, q.data.boundarySec)) : [];
  const old = aged.filter((q) => !cited.includes(q)).slice(0, 50);
  const keptNote = cited.length ? `, kept ${cited.length} an open product may cite` : spans === null ? " (no projection here: dependents not checked)" : "";
  if (old.length === 0) return `retired 0 quotes${keptNote}`;
  const cids = old.map((q) => q.cid);
  const out = await submit(state.session, { commandId: retireCommandId(oracleName(state.role), cids), commands: cids.map((c) => cmd.retirePriceQuote(c)) });
  if (out.kind === "done") state.counters.retired += cids.length;
  return `retired ${cids.length} quotes older than ${state.settings.retainSec} s${keptNote}`;
}

export async function feederPass(state: FeederState): Promise<PassResult> {
  const nowSec = (state.settings.nowSec ?? (() => Math.floor(Date.now() / 1000)))();
  const boundarySec = boundaryFor(nowSec);
  const nextSec = boundarySec + BAR_SEC + POST_DELAY_SEC;
  const idle = (why: string): PassResult => ({ why, detail: { counters: { ...state.counters } }, nextDelayMs: Math.max(250, nextSec * 1000 - Date.now()) });
  for (const t of state.pending.keys()) if (t < boundarySec) state.pending.delete(t);
  if (state.done.has(boundarySec)) {
    const retired = await retire(state, nowSec).catch((error: unknown) => `retire failed: ${failureText(error)}`);
    return idle(retired ?? `waiting for ${new Date((boundarySec + BAR_SEC) * 1000).toISOString().slice(11, 19)}Z`);
  }
  if (nowSec > boundarySec + GIVE_UP_SEC) {
    state.done.add(boundarySec);
    state.counters.missed++;
    return idle(`missed @${boundarySec}: past T+${GIVE_UP_SEC}s`);
  }
  const have = await gather(state, boundarySec);
  const candles = state.settings.symbols.map((s) => have.get(s)).filter((c): c is Candle => c !== undefined);
  const complete = candles.length === state.settings.symbols.length;
  if (!complete && nowSec < boundarySec + WAIT_ALL_SEC) {
    return { why: `@${boundarySec}: ${candles.length}/${state.settings.symbols.length} candles final, waiting`, nextDelayMs: 1_000 };
  }
  if (candles.length === 0) return { why: `@${boundarySec}: no candle final yet`, nextDelayMs: 2_000 };
  try {
    const line = await post(state, boundarySec, candles, nowSec);
    state.done.add(boundarySec);
    if (!complete) state.counters.partial++;
    if (state.done.size > 100) state.done.delete(Math.min(...state.done));
    return { ...idle(line), why: line };
  } catch (error) {
    state.counters.failed++;
    return { why: `post @${boundarySec} failed (will retry under the same command id): ${failureText(error)}`, nextDelayMs: 2_000 };
  }
}

/** Starts one feeder per oracle role that has a party; a role without one is reported and skipped. */
export function startOracleFeeders(venue: VenueContext, log: (actor: string) => (why: string) => void, settings: FeederSettings = readFeederSettings()): { stop: () => void } {
  const stops: Array<() => void> = [];
  const venueParty = venue.parties.venue;
  const resolver = venue.parties.resolver;
  for (const role of ORACLE_ROLES) {
    const name = `oracle-${oracleName(role)}`;
    const session = venue.session(role);
    if (!session || !venueParty || !resolver) {
      log(name)(`${role} (or the venue/resolver party) has no party: this feeder does not run`);
      continue;
    }
    const state: FeederState = {
      role, exchange: oracleName(role) as Exchange, session, venue: venueParty, resolver, policyVersion: venue.policyVersion, settings,
      done: new Set(), pending: new Map(), lastRetireMs: 0,
      counters: { posted: 0, recovered: 0, partial: 0, missed: 0, failed: 0, retired: 0 }, log: log(name),
    };
    log(name)(`feeding ${settings.symbols.join(",")} 1-minute closes as ${session.party.split("::")[0]}, policy v${venue.policyVersion}, at T+${POST_DELAY_SEC}s`);
    stops.push(runActor({ name, log: log(name), dryRun: session.dryRun, everyMs: 2_000, pass: () => feederPass(state) }).stop);
  }
  return { stop: () => stops.forEach((s) => s()) };
}
