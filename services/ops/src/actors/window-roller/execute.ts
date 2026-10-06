/**
 * One roller pass on Canton (plan "Venue operations": `execute.ts` → `Series_OpenWindow`): read the venue's `Series`
 * contracts, plan each lane with the unchanged pure planners (`plan.ts`, `plan-token.ts`, `plan-gap.ts` by basis), and
 * open the planned Window. After downtime the planned Window can lie past `nextIndex`: the roller first moves the index
 * forward with `Series_SkipTo` (it can never move back), then opens.
 *
 * A Gap Series (C6d, engine 0.4.0) cannot sit on a grid: its Window runs Friday close → Monday open and locks Sunday
 * 20:00 ET. It opens through `Series_OpenWindowSpan` at `nextIndex` with the planner's own three times; the engine checks
 * the index, that it starts no earlier than the Series' `lastExpiry`, the four-day bound and the policy coverage.
 *
 * There are no Books or Ledgers on Canton, so the Solana recycle, sweep, release and grow steps are gone, and "no free
 * book" can never block a lane. Idempotence is the ledger's: `open:<series>:<index>` and `skip:<series>:<index>` are
 * deduplicated, and a retry against the new Series fails `abu-pm/bad-window-index`, which reads as "already opened".
 */
import { isTokenOnlyKind, parseLaneKey, TICKERS, type TickerSymbol } from "@agari/core/market";
import type { LaneBasis } from "@agari/core/types";
import { TEMPLATE_IDS } from "@agari/daml";
import {
  cmd, decodeSeries, failureText, isInactive, openWindowCommandId, pick, readActive, refusalId, seriesOpenFloorSec, skipToCommandId, submit, type Active, type RoleSession,
  type SeriesC,
} from "@agari/markets/ops/canton";
import type { PassResult } from "../../runtime/actor";
import type { VenueDeps } from "../../runtime/deps";
import { spanOf, type PlanClock, type PlanSeries, type SeriesPlan } from "./plan";
import { gapSpanOf } from "./plan-gap";
import { planByBasis } from "./plan-basis";
import { describeVersion, type VersionWindow } from "./versions";
import { emitVenueEvent } from "../venue/events";
import { venueModePausedState } from "@agari/core/market";
import { venueMode, venueModeRefusalNow } from "../../runtime/venue-mode";

export interface RollerSettings {
  leadSec: number;
  gapLeadSec: number;
  minTradableSec: number;
  /** Prelist the next session's first Regular Window at the previous close (D-089). */
  prelist: boolean;
  prelistCadencesSec: readonly number[];
  /** Optional `BTC-1m,ETH-5m` filter (dev runs); empty = every Series of a registry ticker. */
  only: readonly string[];
}

export interface RollerState {
  venue: RoleSession;
  settings: RollerSettings;
  counters: { opened: number; skipped: number; failed: number };
  /** What was last opened per lane, for the heartbeat. */
  last: Map<string, string>;
}

/** `PrintPolicy.source` 4: an attested print (`versions.ts` SOURCE_NAME). */
const SOURCE_ATTESTED = 4;
/** `ADMIT_UNTIL_LOCK` in the planner's numbering; the engine writes it as a negative `openAdmissionSec`. */
const ADMIT_UNTIL_LOCK = 0xffff_ffff;
/** The token planner has no horizon on Canton (`Series_OpenWindow` checks none); the Regular prelist margin needs one. */
const MAX_LEAD_SEC = 7 * 86_400;
/** There are no Books on Canton; the planners' "free book" slot is always filled. */
const NO_BOOK = ["-"];

export function versionWindowOf(pv: SeriesC["policyVersions"][number]): VersionWindow {
  return {
    validFromSec: pv.effectiveFromSec,
    validUntilSec: pv.validUntilSec,
    primarySource: SOURCE_ATTESTED,
    checkSource: 0,
    openAdmissionSec: pv.openAdmissionSec < 0 ? ADMIT_UNTIL_LOCK : pv.openAdmissionSec,
    checkAdmissionSec: 0,
    primaryFeedIdHex: "",
    printSource: pv.printSource,
  };
}

/**
 * A Series' lane: its registry ticker and basis. The lane key names both (`TSLA-5m` Regular, `TSLAx-5m` the TSLA token
 * lane, `BTC-240m` 24/7), because on Canton a token lane's `symbol` is the asset its prints price (`TSLAx`), which the
 * registry does not list. Falls back to the symbol for a key the registry cannot parse.
 */
export function laneOf(s: Pick<SeriesC, "seriesKey" | "symbol">): { symbol: TickerSymbol; basis: LaneBasis } | null {
  const parsed = parseLaneKey(s.seriesKey);
  if (parsed) return { symbol: parsed.symbol, basis: parsed.basis };
  const t = (TICKERS as Record<string, (typeof TICKERS)[TickerSymbol] | undefined>)[s.symbol];
  if (!t) return null;
  return { symbol: t.symbol, basis: isTokenOnlyKind(t.kind) ? "token" : "regular" };
}

/** The lane basis of a Series (see `laneOf`); null for a Series outside the registry. */
export const basisOf = (s: Pick<SeriesC, "seriesKey" | "symbol">): LaneBasis | null => laneOf(s)?.basis ?? null;

export function planSeriesOf(s: SeriesC): PlanSeries {
  return {
    // The planners key halts, skips and the 24/7 asset by the registry ticker, never the print symbol (`TSLAx`).
    key: s.seriesKey, symbol: laneOf(s)?.symbol ?? s.symbol, cadenceSec: s.cadenceSec, maxLeadSec: MAX_LEAD_SEC, nextIndex: BigInt(s.nextIndex),
    // 0.4.0: the Series' own `lastExpiry` (a Gap span's Monday open), else the grid start of `nextIndex` (the engine's `openFloor`).
    lastExpirySec: seriesOpenFloorSec(s), versions: s.policyVersions.map(versionWindowOf), freeBooks: NO_BOOK,
  };
}

/** The Window index a planned trading start is, or null when it does not sit on the Series' grid. */
export function indexOf(s: SeriesC, tradingStartSec: number): number | null {
  const offset = tradingStartSec - s.anchorSec;
  return offset >= 0 && offset % s.cadenceSec === 0 ? offset / s.cadenceSec : null;
}

async function readSeries(state: RollerState): Promise<Active<SeriesC>[]> {
  const all = pick(await readActive(state.venue, [TEMPLATE_IDS.Series]), TEMPLATE_IDS.Series, decodeSeries);
  const mine = all.filter((s) => s.data.venue === state.venue.party);
  return state.settings.only.length ? mine.filter((s) => state.settings.only.includes(s.data.seriesKey)) : mine;
}

/**
 * The lane state an open refusal reads as. `bad-window-index` is "already opened" (a retry against the new Series); the
 * span and policy refusals name the engine's check, so a planner/engine disagreement shows on `/session.lanes` instead of
 * retrying silently every pass.
 */
export function refusalState(id: string | null, span: string): string | null {
  switch (id) {
    case "abu-pm/bad-window-index": return "already opened: re-reading";
    case "abu-pm/bad-span": return `refused: bad-span, ${span} does not trade before it locks`;
    case "abu-pm/span-too-long": return `refused: span-too-long, ${span} is longer than four days`;
    case "abu-pm/window-overlap": return `refused: window-overlap, ${span} starts before the last Window's expiry`;
    case "abu-pm/no-policy": return `paused: no price-policy version covers ${span}`;
    default: return null;
  }
}

/** A Gap Window: `Series_OpenWindowSpan` at `nextIndex` with the planner's own boundaries (no grid, so no skip). */
async function openSpan(state: RollerState, series: Active<SeriesC>, plan: Extract<SeriesPlan, { kind: "open" }>, notes: string[]): Promise<string> {
  const s = series.data;
  const index = s.nextIndex;
  const span = gapSpanOf(plan.window);
  try {
    const opened = await submit(state.venue, {
      commandId: openWindowCommandId(s.seriesKey, index),
      commands: [cmd.openWindowSpan(series.cid, { index, tradingStartSec: plan.window.tradingStartSec, lockAtSec: plan.window.lockAtSec, expirySec: plan.window.expirySec })],
    });
    const version = describeVersion(plan.policyVersion, versionWindowOf(s.policyVersions[plan.policyVersion]!));
    if (opened.kind === "dry") {
      notes.push(`DRY Series_OpenWindowSpan ${s.seriesKey} #${index} ${span}`);
      return `DRY ${plan.state}`;
    }
    const terms = opened.created.find((e) => e.templateId.endsWith(":PM.Market:MarketTerms"));
    state.counters.opened++;
    if (terms) emitVenueEvent({ kind: "opened", marketId: `${s.seriesKey}:${index}`, termsCid: terms.contractId, atMs: Date.now() });
    notes.push(`opened ${s.seriesKey} #${index} ${span} ${version}${opened.recovered ? " (recovered)" : ""} in ${opened.ms} ms${terms ? ` terms ${terms.contractId.slice(0, 12)}…` : ""}`);
    state.last.set(s.seriesKey, `open #${index} ${span} ${version}`);
    return state.last.get(s.seriesKey)!;
  } catch (error) {
    if (isInactive(error)) return "already opened: re-reading";
    const refused = refusalState(refusalId(error), span);
    if (refused) {
      if (!refused.startsWith("already")) notes.push(`open ${s.seriesKey} #${index} ${refused}`);
      return refused;
    }
    state.counters.failed++;
    notes.push(`open ${s.seriesKey} #${index} failed: ${failureText(error)}`);
    return `open failed: ${failureText(error).split("\n")[0]}`;
  }
}

/** Skip forward if needed, then open. Returns the lane state to report. */
async function open(state: RollerState, series: Active<SeriesC>, plan: Extract<SeriesPlan, { kind: "open" }>, notes: string[]): Promise<string> {
  const s = series.data;
  if (basisOf(s) === "gap") return openSpan(state, series, plan, notes);
  const index = indexOf(s, plan.window.tradingStartSec);
  if (index === null) return `off grid: ${spanOf(plan.window)}`;
  if (index < s.nextIndex) return "already opened: re-reading";
  let seriesCid = series.cid;
  try {
    if (index > s.nextIndex) {
      const skipped = await submit(state.venue, { commandId: skipToCommandId(s.seriesKey, index), commands: [cmd.skipTo(seriesCid, index)] });
      if (skipped.kind === "dry") {
        notes.push(`DRY skip ${s.seriesKey} ${s.nextIndex} → ${index}`);
        return `DRY skip to #${index}`;
      }
      const next = skipped.created.find((e) => e.templateId.endsWith(":PM.Series:Series"));
      if (!next) return "skip landed earlier: re-reading";
      seriesCid = next.contractId;
      state.counters.skipped++;
      notes.push(`skipped ${s.seriesKey} ${s.nextIndex} → ${index}`);
    }
    const opened = await submit(state.venue, { commandId: openWindowCommandId(s.seriesKey, index), commands: [cmd.openWindow(seriesCid, index)] });
    const version = describeVersion(plan.policyVersion, versionWindowOf(s.policyVersions[plan.policyVersion]!));
    if (opened.kind === "dry") {
      notes.push(`DRY Series_OpenWindow ${s.seriesKey} #${index} ${spanOf(plan.window)}`);
      return `DRY ${plan.state}`;
    }
    const terms = opened.created.find((e) => e.templateId.endsWith(":PM.Market:MarketTerms"));
    state.counters.opened++;
    if (terms) emitVenueEvent({ kind: "opened", marketId: `${s.seriesKey}:${index}`, termsCid: terms.contractId, atMs: Date.now() });
    const line = `opened ${s.seriesKey} #${index} ${spanOf(plan.window)} ${version}${opened.recovered ? " (recovered)" : ""} in ${opened.ms} ms`;
    notes.push(`${line}${terms ? ` terms ${terms.contractId.slice(0, 12)}…` : ""}`);
    state.last.set(s.seriesKey, `open #${index} ${spanOf(plan.window)} ${version}`);
    return state.last.get(s.seriesKey)!;
  } catch (error) {
    if (isInactive(error)) return "already opened: re-reading";
    const refused = refusalState(refusalId(error), spanOf(plan.window));
    if (refused) return refused;
    state.counters.failed++;
    notes.push(`open ${s.seriesKey} #${index} failed: ${failureText(error)}`);
    return `open failed: ${failureText(error).split("\n")[0]}`;
  }
}

export async function rollerPass(state: RollerState, deps: VenueDeps): Promise<PassResult> {
  const series = await readSeries(state);
  const notes: string[] = [];
  const regular = series.some((s) => basisOf(s.data) === "regular");
  if (regular) {
    const calendarNote = await deps.sessions.refresh();
    if (calendarNote !== "calendar fresh") notes.push(calendarNote);
  }
  const nowSec = Math.floor(Date.now() / 1000);
  const clock: PlanClock = {
    calendar: deps.sessions.calendar(), nowSec, leadSec: state.settings.leadSec, gapLeadSec: state.settings.gapLeadSec,
    minTradableSec: state.settings.minTradableSec, skips: deps.events.skips(), multipliers: deps.events.multipliers(), halts: deps.halts.board(),
    prelist: state.settings.prelist, prelistCadencesSec: state.settings.prelistCadencesSec,
    // The Pyth entitlement gate (S20) judges a Pyth version; C6: an attested version lists only while its named source can sign.
    pythUsable: (feedIdHex) => deps.pythIndex.usable(feedIdHex),
    sourceUnavailable: deps.sources ? (printSource) => deps.sources!.unavailable(printSource) : undefined,
  };
  const lanes: Record<string, string> = {};
  let wakeSec = nowSec + 15;
  // C-DAML-02: opening a Window needs the venue open (the reference's roller_open_window needs Normal). Open Windows
  // still resolve and settle; only new ones wait.
  const modeWhy = venueModeRefusalNow("open-window");
  const mode = venueMode();
  for (const s of series) {
    const basis = basisOf(s.data);
    if (!basis) {
      lanes[s.data.seriesKey] = "not a registry ticker";
      continue;
    }
    const plan = planByBasis(basis, planSeriesOf(s.data), clock);
    if (plan.kind === "open" && modeWhy) lanes[s.data.seriesKey] = venueModePausedState(mode.mode, mode.reason);
    else if (plan.kind === "open") lanes[s.data.seriesKey] = await open(state, s, plan, notes);
    else lanes[s.data.seriesKey] = plan.kind === "wait" && state.last.get(s.data.seriesKey) ? state.last.get(s.data.seriesKey)! : plan.state;
    if ((plan.kind === "wait" || plan.kind === "paused") && plan.wakeSec < wakeSec) wakeSec = plan.wakeSec;
    if (plan.kind === "open" && !modeWhy) wakeSec = nowSec;
  }
  const counts = Object.values(lanes).reduce<Record<string, number>>((acc, v) => ((acc[v.split(/[: #]/)[0]!] = (acc[v.split(/[: #]/)[0]!] ?? 0) + 1), acc), {});
  const summary = Object.entries(counts).map(([k, n]) => `${n} ${k}`).join(", ");
  return {
    why: [`${series.length} series (${summary || "none"})`, ...notes].join(" · "),
    detail: { lanes, counters: { ...state.counters }, nowSec },
    nextDelayMs: Math.min(15_000, Math.max(1_000, (wakeSec - nowSec) * 1000)),
  };
}
