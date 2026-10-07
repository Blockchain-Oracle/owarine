/**
 * A throwaway venue on a LOCAL sandbox, built with direct ledger calls: the parties, the desk, one short series and
 * its window, demo cash, a quote issued as the venue (standing in for ops' `/internal/quotes`), oracle prints and a
 * manual resolution. Used by the C4a seat-route integration run and its rejection probe; never against Noders (party
 * allocation and DAR upload are local-only in `@owarine/ledger`).
 */
import { TEMPLATE_IDS } from "@owarine/daml";
import type { CreatedEvent, JsTransaction, LedgerClient } from "@owarine/ledger";

export interface World {
  venue: string;
  resolver: string;
  auditor: string;
  oracles: [string, string, string];
  seatA: string;
  seatB: string;
  alice: string;
  bob: string;
  outsider: string;
  desk: string;
}

export interface Window {
  termsCid: string;
  stateCid: string;
  seriesCid: string;
  marketId: string;
  symbol: string;
  tradingStartMs: number;
  lockAtMs: number;
  expiryMs: number;
  cashUnit: bigint;
}

const iso = (ms: number) => new Date(Math.floor(ms / 1000) * 1000).toISOString().replace(".000Z", "Z");
const created = (tx: JsTransaction): CreatedEvent[] => tx.events.flatMap((e) => ("CreatedEvent" in e ? [e.CreatedEvent] : []));
const createdOf = (tx: JsTransaction, entity: string) => {
  const hit = created(tx).find((e) => e.templateId.endsWith(entity));
  if (!hit) throw new Error(`no ${entity} created in ${tx.updateId}`);
  return hit;
};

export function sandboxWorld(client: LedgerClient, run: string) {
  let seq = 0;
  const cmdId = (what: string) => `c4a-it:${run}:${what}:${++seq}`;
  const submit = (actAs: string[], commands: Parameters<LedgerClient["submitAndWaitForTransaction"]>[0]["commands"], what: string) =>
    client.submitAndWaitForTransaction({ actAs, commands, commandId: cmdId(what) }).then((r) => r.transaction);

  async function allocate(hint: string): Promise<string> {
    for (let i = 0; ; i++) {
      try {
        return (await client.allocateParty(`${hint}-${run}`)).party;
      } catch (error) {
        if (i > 30) throw error;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  async function setup(): Promise<World> {
    const [venue, resolver, auditor, o1, o2, o3, seatA, seatB, alice, bob, outsider] = await Promise.all(
      ["venue", "resolver", "auditor", "oracle1", "oracle2", "oracle3", "seat-a", "seat-b", "alice", "bob", "outsider"].map(allocate),
    );
    const tx = await submit([venue!], [{ CreateCommand: { templateId: TEMPLATE_IDS.VenueDesk, createArguments: { venue } } }], "desk");
    return {
      venue: venue!, resolver: resolver!, auditor: auditor!, oracles: [o1!, o2!, o3!],
      seatA: seatA!, seatB: seatB!, alice: alice!, bob: bob!, outsider: outsider!,
      desk: createdOf(tx, ":PM.Quote:VenueDesk").contractId,
    };
  }

  /** A series whose window 0 starts `startsInMs` from now and lasts `cadenceSec`; returns window 0, already open. */
  async function openWindow(
    w: World,
    o: { seriesKey: string; symbol: string; cadenceSec: number; lockLeadSec: number; startsAtMs: number; cashUnit?: bigint; closeAdmissionSec?: number; settleGraceSec?: number },
  ): Promise<Window> {
    const cashUnit = o.cashUnit ?? 10n;
    const series = {
      venue: w.venue, resolver: w.resolver, auditor: w.auditor, seriesKey: o.seriesKey, symbol: o.symbol,
      anchor: iso(o.startsAtMs), cadenceSec: String(o.cadenceSec), lockLeadSec: String(o.lockLeadSec), settleGraceSec: String(o.settleGraceSec ?? 600),
      cashUnit: cashUnit.toString(), nextIndex: "0", oracles: w.oracles, quorum: "2", maxDeviationBps: "50",
      policyVersions: [{
        version: "1", effectiveFrom: iso(o.startsAtMs - 3_600_000), validUntil: null, printSource: "attested:it",
        minDelaySec: "0", barLenSec: "60", openAdmissionSec: "-1", closeAdmissionSec: String(o.closeAdmissionSec ?? 120),
      }],
    };
    const made = await submit([w.venue], [{ CreateCommand: { templateId: TEMPLATE_IDS.Series, createArguments: series } }], "series");
    const seriesCid = createdOf(made, ":PM.Series:Series").contractId;
    const tx = await submit(
      [w.venue],
      [{ ExerciseCommand: { templateId: TEMPLATE_IDS.Series, contractId: seriesCid, choice: "Series_OpenWindow", choiceArgument: { index: "0" } } }],
      "open",
    );
    const terms = createdOf(tx, ":PM.Market:MarketTerms");
    const args = terms.createArgument as Record<string, string>;
    return {
      termsCid: terms.contractId,
      stateCid: createdOf(tx, ":PM.Market:WindowState").contractId,
      seriesCid: createdOf(tx, ":PM.Series:Series").contractId,
      marketId: args.marketId!,
      symbol: o.symbol,
      tradingStartMs: Date.parse(args.tradingStart!),
      lockAtMs: Date.parse(args.lockAt!),
      expiryMs: Date.parse(args.expiry!),
      cashUnit,
    };
  }

  /** Demo cash straight into a party's name (the venue and the owner both sign `VenueCash`). */
  async function fund(w: World, owner: string, amount: bigint, bucket = "demo"): Promise<string> {
    const tx = await submit(
      [w.venue, owner],
      [{ CreateCommand: { templateId: TEMPLATE_IDS.VenueCash, createArguments: { venue: w.venue, owner, amount: amount.toString(), bucket } } }],
      "fund",
    );
    return createdOf(tx, ":PM.Money:VenueCash").contractId;
  }

  /** What ops' quote issuer does: a venue shard, then `Desk_IssueQuote` for one user. */
  async function issueQuote(w: World, win: Window, q: { user: string; side: "SideUp" | "SideDown"; priceTicks: bigint; lots: bigint; fee: bigint; validUntilMs: number }) {
    const stake = q.lots * (1000n - q.priceTicks) * win.cashUnit;
    const shard = await fund(w, w.venue, stake, "shard");
    const tx = await submit(
      [w.venue],
      [{
        ExerciseCommand: {
          templateId: TEMPLATE_IDS.VenueDesk, contractId: w.desk, choice: "Desk_IssueQuote",
          choiceArgument: {
            shardCid: shard, user: q.user, termsCid: win.termsCid, pairId: `pair-${run}-${++seq}`, side: q.side,
            priceTicks: q.priceTicks.toString(), lots: q.lots.toString(), fee: q.fee.toString(), validUntil: iso(q.validUntilMs),
          },
        },
      }],
      "quote",
    );
    return createdOf(tx, ":PM.Quote:Quote");
  }

  async function prints(w: World, win: Window, boundaryMs: number, priceE8: bigint): Promise<string[]> {
    const out: string[] = [];
    for (const oracle of w.oracles) {
      const tx = await submit(
        [oracle],
        [{
          CreateCommand: {
            templateId: TEMPLATE_IDS.PriceQuote,
            createArguments: {
              oracle, venue: w.venue, resolver: w.resolver, symbol: win.symbol, boundaryT: iso(boundaryMs), priceE8: priceE8.toString(),
              barStart: iso(boundaryMs - 60_000), barLenSec: "60", fetchedAt: iso(Math.max(boundaryMs, Date.now())), payloadHash: "sha256:it", policyVersion: "1",
            },
          },
        }],
        "print",
      );
      out.push(createdOf(tx, ":PM.Oracle:PriceQuote").contractId);
    }
    return out;
  }

  async function recordOpen(w: World, win: Window, priceE8: bigint): Promise<string> {
    const quoteCids = await prints(w, win, win.tradingStartMs, priceE8);
    const tx = await submit(
      [w.resolver],
      [{ ExerciseCommand: { templateId: TEMPLATE_IDS.MarketTerms, contractId: win.termsCid, choice: "Terms_RecordOpen", choiceArgument: { stateCid: win.stateCid, quoteCids } } }],
      "record-open",
    );
    return createdOf(tx, ":PM.Market:OpenPrint").contractId;
  }

  async function resolve(w: World, win: Window, openCid: string, priceE8: bigint): Promise<string> {
    const quoteCids = await prints(w, win, win.expiryMs, priceE8);
    const tx = await submit(
      [w.resolver],
      [{ ExerciseCommand: { templateId: TEMPLATE_IDS.MarketTerms, contractId: win.termsCid, choice: "Terms_Resolve", choiceArgument: { openCid, quoteCids } } }],
      "resolve",
    );
    return createdOf(tx, ":PM.Market:Resolution").contractId;
  }

  return { setup, openWindow, fund, issueQuote, recordOpen, resolve, submit, iso };
}

export async function waitForLedger(client: LedgerClient, tries = 90): Promise<void> {
  for (let i = 0; ; i++) {
    try {
      await client.version();
      return;
    } catch (error) {
      if (i > tries) throw error;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}
