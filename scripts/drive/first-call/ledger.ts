/**
 * What `first-call.ts` does on the ledger itself, as the roles the platform user acts for: reads with offsets (so
 * every row can name its update id), and the two drive-owned markets. Those are the void market and the stale market.
 * They sit on their own Series (`first-call-void`, `first-call-stale`) whose symbols are not registry tickers, so ops'
 * roller leaves them alone ("not a registry ticker"). The drive opens each Window with `Series_OpenWindowSpan`,
 * stands in for ops' quote issuer (`Desk_IssueQuote` from a fresh venue shard), and posts the oracles' prints itself.
 * That lets it make the three prints disagree.
 */
import { TEMPLATE_IDS } from "@agari/daml";
import { fee as feeOf, type Command, type CreatedEvent, type LedgerClient } from "@agari/ledger";
import { cmd, decodeSeries, decodeTerms, submit, templateSuffix, type RoleSession, type SeriesC, type TermsC } from "@agari/markets/ops/canton";

export interface Roles {
  venue: string;
  resolver: string;
  auditor: string;
  oracles: [string, string, string];
}

export interface Row<T> {
  cid: string;
  data: T;
  offset: number;
}

export const FEE_BPS = 200n;
export const CASH_UNIT = 1000n;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const nowSec = () => Math.floor(Date.now() / 1000);
const createdOf = (created: readonly CreatedEvent[], templateId: string) => created.find((e) => templateSuffix(e.templateId) === templateSuffix(templateId));

/** Polls `probe` every `everyMs` until it returns a value; throws naming `what` after `timeoutMs`. */
export async function waitFor<T>(what: string, probe: () => Promise<T | null | undefined>, timeoutMs: number, everyMs = 2_000): Promise<T> {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const got = await probe();
    if (got !== null && got !== undefined) return got;
    if (Date.now() > until) throw new Error(`timed out after ${Math.round(timeoutMs / 1000)} s waiting for ${what}`);
    await sleep(everyMs);
  }
}

export function ledgerKit(client: LedgerClient, roles: Roles, run: string) {
  let seq = 0;
  const session = (role: string, party: string): RoleSession => ({ role, party, client, dryRun: false });

  async function write(role: string, party: string, what: string, commands: Command[], alsoActAs?: string[]): Promise<{ updateId: string; created: CreatedEvent[] }> {
    const out = await submit(session(role, party), { commandId: `first-call:${run}:${what}:${++seq}`, commands, ...(alsoActAs ? { alsoActAs } : {}) });
    if (out.kind !== "done") throw new Error(`${what}: the session is dry`);
    return { updateId: out.transaction.updateId, created: out.created };
  }

  /** Active contracts of one template as one party, decoded, with the offset each was created at. */
  async function acs<T>(party: string, templateId: string, decode: (v: unknown) => T): Promise<Row<T>[]> {
    const { contracts } = await client.activeContracts({ parties: [party], templateIds: [templateId], maxPageSize: 500 });
    return contracts
      .filter((c) => templateSuffix(c.createdEvent.templateId) === templateSuffix(templateId))
      .map((c) => ({ cid: c.createdEvent.contractId, data: decode(c.createdEvent.createArgument), offset: c.createdEvent.offset }));
  }

  /** The update id of the transaction at `offset`, as `party` sees it; the offset itself when the node will not say. */
  async function updateIdAt(party: string, offset: number): Promise<string> {
    try {
      const r = await client.http.request<{ update?: { Transaction?: { value?: { updateId?: string } } } }>("POST", "/v2/updates/update-by-offset", {
        json: {
          offset,
          updateFormat: {
            includeTransactions: {
              transactionShape: "TRANSACTION_SHAPE_ACS_DELTA",
              eventFormat: { filtersByParty: { [party]: { cumulative: [{ identifierFilter: { WildcardFilter: { value: { includeCreatedEventBlob: false } } } }] } }, verbose: false },
            },
          },
        },
      });
      return r.update?.Transaction?.value?.updateId ?? `offset ${offset}`;
    } catch {
      return `offset ${offset}`;
    }
  }

  /** The drive's own Series, created once per participant and reused by every run (ops never rolls it). */
  async function ensureSeries(seriesKey: string, symbol: string): Promise<Row<SeriesC>> {
    const have = (await acs(roles.venue, TEMPLATE_IDS.Series, decodeSeries)).find((s) => s.data.seriesKey === seriesKey && s.data.venue === roles.venue);
    if (have) return have;
    const anchorSec = Math.floor(nowSec() / 60) * 60 - 60;
    await write("venue", roles.venue, `series-${seriesKey}`, [
      cmd.createSeries({
        venue: roles.venue, resolver: roles.resolver, auditor: roles.auditor, seriesKey, symbol, anchorSec, cadenceSec: 60, lockLeadSec: 10,
        settleGraceSec: 1, cashUnit: CASH_UNIT, nextIndex: 0, oracles: roles.oracles, quorum: 2, maxDeviationBps: 100,
        policy: { version: 1, effectiveFromSec: anchorSec - 3_600, printSource: "attested:first-call", minDelaySec: 0, barLenSec: 60, openAdmissionSec: -1, closeAdmissionSec: 0 },
      }),
    ]);
    return waitFor(`Series ${seriesKey}`, async () => (await acs(roles.venue, TEMPLATE_IDS.Series, decodeSeries)).find((s) => s.data.seriesKey === seriesKey), 60_000);
  }

  /** A Window with the drive's own boundaries, at the Series' next index. */
  async function openSpan(seriesKey: string, symbol: string, w: { lockInSec: number }): Promise<{ terms: Row<TermsC>; stateCid: string; updateId: string }> {
    let series = await ensureSeries(seriesKey, symbol);
    // A Window may not start before the last one's expiry, and its open print only counts after its start: when the
    // previous run's Window is still live, wait it out so this one starts in the past.
    const last = series.data.lastExpirySec ?? 0;
    if (last >= nowSec() - 1) {
      await sleep((last - nowSec() + 2) * 1000);
      series = await ensureSeries(seriesKey, symbol);
    }
    const start = nowSec() - 1;
    const lockAtSec = start + w.lockInSec;
    const out = await write("venue", roles.venue, `open-${seriesKey}`, [cmd.openWindowSpan(series.cid, { index: series.data.nextIndex, tradingStartSec: start, lockAtSec, expirySec: lockAtSec + 1 })]);
    const t = createdOf(out.created, TEMPLATE_IDS.MarketTerms)!;
    const state = createdOf(out.created, TEMPLATE_IDS.WindowState)!;
    return { terms: { cid: t.contractId, data: decodeTerms(t.createArgument), offset: t.offset }, stateCid: state.contractId, updateId: out.updateId };
  }

  /** What ops' issuer does, for a Window ops does not quote: a venue shard exactly the venue's stake, then `Desk_IssueQuote`. */
  async function issueQuote(terms: Row<TermsC>, user: string, o: { side: "SideUp" | "SideDown"; priceTicks: number; lots: bigint }) {
    const desk = await waitFor("the VenueDesk", async () => (await client.activeContracts({ parties: [roles.venue], templateIds: [TEMPLATE_IDS.VenueDesk] })).contracts[0]?.createdEvent.contractId, 30_000);
    const stake = o.lots * BigInt(1000 - o.priceTicks) * terms.data.cashUnit;
    const shard = await write("venue", roles.venue, "shard", [cmd.createShard(roles.venue, stake)]);
    const shardCid = createdOf(shard.created, TEMPLATE_IDS.VenueCash)!.contractId;
    const fee = feeOf(o.lots, BigInt(o.priceTicks), terms.data.cashUnit, FEE_BPS);
    const issued = await write("venue", roles.venue, "quote", [
      cmd.issueQuote(desk, { shardCid, user, termsCid: terms.cid, pairId: `first-call-${run}-${++seq}`, side: o.side, priceTicks: o.priceTicks, lots: o.lots, fee, validUntilSec: terms.data.lockAtSec }),
    ]);
    const quote = createdOf(issued.created, TEMPLATE_IDS.Quote)!;
    return { quoteCid: quote.contractId, cost: o.lots * BigInt(o.priceTicks) * terms.data.cashUnit, fee, updateId: issued.updateId };
  }

  /** One print per oracle at `boundarySec`, the prices in oracle order. */
  async function prints(terms: Row<TermsC>, boundarySec: number, pricesE8: readonly bigint[]): Promise<{ quoteCids: string[]; updateIds: string[] }> {
    const quoteCids: string[] = [];
    const updateIds: string[] = [];
    for (const [i, oracle] of roles.oracles.entries()) {
      const out = await write("oracle", oracle, "print", [
        cmd.createPriceQuote({
          oracle, venue: roles.venue, resolver: roles.resolver, symbol: terms.data.symbol, boundarySec, priceE8: pricesE8[i]!, barLenSec: 60,
          fetchedAtSec: Math.max(boundarySec, nowSec()), payloadHash: `sha256:first-call-${run}-${i}`, policyVersion: terms.data.policyVersion,
        }),
      ]);
      quoteCids.push(createdOf(out.created, TEMPLATE_IDS.PriceQuote)!.contractId);
      updateIds.push(out.updateId);
    }
    return { quoteCids, updateIds };
  }

  /** `Terms_RecordOpen` as the resolver: a void `Resolution` when the prints disagree, else the `OpenPrint`. */
  async function recordOpen(terms: Row<TermsC>, stateCid: string, quoteCids: readonly string[]) {
    const out = await write("resolver", roles.resolver, "record-open", [cmd.recordOpen(terms.cid, stateCid, quoteCids)]);
    return { resolution: createdOf(out.created, TEMPLATE_IDS.Resolution), open: createdOf(out.created, TEMPLATE_IDS.OpenPrint), updateId: out.updateId };
  }

  return { write, acs, updateIdAt, ensureSeries, openSpan, issueQuote, prints, recordOpen };
}

export type LedgerKit = ReturnType<typeof ledgerKit>;
