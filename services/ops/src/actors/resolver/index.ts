/**
 * The resolver proposer (plan "Venue operations", new actor): as the resolver party, after each boundary's prints are
 * in (T + 10 s, K-025), it records every Window's open print (`Terms_RecordOpen`, `openprint:<termsCid>`) and resolves
 * or voids every closed Window (`Terms_Resolve` / `Terms_Void`, `resolve:<termsCid>`). The venue can do neither: the
 * three choices are the resolver's, and the ledger checks the quorum, the deviation and the deadlines itself.
 *
 * The void-or-wait decision is the settler's unchanged `decideSettle` (prints present = a quorum of counted quotes);
 * recording the open print is the step Canton adds, because the issuer quotes only once an `OpenPrint` exists.
 *
 * Committee events (C6d, engine 0.4.0) take their own path: an event has an `EventState`, never a `WindowState`, so the
 * price path above can never decide one (and skips any terms an `EventTerms` names). For each live `EventState` the
 * resolver counts the `EventAttestation`s as the ledger will (`event.ts`) and runs `Event_Resolve` (unanimous → Up/Down,
 * mixed → SourceDisagreement void) or, past the deadline, `Event_Void`, under the same `resolve:<termsCid>` id.
 */
import { TEMPLATE_IDS } from "@agari/daml";
import {
  cmd, decodeEventAttestation, decodeEventState, decodeEventTerms, decodeEventVerdict, decodeOpenPrint, decodePriceQuote, decodeResolution,
  decodeWindowState, failureText, isInactive, learnTerms, pick, readActive, recordOpenCommandId, refusalId, resolveCommandId, submit, templateSuffix, type Active,
  type PriceQuoteC, type RoleSession, type TermsC,
} from "@agari/markets/ops/canton";
import { runActor, type PassResult } from "../../runtime/actor";
import { decideSettle } from "../settler/decide";
import { createVenueContext, type VenueContext } from "../venue/context";
import { emitVenueEvent } from "../venue/events";
import { decideEvent, eventEvidence } from "./event";
import { evidenceFor, lowerMedian, slotRule } from "./select";

/** Ledger time may trail the wall clock a little; a void is sent this long after its deadline. */
const VOID_MARGIN_SEC = 2;
/**
 * A quorum is enough, but every oracle is better evidence: with fewer than all of them counted, the resolver waits
 * until the boundary plus this (the feeders post at T + 10 s) before it records or resolves on the quorum alone.
 */
const ALL_ORACLES_WAIT_SEC = 16;
const ready = (t: TermsC, boundarySec: number, counted: number, nowSec: number) => counted >= t.quorum && (counted >= t.oracles.length || nowSec >= boundarySec + ALL_ORACLES_WAIT_SEC);

interface ResolverState {
  session: RoleSession;
  terms: Map<string, TermsC>;
  /** Terms whose resolve or void landed (or was found done), so they are never re-tried. */
  finished: Set<string>;
  counters: { recordedOpen: number; resolved: number; voided: number; failed: number; eventsResolved: number; eventsVoided: number };
  log: (why: string) => void;
}

const label = (t: TermsC) => `${t.marketId} ${new Date(t.tradingStartSec * 1000).toISOString().slice(11, 16)}Z`;
const priceText = (e8: bigint | null) => (e8 === null ? "-" : `${e8 / 100_000_000n}.${(e8 % 100_000_000n).toString().padStart(8, "0").replace(/0+$/, "") || "0"}`);

/** Learns each new Window's terms by id (C4g): paging MarketTerms returns every Window the venue ever ran. */
async function knownTerms(state: ResolverState, cids: readonly string[]): Promise<void> {
  await learnTerms(state.session, state.terms, cids);
}

/** One event's `Event_Resolve` or `Event_Void`: the outcome is the verdict's (YES / NO / void with its reason). */
async function sendEvent(state: ResolverState, what: "resolve" | "void", termsCid: string, marketId: string, command: ReturnType<typeof cmd.resolveEvent>): Promise<string> {
  const tag = `event ${marketId}`;
  try {
    const out = await submit(state.session, { commandId: resolveCommandId(termsCid), commands: [command] });
    state.finished.add(termsCid);
    if (out.kind === "dry") return `${out.note} (${what} ${tag})`;
    const v = out.created.find((e) => templateSuffix(e.templateId) === templateSuffix(TEMPLATE_IDS.EventVerdict));
    if (!v) return `${what} ${tag} landed earlier (recovered)`;
    const verdict = decodeEventVerdict(v.createArgument);
    const answers = verdict.attestations.map((a) => (a.answer ? "YES" : "NO")).join(",") || "none";
    if (verdict.answer !== null) {
      state.counters.eventsResolved++;
      emitVenueEvent({ kind: "resolved", marketId, outcome: verdict.answer ? "Up" : "Down", openPriceE8: null, closePriceE8: null, signers: verdict.attestations.length, atMs: Date.now() });
      return `resolved ${tag} ${verdict.answer ? "YES" : "NO"} (${answers}; ${out.ms} ms)`;
    }
    state.counters.eventsVoided++;
    const reason = verdict.voidReason ? `${verdict.voidReason.tag}(${verdict.voidReason.slot})` : "void";
    emitVenueEvent({ kind: "voided", marketId, reason, atMs: Date.now() });
    return `voided ${tag}: ${reason} (${answers})`;
  } catch (error) {
    if (isInactive(error)) {
      state.finished.add(termsCid);
      return `${what} ${tag}: already done`;
    }
    state.counters.failed++;
    return `${what} ${tag} failed: ${refusalId(error) ?? ""} ${failureText(error)}`;
  }
}

async function send(state: ResolverState, what: "open" | "resolve" | "void", termsCid: string, t: TermsC, commandId: string, command: ReturnType<typeof cmd.resolve>): Promise<string> {
  try {
    const out = await submit(state.session, { commandId, commands: [command] });
    if (out.kind === "dry") {
      // A dry resolver prepares each Window's step once, not every pass.
      state.finished.add(termsCid);
      return `${out.note} (${what} ${label(t)})`;
    }
    if (what !== "open") state.finished.add(termsCid);
    const res = out.created.find((e) => templateSuffix(e.templateId) === templateSuffix(TEMPLATE_IDS.Resolution));
    const open = out.created.find((e) => templateSuffix(e.templateId) === templateSuffix(TEMPLATE_IDS.OpenPrint));
    if (open) {
      state.counters.recordedOpen++;
      const op = decodeOpenPrint(open.createArgument);
      emitVenueEvent({ kind: "open-recorded", marketId: t.marketId, openPriceE8: op.openPriceE8.toString(), signers: op.signers, atMs: Date.now() });
      return `open recorded ${label(t)} at ${priceText(op.openPriceE8)} (${op.signers} oracles, ${out.ms} ms)`;
    }
    if (res) {
      state.finished.add(termsCid);
      const r = decodeResolution(res.createArgument);
      if (r.outcome) {
        state.counters.resolved++;
        emitVenueEvent({ kind: "resolved", marketId: t.marketId, outcome: r.outcome === "SideUp" ? "Up" : "Down", openPriceE8: r.openPriceE8?.toString() ?? null, closePriceE8: r.closePriceE8?.toString() ?? null, signers: r.signers, atMs: Date.now() });
        return `resolved ${label(t)} ${r.outcome === "SideUp" ? "Up" : "Down"} ${priceText(r.openPriceE8)} → ${priceText(r.closePriceE8)} (${r.signers} oracles, ${out.ms} ms)`;
      }
      state.counters.voided++;
      const reason = r.voidReason ? `${r.voidReason.tag}(${r.voidReason.slot})` : "void";
      emitVenueEvent({ kind: "voided", marketId: t.marketId, reason, atMs: Date.now() });
      return `voided ${label(t)}: ${reason}`;
    }
    return `${what} ${label(t)} landed earlier (recovered)`;
  } catch (error) {
    if (isInactive(error)) {
      if (what !== "open") state.finished.add(termsCid);
      return `${what} ${label(t)}: already done`;
    }
    state.counters.failed++;
    return `${what} ${label(t)} failed: ${refusalId(error) ?? ""} ${failureText(error)}`;
  }
}

export async function resolverPass(state: ResolverState): Promise<PassResult> {
  const acs = await readActive(state.session, [
    TEMPLATE_IDS.WindowState, TEMPLATE_IDS.OpenPrint, TEMPLATE_IDS.PriceQuote, TEMPLATE_IDS.EventTerms, TEMPLATE_IDS.EventState, TEMPLATE_IDS.EventAttestation,
  ]);
  const eventTerms = pick(acs, TEMPLATE_IDS.EventTerms, decodeEventTerms);
  const eventCids = new Set(eventTerms.map((e) => e.data.termsCid));
  // The price path never decides an event (it has no WindowState; this also skips any terms an EventTerms names).
  const states = pick(acs, TEMPLATE_IDS.WindowState, decodeWindowState).filter((s) => !eventCids.has(s.data.termsCid));
  const opens = pick(acs, TEMPLATE_IDS.OpenPrint, decodeOpenPrint).filter((o) => !eventCids.has(o.data.termsCid));
  const quotes: Active<PriceQuoteC>[] = pick(acs, TEMPLATE_IDS.PriceQuote, decodePriceQuote);
  await knownTerms(state, [...states.map((s) => s.data.termsCid), ...opens.map((o) => o.data.termsCid)]);
  const nowSec = Math.floor(Date.now() / 1000);
  const jobs: Array<Promise<string>> = [];
  let wakeSec = nowSec + 10;

  for (const st of states) {
    const termsCid = st.data.termsCid;
    const t = state.terms.get(termsCid);
    if (!t || state.finished.has(termsCid)) continue;
    const rule = slotRule(t, "open");
    const ev = evidenceFor(rule, quotes);
    if (ready(t, rule.boundarySec, ev.length, nowSec) && nowSec >= rule.earliestSec && nowSec <= t.openDeadlineSec) {
      jobs.push(send(state, "open", termsCid, t, recordOpenCommandId(termsCid), cmd.recordOpen(termsCid, st.cid, ev.map((q) => q.cid))));
      continue;
    }
    const action = decideSettle({
      nowSec: nowSec - VOID_MARGIN_SEC, state: 0, expirySec: t.expirySec, openDeadlineSec: t.openDeadlineSec, closeDeadlineSec: t.closeDeadlineSec,
      prints: { open: false, close: false, checkOpen: false, checkClose: false }, check: { configured: false, admissionSec: 0 },
      bookReleased: true, ledgerClosed: true, dependents: 0, resolvedSec: 0, retentionSec: 0, redeemGraceSec: 0, bookOrderCount: null, seats: null,
    });
    if (action.kind === "void") jobs.push(send(state, "void", termsCid, t, resolveCommandId(termsCid), cmd.voidTerms(termsCid, { tag: "BeforeOpen", stateCid: st.cid }, ev.map((q) => q.cid))));
    else wakeSec = Math.min(wakeSec, Math.max(nowSec + 1, rule.earliestSec + 5));
  }

  for (const op of opens) {
    const termsCid = op.data.termsCid;
    const t = state.terms.get(termsCid);
    if (!t || state.finished.has(termsCid)) continue;
    const rule = slotRule(t, "close");
    const ev = evidenceFor(rule, quotes);
    const action = decideSettle({
      nowSec, state: 0, expirySec: t.expirySec, openDeadlineSec: t.openDeadlineSec, closeDeadlineSec: t.closeDeadlineSec + VOID_MARGIN_SEC,
      prints: { open: true, close: ready(t, rule.boundarySec, ev.length, nowSec) && nowSec >= rule.earliestSec, checkOpen: false, checkClose: false }, check: { configured: false, admissionSec: 0 },
      bookReleased: true, ledgerClosed: true, dependents: 0, resolvedSec: 0, retentionSec: 0, redeemGraceSec: 0, bookOrderCount: null, seats: null,
    });
    if (action.kind === "settle" && nowSec <= t.closeDeadlineSec) {
      const median = lowerMedian(ev.map((q) => q.data.priceE8));
      state.log(`${label(t)} close quorum ${ev.length}/${t.oracles.length}, median ${priceText(median)}: resolving`);
      jobs.push(send(state, "resolve", termsCid, t, resolveCommandId(termsCid), cmd.resolve(termsCid, op.cid, ev.map((q) => q.cid))));
    } else if (action.kind === "void") {
      jobs.push(send(state, "void", termsCid, t, resolveCommandId(termsCid), cmd.voidTerms(termsCid, { tag: "AfterOpen", openCid: op.cid }, ev.map((q) => q.cid))));
    } else if (action.kind === "wait") wakeSec = Math.min(wakeSec, Math.max(nowSec + 1, action.untilSec));
  }

  const eventStates = pick(acs, TEMPLATE_IDS.EventState, decodeEventState);
  const attestations = pick(acs, TEMPLATE_IDS.EventAttestation, decodeEventAttestation);
  for (const st of eventStates) {
    const termsCid = st.data.termsCid;
    const ev = eventTerms.find((e) => e.data.termsCid === termsCid);
    if (!ev || state.finished.has(termsCid)) continue;
    const counted = eventEvidence(ev.data, attestations);
    const action = decideEvent(ev.data, counted, nowSec, VOID_MARGIN_SEC);
    const cids = counted.map((a) => a.cid);
    if (action.kind === "resolve") {
      state.log(`event ${ev.data.marketId} "${ev.data.question}": ${action.why}, resolving`);
      jobs.push(sendEvent(state, "resolve", termsCid, ev.data.marketId, cmd.resolveEvent(ev.cid, st.cid, cids)));
    } else if (action.kind === "void") {
      jobs.push(sendEvent(state, "void", termsCid, ev.data.marketId, cmd.voidEvent(ev.cid, st.cid, cids)));
    } else wakeSec = Math.min(wakeSec, Math.max(nowSec + 1, action.untilSec));
  }

  const notes = await Promise.all(jobs);
  for (const n of notes) state.log(n);
  const c = state.counters;
  return {
    why: `${states.length} awaiting open, ${opens.length} awaiting close, ${eventStates.length} event(s) open; recorded ${c.recordedOpen}, resolved ${c.resolved}, voided ${c.voided}, events ${c.eventsResolved} resolved / ${c.eventsVoided} void, failed ${c.failed}${state.session.dryRun ? " · DRY RUN" : ""}`,
    detail: { counters: { ...c } },
    nextDelayMs: jobs.length ? 500 : Math.min(5_000, Math.max(1_000, (wakeSec - nowSec) * 1000)),
  };
}

export async function startResolver(log: (why: string) => void, venue: VenueContext = createVenueContext()): Promise<{ stop: () => void }> {
  const session = venue.session("resolver");
  if (!session) {
    log("RESOLVER_PARTY and the parties file are missing: nothing resolves");
    return runActor({ name: "resolver", log, dryRun: true, everyMs: 60_000, pass: async () => ({ why: "no resolver party: scanning and reporting only" }) });
  }
  const state: ResolverState = { session, terms: new Map(), finished: new Set(), counters: { recordedOpen: 0, resolved: 0, voided: 0, failed: 0, eventsResolved: 0, eventsVoided: 0 }, log };
  log(`resolver as ${session.party.split("::")[0]}`);
  return runActor({ name: "resolver", log, dryRun: session.dryRun, everyMs: 2_000, pass: () => resolverPass(state) });
}
