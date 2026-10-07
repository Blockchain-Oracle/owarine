/**
 * The venue's contracts, shared by the local sandbox (`bootstrap-local.ts`) and DevNet (`bootstrap-devnet.ts`, C2y):
 * the VenueDesk, K venue cash shards, the Series of every lane family, the ticket reserves with their LP seed, and
 * (through `bootstrap-games.ts`) the duel arena and the season pool. Nothing here allocates a party or uploads a DAR:
 * the callers do that (local) or Abu does it in the Noders Console (DevNet).
 *
 * Idempotent per piece: whatever the venue already sees on the ledger is left as it is, so a re-run only fills gaps.
 * With `dryRun` every write is a `prepare` (interactive submission, step 1) against live ledger state and nothing is
 * executed; a write that needs an earlier write's contract (the LP's accept, the reserve's supplies, the first NAV
 * statement, the season funding) is named in the log and not prepared.
 */
import type { Command, CreatedEvent, LedgerClient } from "@owarine/ledger";
import { TEMPLATE_IDS, TICKET_TEMPLATE_IDS } from "@owarine/daml";
import {
  attestedPrintSource, BAR_LEN_SEC, BASKET_TICKERS, CRYPTO_CADENCES_SEC, CRYPTO_PHASES_SEC, CRYPTO_SYMBOLS, EXCHANGE_PRINT_SOURCE, LAUNCH_TICKERS, laneKey, PRE_IPO_TICKERS,
  SOURCE_TIMING, TICKERS, TOKEN_LANE_TICKERS, VALUATION_TICKERS,
} from "@owarine/core/market";
import { GAP_CADENCE_SEC } from "@owarine/core/types";
import { cmd, decodeSeries, decodeVenueCash, pick, readActive, submit, type RoleSession } from "@owarine/markets/ops/canton";
import { decodeLpShare, decodeNavStatement, decodeRiskBook, productOf, riskParamsFor, tcmd, TICKET_RESERVES } from "@owarine/markets/ops/tickets";
import { ORACLE_ROLES, type CantonRole } from "../../services/ops/src/runtime/keys";
import { basketVersions, equityVersions, loadPriceSources, preIpoVersions, tokenLaneVersions, valuationVersions, type LaneVersion } from "../../services/ops/src/prices/lane-versions";
import { bootstrapGames } from "../bootstrap-games";
import { bootstrapMaker } from "../bootstrap-maker";

export const CASH_UNIT = 1000n;
export const POLICY_VERSION = 1;

/** One write the bootstrap sent (or prepared): what an acceptance row needs. */
export interface SentWrite {
  role: string;
  commandId: string;
  commands: number;
  /** The update id of an executed write; absent for a dry-run prepare. */
  updateId?: string;
  dry: boolean;
}

export interface VenueBootstrapOptions {
  client: LedgerClient;
  parties: Record<CantonRole, string>;
  dryRun: boolean;
  /** Suffix that makes this run's command ids unique. */
  run: string;
  shards: number;
  shardBase: bigint;
  /** Lane families: crypto, regular, gap, token, preipo, basket, valuation. */
  lanes: ReadonlySet<string>;
  /** Credits (base units) each ticket reserve is seeded with, in four supplies. */
  reserveSeedBase: bigint;
  tickets: boolean;
  /** The maker vault's book, its reserve and the LP seed (C2d, K-092). */
  maker: boolean;
  games: boolean;
  log: (s: string) => void;
  /** Observes every write, executed or prepared. */
  onWrite?: (w: SentWrite) => void;
}

/** A writer bound to the run: submits (or prepares) as one role and returns the created events (none when dry). */
export type Writer = (role: string, party: string, commandId: string, commands: Command[]) => Promise<CreatedEvent[]>;

export function makeWriter(client: LedgerClient, dryRun: boolean, onWrite?: (w: SentWrite) => void): Writer {
  return async (role, party, commandId, commands) => {
    const s: RoleSession = { role, party, client, dryRun };
    const out = await submit(s, { commandId, commands });
    if (out.kind === "dry") {
      onWrite?.({ role, commandId, commands: commands.length, dry: true });
      return [];
    }
    onWrite?.({ role, commandId, commands: commands.length, updateId: out.transaction.updateId, dry: false });
    return out.created;
  };
}

interface LaneSpec {
  seriesKey: string;
  /** What the lane's prints price: the crypto asset, the stock, the xStock (`TSLAx`), the pre-IPO name or basket. */
  symbol: string;
  cadenceSec: number;
  /** A staggered Series' anchor offset from the cadence grid (core `CRYPTO_PHASES_SEC`); 0 for most. */
  phaseSec?: number;
  lockLeadSec: number;
  /** Policy versions, oldest first; each names its attested source (core `attestedPrintSource`). */
  versions: Array<{ effectiveFromSec: number; validUntilSec: number | null; printSource: string; minDelaySec: number; barLenSec: number; openAdmissionSec: number; closeAdmissionSec: number }>;
}

/**
 * How long before expiry each crypto cadence stops taking quotes. The reference locks a Regular Window at its expiry;
 * on Canton a quote must be valid until `lockAt` and settle behind the close print, so every lane keeps a lead that
 * grows with the cadence (1 m and 5 m as C3 set them).
 */
const CRYPTO_LOCK_LEAD_SEC: Record<number, number> = { 60: 10, 120: 20, 300: 30, 900: 60, 3_600: 120, 14_400: 300, 86_400: 900 };

/**
 * BTC and ETH on every crypto cadence (core `CRYPTO_CADENCES_SEC`): the 60 s demo lane (an Addition, C3), the
 * reference's 300/900/3,600 s and Masayume's 4 h and 1 d. Keys follow core `laneKey` (`BTC-5m`, `BTC-240m`, `BTC-1440m`).
 * Every crypto lane admits a print for 60 s after its boundary (the 1-minute lane, which admitted its open print until
 * lock, was replaced by the staggered 2-minute lane on 7 Oct 2026; its Series stay on the ledger, no longer rolled).
 */
function cryptoLanes(nowSec: number): LaneSpec[] {
  return CRYPTO_SYMBOLS.flatMap((symbol) =>
    CRYPTO_CADENCES_SEC.flatMap((cadenceSec) =>
      (CRYPTO_PHASES_SEC[cadenceSec] ?? [0]).map((phaseSec): LaneSpec => ({
        seriesKey: laneKey(symbol, "token", cadenceSec, phaseSec), symbol, cadenceSec, phaseSec, lockLeadSec: CRYPTO_LOCK_LEAD_SEC[cadenceSec]!,
        versions: [{
          // One cadence back, so the policy covers a staggered Series' first Window wherever its anchor falls.
          effectiveFromSec: Math.floor(nowSec / cadenceSec) * cadenceSec - cadenceSec, validUntilSec: null, printSource: EXCHANGE_PRINT_SOURCE, minDelaySec: 5, barLenSec: 60,
          openAdmissionSec: 60, closeAdmissionSec: 60,
        }],
      })),
    ),
  );
}

/** The reference's price-source matrix (D-003) and the Canton-only versions (C6e, K-070): one table, `lane-versions.ts`, shared with halt-watch. */
const SOURCES = loadPriceSources();

/** One attested version: the source's bar, delay and admission (core `SOURCE_TIMING`), from the lane version's start until its end. */
function attested(v: LaneVersion): LaneSpec["versions"][number] {
  const t = SOURCE_TIMING[v.primary];
  return { effectiveFromSec: v.validFromSec, validUntilSec: v.validUntilSec, printSource: attestedPrintSource(v.primary, v.feed), minDelaySec: t.minDelaySec, barLenSec: BAR_LEN_SEC[v.primary], openAdmissionSec: t.admissionSec, closeAdmissionSec: t.admissionSec };
}

/** The reference's Regular, token, pre-IPO and basket cadences (session-lanes.md §2; D-100, S19): 5/15/60 m, and 60 m for the PreStocks lanes. */
const REGULAR_CADENCES_SEC = [300, 900, 3_600];
const LOCK_LEAD_SEC: Record<number, number> = { 300: 30, 900: 60, 3_600: 120 };

/**
 * The equity families (C6): every reference lane on the attested path, each version naming its original source.
 *   regular   LAUNCH_TICKERS × 5/15/60 m; the dated Pyth/RedStone versions of price-sources.json (TSLA: Pyth until the
 *             trial's last close, then RedStone; QQQ and VOO end with the trial), then `cantonVersions` (C6e, K-070: QQQ
 *             and VOO on Alpaca's last IEX trade from 09-29)
 *   token     the four xStocks × 5/15/60 m on their pinned Switchboard Surge jobs, then (C6e, K-070) the Jupiter median
 *             version the reference fell back to; the Series prints the xStock (`TSLAx`)
 *   preipo    the eight PreStocks names, 60 m, on the catalogue read (D-100/D-101)
 *   basket    the five PreStocks baskets, 60 m, on their index (S19)
 *   valuation Pyth valuation indices (S20): only with `--lanes valuation`, like the reference's init script, which
 *             refuses to register while the key is not entitled ("no dead lane is ever shown")
 *   gap       the Monday Gap (C6d, engine 0.4.0): LAUNCH_TICKERS × one `<T>-gap` Series each (the reference's nine, key
 *             `TSLA-gap`), on the same dated versions as the ticker's Regular lanes with the Gap rule of the reference's
 *             `policyVersions(…, "gap")`: the Friday print is admitted until the Sunday lock (`openAdmissionSec` −1). The
 *             cadence is a week (`GAP_CADENCE_SEC`) and only names the lane: the roller opens each Window through
 *             `Series_OpenWindowSpan` with its own Friday close, Sunday 20:00 ET lock and Monday open (`gapWindows`).
 */
function equityLanes(families: ReadonlySet<string>): LaneSpec[] {
  const out: LaneSpec[] = [];
  const lane = (symbol: string, key: string, cadenceSec: number, versions: LaneSpec["versions"]) =>
    out.push({ seriesKey: key, symbol, cadenceSec, lockLeadSec: LOCK_LEAD_SEC[cadenceSec] ?? 120, versions });
  if (families.has("regular")) {
    for (const symbol of LAUNCH_TICKERS) {
      if (!SOURCES.tickers[symbol]) continue;
      const versions = equityVersions(symbol).map(attested);
      for (const cadenceSec of REGULAR_CADENCES_SEC) lane(symbol, laneKey(symbol, "regular", cadenceSec), cadenceSec, versions);
    }
  }
  if (families.has("token")) {
    for (const symbol of TOKEN_LANE_TICKERS) {
      const xstock = TICKERS[symbol].xstock!;
      // C6e (K-070): the pinned Surge version, then the Jupiter median the reference fell back to while Surge cannot sign.
      const versions = tokenLaneVersions(xstock).map(attested);
      for (const cadenceSec of REGULAR_CADENCES_SEC) lane(xstock.symbol, laneKey(symbol, "token", cadenceSec), cadenceSec, versions);
    }
  }
  if (families.has("gap")) {
    for (const symbol of LAUNCH_TICKERS) {
      if (!SOURCES.tickers[symbol]) continue;
      const versions = equityVersions(symbol).map(attested).map((v) => ({ ...v, openAdmissionSec: -1 }));
      out.push({ seriesKey: laneKey(symbol, "gap", GAP_CADENCE_SEC), symbol, cadenceSec: GAP_CADENCE_SEC, lockLeadSec: 0, versions });
    }
  }
  if (families.has("preipo")) for (const symbol of PRE_IPO_TICKERS) lane(symbol, laneKey(symbol, "token", 3_600), 3_600, preIpoVersions(symbol).map(attested));
  if (families.has("basket")) for (const symbol of BASKET_TICKERS) lane(symbol, laneKey(symbol, "token", 3_600), 3_600, basketVersions(symbol).map(attested));
  if (families.has("valuation")) {
    for (const symbol of VALUATION_TICKERS) lane(symbol, laneKey(symbol, "token", 3_600), 3_600, valuationVersions(TICKERS[symbol].pythIndexFeedId!).map(attested));
  }
  return out;
}

/** Every lane the families name, keyed as the roller and the web key them. */
export function lanesFor(families: ReadonlySet<string>, nowSec: number): LaneSpec[] {
  return [...(families.has("crypto") ? cryptoLanes(nowSec) : []), ...equityLanes(families)];
}

export async function bootstrapVenue(o: VenueBootstrapOptions): Promise<void> {
  const { client, parties, run, log } = o;
  const write = makeWriter(client, o.dryRun, o.onWrite);
  const venue = parties.venue;
  const vs: RoleSession = { role: "venue", party: venue, client, dryRun: o.dryRun };

  const acs = await readActive(vs, [TEMPLATE_IDS.VenueDesk, TEMPLATE_IDS.Series, TEMPLATE_IDS.VenueCash]);
  if (!acs.some((c) => c.createdEvent.templateId.endsWith(":PM.Quote:VenueDesk"))) {
    await write("venue", venue, `bootstrap:desk:${run}`, [cmd.createDesk(venue)]);
    log(`${o.dryRun ? "would create" : "created"} the VenueDesk`);
  }
  const shards = pick(acs, TEMPLATE_IDS.VenueCash, decodeVenueCash).filter((c) => c.data.owner === venue);
  if (shards.length < o.shards) {
    const missing = o.shards - shards.length;
    await write("venue", venue, `bootstrap:shards:${run}`, Array.from({ length: missing }, () => cmd.createShard(venue, o.shardBase)));
    log(`${o.dryRun ? "would credit" : "credited"} ${missing} venue shards of ${o.shardBase} base units (K = ${o.shards})`);
  }
  const haveSeries = new Set(pick(acs, TEMPLATE_IDS.Series, decodeSeries).map((s) => s.data.seriesKey));
  const nowSec = Math.floor(Date.now() / 1000);
  for (const lane of lanesFor(o.lanes, nowSec)) {
    if (haveSeries.has(lane.seriesKey)) continue;
    const phase = lane.phaseSec ?? 0;
    const anchorSec = Math.floor((nowSec - phase) / lane.cadenceSec) * lane.cadenceSec + phase;
    const [first, ...later] = lane.versions.map((v, i) => ({ version: POLICY_VERSION + i, ...v }));
    await write("venue", venue, `bootstrap:series:${lane.seriesKey}:${run}`, [
      cmd.createSeries({
        venue, resolver: parties.resolver, auditor: parties.auditor, seriesKey: lane.seriesKey, symbol: lane.symbol,
        anchorSec, cadenceSec: lane.cadenceSec, lockLeadSec: lane.lockLeadSec, settleGraceSec: 300, cashUnit: CASH_UNIT, nextIndex: 0,
        oracles: ORACLE_ROLES.map((r) => parties[r]), quorum: 2, maxDeviationBps: 100,
        policy: first!, laterPolicies: later,
      }),
    ]);
    log(`${o.dryRun ? "would create" : "created"} Series ${lane.seriesKey} (cadence ${lane.cadenceSec} s, lock lead ${lane.lockLeadSec} s, anchor ${new Date(anchorSec * 1000).toISOString()}, ${lane.versions.map((v) => v.printSource).join(" → ")})`);
  }

  if (o.tickets) await bootstrapTickets(o, write);
  if (o.maker) await bootstrapMaker({ client, venue: vs, auditor: o.parties.auditor, lp: o.parties.lp, run, log, write });
  if (o.games) await bootstrapGames({ client, venue: vs, run, log, upload: false, write });
}

/**
 * C8c: the ticket reserves. Idempotent per piece: a reserve that already has its statement, book or shares is left as
 * it is, so re-running only fills gaps. The LP party opens a `VenueAccount` (invite + accept, both signed by this ledger
 * user, which acts as every party of the account), is credited the seed, and supplies it at the first statement's 1:1
 * price; the first `Earn_PublishNav` then states the pooled cash and the shares.
 */
async function bootstrapTickets(o: VenueBootstrapOptions, write: Writer): Promise<void> {
  const { client, run, log, dryRun } = o;
  const { venue, auditor, lp } = o.parties;
  const vs: RoleSession = { role: "venue", party: venue, client, dryRun };
  const read = () => readActive(vs, [TEMPLATE_IDS.NavStatement, TICKET_TEMPLATE_IDS.RiskBook, TICKET_TEMPLATE_IDS.EarnDesk, TEMPLATE_IDS.LpShare, TEMPLATE_IDS.VenueCash]);
  let acs = await read();
  const nowSec = () => Math.floor(Date.now() / 1000);
  const created = (events: CreatedEvent[], suffix: string) => events.find((e) => e.templateId.endsWith(suffix))?.contractId;

  if (!acs.some((c) => c.createdEvent.templateId.endsWith(":PM.Tickets.Earn:EarnDesk"))) {
    await write("venue", venue, `bootstrap:earndesk:${run}`, [tcmd.createEarnDesk(venue)]);
    log(`${dryRun ? "would create" : "created"} the EarnDesk`);
  }
  const navs = pick(acs, TEMPLATE_IDS.NavStatement, decodeNavStatement);
  const books = pick(acs, TICKET_TEMPLATE_IDS.RiskBook, decodeRiskBook);
  for (const reserve of TICKET_RESERVES) {
    const commands = [];
    if (!navs.some((n) => n.data.reserveId === reserve)) commands.push(tcmd.createNavStatement({ venue, auditor, reserveId: reserve, asOfSec: nowSec() }));
    if (!books.some((b) => b.data.reserveId === reserve)) commands.push(tcmd.createRiskBook({ venue, reserveId: reserve, product: productOf(reserve), params: riskParamsFor(reserve) }));
    if (commands.length) {
      await write("venue", venue, `bootstrap:reserve:${reserve}:${run}`, commands);
      log(`${dryRun ? "would create" : "created"} the ${reserve} reserve's ${commands.length === 2 ? "statement and book" : "missing piece"}`);
    }
  }

  // The LP's account, once.
  const lpAcs = await client.activeContracts({ parties: [lp], templateIds: [TEMPLATE_IDS.VenueAccount] });
  let accountCid = lpAcs.contracts.find((c) => (c.createdEvent.createArgument as { owner?: string }).owner === lp)?.createdEvent.contractId;
  if (!accountCid) {
    const invited = await write("venue", venue, `bootstrap:lp-invite:${run}`, [cmd.inviteAccount(venue, lp, "lp")]);
    const invite = invited[0]?.contractId;
    if (!invite) {
      log("would invite the LP to a venue account, then accept as the LP, credit and supply each reserve, and publish the first statements");
      return;
    }
    const accepted = await write("lp", lp, `bootstrap:lp-accept:${run}`, [cmd.acceptInvite(invite)]);
    accountCid = accepted[0]!.contractId;
    log("opened the LP's venue account");
  }

  acs = await read();
  const shares = pick(acs, TEMPLATE_IDS.LpShare, decodeLpShare);
  for (const reserve of TICKET_RESERVES) {
    if (shares.some((s) => s.data.reserveId === reserve && s.data.provider === lp)) continue;
    if (dryRun) {
      log(`would seed the ${reserve} reserve with ${o.reserveSeedBase / 1_000_000n} credits from the LP (4 credits, 4 supply quotes, 4 accepts: each needs the one before)`);
      continue;
    }
    const nav = pick(acs, TEMPLATE_IDS.NavStatement, decodeNavStatement).find((n) => n.data.reserveId === reserve)!;
    const piece = o.reserveSeedBase / 4n;
    for (let i = 0; i < 4; i++) {
      const credited = await write("venue", venue, `bootstrap:lp-credit:${reserve}:${i}:${run}`, [cmd.creditAccount(accountCid, piece, "lp-seed")]);
      const cash = created(credited, ":PM.Money:VenueCash")!;
      const issued = await write("venue", venue, `bootstrap:supply:${reserve}:${i}:${run}`, [tcmd.issueSupply(nav.cid, { provider: lp, cashIn: piece, validUntilSec: nowSec() + 120 })]);
      const quote = created(issued, ":PM.Reserve:SupplyQuote")!;
      await write("lp", lp, `bootstrap:supply-accept:${reserve}:${i}:${run}`, [tcmd.acceptSupply(quote, [cash])]);
    }
    log(`seeded the ${reserve} reserve with ${o.reserveSeedBase / 1_000_000n} credits from the LP`);
  }
  if (dryRun) return;

  // The first statement of each seeded reserve: its cash and its shares, counted on ledger.
  acs = await read();
  const earnDesk = acs.find((c) => c.createdEvent.templateId.endsWith(":PM.Tickets.Earn:EarnDesk"))!.createdEvent.contractId;
  for (const reserve of TICKET_RESERVES) {
    const nav = pick(acs, TEMPLATE_IDS.NavStatement, decodeNavStatement).find((n) => n.data.reserveId === reserve)!;
    const cash = pick(acs, TEMPLATE_IDS.VenueCash, decodeVenueCash).filter((c) => c.data.owner === venue && c.data.bucket === `reserve:${reserve}`);
    const lpShares = pick(acs, TEMPLATE_IDS.LpShare, decodeLpShare).filter((s) => s.data.reserveId === reserve);
    const assets = cash.reduce((a, c) => a + c.data.amount, 0n);
    // Only the first statement: from then on ops' keeper publishes, counting the live tickets too.
    if (nav.data.seq > 0) continue;
    const inputs = { cash: cash.map((c) => c.cid), lpShares: lpShares.map((s) => s.cid), withdrawQuotes: [], rangeQuotes: [], rounds: [], parlayQuotes: [], tickets: [], boostQuotes: [], positions: [] };
    await write("venue", venue, `bootstrap:nav:${reserve}:${run}`, [tcmd.publishNav(earnDesk, nav.cid, nowSec(), inputs)]);
    log(`published the ${reserve} reserve's statement: ${assets / 1_000_000n} credits, ${lpShares.length} share contract(s)`);
  }
}
