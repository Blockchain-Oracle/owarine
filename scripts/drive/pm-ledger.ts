// Ledger helpers for the drive scripts on a LOCAL sandbox (auth none): party allocation and the PM engine's commands
// in their Daml-LF JSON shapes. Server-only; nothing here runs against Noders (parties there come from the Console).
import { TEMPLATE_IDS } from "@owarine/daml";
import { createLedgerClient, eventFormat, noAuth, type Command, type CreatedEvent, type JsTransaction, type LedgerClient } from "@owarine/ledger";

export const T = TEMPLATE_IDS;
export type Side = "SideUp" | "SideDown";

export const iso = (sec: number) => new Date(sec * 1000).toISOString();
export const nowSec = () => Math.floor(Date.now() / 1000);
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export async function untilSec(sec: number, label: string, log: (s: string) => void): Promise<void> {
  const wait = sec * 1000 - Date.now();
  if (wait > 0) {
    log(`  … waiting ${(wait / 1000).toFixed(1)} s for ${label}`);
    await sleep(wait);
  }
}

const shortName = (templateId: string) => templateId.split(":").slice(-2).join(":");
export const createdOf = (tx: JsTransaction, template: string): CreatedEvent[] =>
  tx.events.flatMap((e) => ("CreatedEvent" in e && shortName(e.CreatedEvent.templateId) === shortName(template) ? [e.CreatedEvent] : []));
export const oneCreated = (tx: JsTransaction, template: string, pick: (a: Record<string, unknown>) => boolean = () => true): string => {
  const hit = createdOf(tx, template).find((c) => pick(c.createArgument as Record<string, unknown>));
  if (!hit) throw new Error(`no ${template} created in ${tx.updateId}`);
  return hit.contractId;
};

export const create = (templateId: string, createArguments: unknown): Command => ({ CreateCommand: { templateId, createArguments } });
export const exercise = (templateId: string, contractId: string, choice: string, choiceArgument: unknown = {}): Command => ({
  ExerciseCommand: { templateId, contractId, choice, choiceArgument },
});

export interface Session {
  c: LedgerClient;
  run: string;
  /** `viewAs` widens the returned transaction to more parties' views (sandbox only: no auth). */
  submit(actAs: string, commandId: string, commands: Command[], viewAs?: string[]): Promise<JsTransaction>;
}

export async function localSession(baseUrl: string, userId: string): Promise<Session> {
  const c = createLedgerClient({ baseUrl, auth: noAuth(), userId });
  for (let i = 0; ; i++) {
    try {
      await c.version();
      break;
    } catch (e) {
      if (i > 90) throw e;
      await sleep(1000);
    }
  }
  const run = Date.now().toString(36);
  return {
    c,
    run,
    async submit(actAs, commandId, commands, viewAs = []) {
      const r = await c.submitAndWaitForTransaction({
        actAs: [actAs],
        commandId: `${commandId}:${run}`,
        commands,
        transactionFormat: { transactionShape: "TRANSACTION_SHAPE_ACS_DELTA", eventFormat: eventFormat({ parties: [actAs, ...viewAs] }) },
      });
      return r.transaction;
    },
  };
}

/** A fresh sandbox rejects allocation for a few seconds after /v2/version answers. */
export async function allocate(s: Session, hint: string): Promise<string> {
  for (let i = 0; ; i++) {
    try {
      return (await s.c.allocateParty(`${hint}-${s.run}`)).party;
    } catch (e) {
      if (i > 30) throw e;
      await sleep(1000);
    }
  }
}

export interface SeriesSpec {
  venue: string;
  resolver: string;
  auditor: string;
  oracles: string[];
  seriesKey: string;
  symbol: string;
  anchorSec: number;
  cadenceSec: number;
  lockLeadSec: number;
  settleGraceSec: number;
  cashUnit: number;
  closeAdmissionSec: number;
  maxDeviationBps: number;
}

export const seriesArgs = (s: SeriesSpec) => ({
  venue: s.venue, resolver: s.resolver, auditor: s.auditor, seriesKey: s.seriesKey, symbol: s.symbol, anchor: iso(s.anchorSec),
  cadenceSec: String(s.cadenceSec), lockLeadSec: String(s.lockLeadSec), settleGraceSec: String(s.settleGraceSec), cashUnit: String(s.cashUnit),
  nextIndex: "0", oracles: s.oracles, quorum: "2", maxDeviationBps: String(s.maxDeviationBps),
  policyVersions: [{
    version: "1", effectiveFrom: iso(s.anchorSec - 3600), validUntil: null, printSource: "attested", minDelaySec: "0", barLenSec: "60",
    openAdmissionSec: "-1", closeAdmissionSec: String(s.closeAdmissionSec),
  }],
});

export const priceQuote = (oracle: string, venue: string, resolver: string, symbol: string, boundarySec: number, priceE8: number) =>
  create(T.PriceQuote, {
    oracle, venue, resolver, symbol, boundaryT: iso(boundarySec), priceE8: String(priceE8), barStart: iso(boundarySec - 60), barLenSec: "60",
    fetchedAt: iso(boundarySec + 2), payloadHash: `sha256:${symbol}:${boundarySec}:${oracle.slice(0, 8)}`, policyVersion: "1",
  });

export interface Window {
  key: string;
  termsCid: string;
  stateCid: string;
  openCid?: string;
  resolutionCid?: string;
}
