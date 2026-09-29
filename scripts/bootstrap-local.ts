/**
 * Bootstraps a LOCAL Canton sandbox for the venue actors (C3). Refuses anything but an unauthenticated local sandbox:
 * on Noders parties and DARs are created in the Console, never by a script.
 *
 *   1. uploads abu-pm-main (idempotent: the same DAR twice is one package),
 *   2. allocates the infrastructure parties (venue, resolver, three oracles, auditor, lp, agent-runner) and any demo
 *      users named with `--users alice,bob`,
 *   3. creates the VenueDesk, K venue cash shards and the BTC/ETH Series on every crypto cadence (C6: 60 s demo, 300,
 *      900 and 3,600 s, and Masayume's 4 h and 1 d),
 *   4. (C8c) uploads abu-pm-tickets and creates the ticket reserves: per reserve (range, parlay, boost) a
 *      `NavStatement` (auditor-visible) and a `RiskBook`, one `EarnDesk`, and seeds each reserve from the LP party
 *      (`--reserve-seed` credits in 4 supplies, then the first `Earn_PublishNav`),
 *   5. (C9b) uploads abu-pm-games and creates the duel arena (`ArenaTerms`, the reference's stake tiers) and a funded
 *      season prize pool (`bootstrap-games.ts`; `--no-games` skips it),
 *   6. writes the parties file ops reads (`AGARI_PARTIES_FILE`, default ~/.config/agari/canton/parties.json).
 *
 * Re-running against the same sandbox reuses the parties in the file and creates only what is missing.
 *
 *   pnpm --filter @agari/scripts exec tsx bootstrap-local.ts [--dar path] [--tickets-dar path] [--shards 16] [--users alice,bob,outsider] [--seats 8]
 *     [--reserve-seed 10000] [--no-tickets] [--no-games] [--fresh]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createLedgerClient, noAuth, parseLedgerEnv, type Command } from "@agari/ledger";
import { TEMPLATE_IDS, TICKET_TEMPLATE_IDS } from "@agari/daml";
import {
  attestedPrintSource, BAR_LEN_SEC, BASKET_TICKERS, CRYPTO_CADENCES_SEC, CRYPTO_SYMBOLS, EXCHANGE_PRINT_SOURCE, LAUNCH_TICKERS, laneKey, PRE_IPO_TICKERS,
  SOURCE_TIMING, TICKERS, TOKEN_LANE_TICKERS, VALUATION_TICKERS, type AttestedSource,
} from "@agari/core/market";
import { GAP_CADENCE_SEC } from "@agari/core/types";
import { cmd, decodeSeries, decodeVenueCash, pick, readActive, type RoleSession } from "@agari/markets/ops/canton";
import { decodeLpShare, decodeNavStatement, decodeRiskBook, productOf, riskParamsFor, tcmd, TICKET_RESERVES } from "@agari/markets/ops/tickets";
import { CANTON_ROLES, ORACLE_ROLES, partiesFilePath, readPartiesFile, type CantonRole, type PartiesFile } from "../services/ops/src/runtime/keys";
import { arg, flag } from "./drive/cli";
import { bootstrapGames } from "./bootstrap-games";

const env = parseLedgerEnv(process.env);
if (env.LEDGER_AUTH_MODE !== "none") throw new Error("bootstrap-local runs against an unauthenticated local sandbox only");
const client = createLedgerClient({ baseUrl: env.LEDGER_JSON_API_URL, auth: noAuth(), userId: env.LEDGER_USER_ID });

const DAR = resolve(import.meta.dirname, "..", arg("--dar", "daml/abu-pm-main/.daml/dist/abu-pm-main-0.4.0.dar"));
const TICKETS_DAR = resolve(import.meta.dirname, "..", arg("--tickets-dar", "daml/abu-pm-tickets/.daml/dist/abu-pm-tickets-0.1.1.dar"));
/** Credits each ticket reserve starts with, supplied by the LP party in four equal supplies (four reserve shards). */
const RESERVE_SEED_BASE = BigInt(arg("--reserve-seed", "10000")) * 1_000_000n;
const SHARDS = Number(arg("--shards", process.env.VENUE_SHARDS ?? "16"));
/** Base units (demo credits × 10⁶). 2,000 credits a shard: above the worst per-quote venue stake (`MM_MAX_QUOTE_LOTS` × 999 × cashUnit). */
const SHARD_BASE = BigInt(arg("--shard-base", "2000000000"));
const CASH_UNIT = 1000n;
const POLICY_VERSION = 1;
const run = Date.now().toString(36);
const log = (s: string) => console.log(`[bootstrap] ${s}`);

async function waitReady(): Promise<void> {
  for (let i = 0; ; i++) {
    try {
      await client.version();
      return;
    } catch (e) {
      if (i > 90) throw e;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

async function allocate(hint: string): Promise<string> {
  // A fresh sandbox refuses allocation for a few seconds after /v2/version answers.
  for (let i = 0; ; i++) {
    try {
      return (await client.allocateParty(hint)).party;
    } catch (e) {
      if (i > 30) throw e;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

async function knownParties(): Promise<Set<string>> {
  const r = await client.http.request<{ partyDetails?: { party: string }[] }>("GET", "/v2/parties");
  return new Set((r.partyDetails ?? []).map((p) => p.party));
}

const session = (role: string, party: string): RoleSession => ({ role, party, client, dryRun: false });

async function submitAs(party: string, commandId: string, commands: Command[]): Promise<void> {
  await client.submitAndWaitForTransaction({ actAs: [party], commandId, commands });
}

interface LaneSpec {
  seriesKey: string;
  /** What the lane's prints price: the crypto asset, the stock, the xStock (`TSLAx`), the pre-IPO name or basket. */
  symbol: string;
  cadenceSec: number;
  lockLeadSec: number;
  /** Policy versions, oldest first; each names its attested source (core `attestedPrintSource`). */
  versions: Array<{ effectiveFromSec: number; validUntilSec: number | null; printSource: string; minDelaySec: number; barLenSec: number; openAdmissionSec: number; closeAdmissionSec: number }>;
}

/**
 * How long before expiry each crypto cadence stops taking quotes. The reference locks a Regular Window at its expiry;
 * on Canton a quote must be valid until `lockAt` and settle behind the close print, so every lane keeps a lead that
 * grows with the cadence (1 m and 5 m as C3 set them).
 */
const CRYPTO_LOCK_LEAD_SEC: Record<number, number> = { 60: 10, 300: 30, 900: 60, 3_600: 120, 14_400: 300, 86_400: 900 };

/**
 * BTC and ETH on every crypto cadence (core `CRYPTO_CADENCES_SEC`): the 60 s demo lane (an Addition, C3), the
 * reference's 300/900/3,600 s and Masayume's 4 h and 1 d. Keys follow core `laneKey` (`BTC-5m`, `BTC-240m`, `BTC-1440m`).
 * The 1-minute lane admits its open print until lock (C3); every other lane admits a print for 60 s after its boundary.
 */
function cryptoLanes(nowSec: number): LaneSpec[] {
  return CRYPTO_SYMBOLS.flatMap((symbol) =>
    CRYPTO_CADENCES_SEC.map((cadenceSec): LaneSpec => ({
      seriesKey: laneKey(symbol, "token", cadenceSec), symbol, cadenceSec, lockLeadSec: CRYPTO_LOCK_LEAD_SEC[cadenceSec]!,
      versions: [{
        effectiveFromSec: Math.floor(nowSec / cadenceSec) * cadenceSec, validUntilSec: null, printSource: EXCHANGE_PRINT_SOURCE, minDelaySec: 5, barLenSec: 60,
        openAdmissionSec: cadenceSec === 60 ? -1 : 60, closeAdmissionSec: cadenceSec === 60 ? 40 : 60,
      }],
    })),
  );
}

/** The reference's price-source matrix (D-003): each Regular ticker's dated versions and the token lane's pinned Surge feeds. */
type Sources = {
  tickers: Record<string, { pythFeedId?: string; redstoneFeedId?: string; surgeSymbol?: string; versions: Array<{ validFrom: string; validUntil: string | null; primary: "pyth" | "redstone" }> }>;
  tokenLane: { versions: Array<{ validFrom: string }>; tickers: Record<string, { surgeSymbol: string }> };
};
const SOURCES = JSON.parse(readFileSync(resolve(import.meta.dirname, "..", "services/ops/config/price-sources.json"), "utf8")) as Sources;
const isoSec = (iso: string) => Math.floor(Date.parse(iso) / 1000);

/** One attested version: the source's bar, delay and admission (core `SOURCE_TIMING`), from `fromSec` until `untilSec`. */
function attested(source: Exclude<AttestedSource, "exchanges">, feed: string, fromSec: number, untilSec: number | null): LaneSpec["versions"][number] {
  const t = SOURCE_TIMING[source];
  return { effectiveFromSec: fromSec, validUntilSec: untilSec, printSource: attestedPrintSource(source, feed), minDelaySec: t.minDelaySec, barLenSec: BAR_LEN_SEC[source], openAdmissionSec: t.admissionSec, closeAdmissionSec: t.admissionSec };
}

/** The reference's Regular, token, pre-IPO and basket cadences (session-lanes.md §2; D-100, S19): 5/15/60 m, and 60 m for the PreStocks lanes. */
const REGULAR_CADENCES_SEC = [300, 900, 3_600];
const LOCK_LEAD_SEC: Record<number, number> = { 300: 30, 900: 60, 3_600: 120 };
/** D-100 (pre-IPO mints verified) and S19 (basket bases) dates: the attested PreStocks versions start there. */
const PRESTOCKS_FROM_SEC = isoSec("2026-09-19T00:00:00Z");
const BASKETS_FROM_SEC = isoSec("2026-09-22T00:00:00Z");

/**
 * The equity families (C6): every reference lane on the attested path, each version naming its original source.
 *   regular   LAUNCH_TICKERS × 5/15/60 m; the dated Pyth/RedStone versions of price-sources.json (TSLA: Pyth until the
 *             trial's last close, then RedStone; QQQ and VOO end with the trial and pause: no signed source)
 *   token     the four xStocks × 5/15/60 m on their pinned Switchboard Surge jobs; the Series prints the xStock (`TSLAx`)
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
      const row = SOURCES.tickers[symbol];
      if (!row) continue;
      const versions = row.versions.map((v) =>
        attested(v.primary, v.primary === "pyth" ? row.pythFeedId! : row.redstoneFeedId!, isoSec(v.validFrom), v.validUntil ? isoSec(v.validUntil) : null));
      for (const cadenceSec of REGULAR_CADENCES_SEC) lane(symbol, laneKey(symbol, "regular", cadenceSec), cadenceSec, versions);
    }
  }
  if (families.has("token")) {
    for (const symbol of TOKEN_LANE_TICKERS) {
      const xstock = TICKERS[symbol].xstock!;
      const from = isoSec(SOURCES.tokenLane.versions[0]!.validFrom);
      for (const cadenceSec of REGULAR_CADENCES_SEC) lane(xstock.symbol, laneKey(symbol, "token", cadenceSec), cadenceSec, [attested("switchboard", xstock.surgeSymbol, from, null)]);
    }
  }
  if (families.has("gap")) {
    for (const symbol of LAUNCH_TICKERS) {
      const row = SOURCES.tickers[symbol];
      if (!row) continue;
      const versions = row.versions.map((v) => ({
        ...attested(v.primary, v.primary === "pyth" ? row.pythFeedId! : row.redstoneFeedId!, isoSec(v.validFrom), v.validUntil ? isoSec(v.validUntil) : null),
        openAdmissionSec: -1,
      }));
      out.push({ seriesKey: laneKey(symbol, "gap", GAP_CADENCE_SEC), symbol, cadenceSec: GAP_CADENCE_SEC, lockLeadSec: 0, versions });
    }
  }
  if (families.has("preipo")) for (const symbol of PRE_IPO_TICKERS) lane(symbol, laneKey(symbol, "token", 3_600), 3_600, [attested("prestocks", symbol, PRESTOCKS_FROM_SEC, null)]);
  if (families.has("basket")) for (const symbol of BASKET_TICKERS) lane(symbol, laneKey(symbol, "token", 3_600), 3_600, [attested("basket", symbol, BASKETS_FROM_SEC, null)]);
  if (families.has("valuation")) {
    for (const symbol of VALUATION_TICKERS) lane(symbol, laneKey(symbol, "token", 3_600), 3_600, [attested("pyth-index", TICKERS[symbol].pythIndexFeedId!.replace(/^0x/, "").toLowerCase(), isoSec("2026-09-22T00:00:00Z"), null)]);
  }
  return out;
}

async function main(): Promise<void> {
  await waitReady();
  log(`sandbox ${env.LEDGER_JSON_API_URL} (${(await client.version()).version})`);
  if (!existsSync(DAR)) throw new Error(`${DAR} is missing: run \`dpm build\` in daml/abu-pm-main first`);
  await client.uploadDar(readFileSync(DAR));
  log(`uploaded ${DAR.split("/").slice(-1)[0]}`);

  const path = partiesFilePath();
  const previous = flag("--fresh") ? null : readPartiesFile();
  const known = await knownParties();
  const parties: Partial<Record<CantonRole, string>> = {};
  for (const role of CANTON_ROLES) {
    const had = previous?.parties[role];
    parties[role] = had && known.has(had) ? had : await allocate(`agari-${role}-${run}`);
  }
  const users: Record<string, string> = {};
  // K-026: the web reads personas from users.alice|bob|outsider and its seat pool from users named seat-*.
  const seatCount = Number(arg("--seats", "0"));
  const wantUsers = [
    ...arg("--users", "").split(",").map((s) => s.trim()).filter(Boolean),
    ...Array.from({ length: Number.isInteger(seatCount) && seatCount > 0 ? seatCount : 0 }, (_, i) => `seat-${i + 1}`),
  ];
  for (const name of wantUsers) {
    const had = previous?.users?.[name];
    users[name] = had && known.has(had) ? had : await allocate(`agari-user-${name}-${run}`);
  }
  const venue = parties.venue!;
  log(`parties: ${Object.entries(parties).map(([r, p]) => `${r}=${p!.split("::")[0]}`).join(" ")}`);

  const vs = session("venue", venue);
  const acs = await readActive(vs, [TEMPLATE_IDS.VenueDesk, TEMPLATE_IDS.Series, TEMPLATE_IDS.VenueCash]);
  if (!acs.some((c) => c.createdEvent.templateId.endsWith(":PM.Quote:VenueDesk"))) {
    await submitAs(venue, `bootstrap:desk:${run}`, [cmd.createDesk(venue)]);
    log("created the VenueDesk");
  }
  const shards = pick(acs, TEMPLATE_IDS.VenueCash, decodeVenueCash).filter((c) => c.data.owner === venue);
  if (shards.length < SHARDS) {
    const missing = SHARDS - shards.length;
    await submitAs(venue, `bootstrap:shards:${run}`, Array.from({ length: missing }, () => cmd.createShard(venue, SHARD_BASE)));
    log(`credited ${missing} venue shards of ${SHARD_BASE} base units (K = ${SHARDS})`);
  }
  const haveSeries = new Set(pick(acs, TEMPLATE_IDS.Series, decodeSeries).map((s) => s.data.seriesKey));
  const nowSec = Math.floor(Date.now() / 1000);
  // `--lanes crypto,regular,gap,token,preipo,basket` (the default); add `valuation` only with an entitled Pyth key.
  const families = new Set(arg("--lanes", "crypto,regular,gap,token,preipo,basket").split(",").map((s) => s.trim()));
  const lanes = [...(families.has("crypto") ? cryptoLanes(nowSec) : []), ...equityLanes(families)];
  for (const lane of lanes) {
    if (haveSeries.has(lane.seriesKey)) continue;
    const anchorSec = Math.floor(nowSec / lane.cadenceSec) * lane.cadenceSec;
    const [first, ...later] = lane.versions.map((v, i) => ({ version: POLICY_VERSION + i, ...v }));
    await submitAs(venue, `bootstrap:series:${lane.seriesKey}:${run}`, [
      cmd.createSeries({
        venue, resolver: parties.resolver!, auditor: parties.auditor!, seriesKey: lane.seriesKey, symbol: lane.symbol,
        anchorSec, cadenceSec: lane.cadenceSec, lockLeadSec: lane.lockLeadSec, settleGraceSec: 300, cashUnit: CASH_UNIT, nextIndex: 0,
        oracles: ORACLE_ROLES.map((r) => parties[r]!), quorum: 2, maxDeviationBps: 100,
        policy: first!, laterPolicies: later,
      }),
    ]);
    log(`created Series ${lane.seriesKey} (cadence ${lane.cadenceSec} s, lock lead ${lane.lockLeadSec} s, anchor ${new Date(anchorSec * 1000).toISOString()}, ${lane.versions.map((v) => v.printSource).join(" → ")})`);
  }

  if (!flag("--no-tickets")) await bootstrapTickets(venue, parties.auditor!, parties.lp!);
  if (!flag("--no-games")) await bootstrapGames({ client, venue: vs, run, log });

  const file: PartiesFile = { network: "local", createdAtMs: Date.now(), parties, users, policyVersion: POLICY_VERSION };
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(file, null, 2)}\n`, { mode: 0o600 });
  log(`wrote ${path}`);
}

await main();

/**
 * C8c: the ticket reserves. Idempotent per piece: a reserve that already has its statement, book or shares is left as
 * it is, so re-running only fills gaps. The LP party opens a `VenueAccount` (invite + accept, both signed here on the
 * local sandbox), is credited the seed, and supplies it at the first statement's 1:1 price; the first `Earn_PublishNav`
 * then states the pooled cash and the shares.
 */
async function bootstrapTickets(venue: string, auditor: string, lp: string): Promise<void> {
  if (!existsSync(TICKETS_DAR)) throw new Error(`${TICKETS_DAR} is missing: run \`dpm build --all\` in daml/ first`);
  await client.uploadDar(readFileSync(TICKETS_DAR));
  log(`uploaded ${TICKETS_DAR.split("/").slice(-1)[0]}`);
  const vs = session("venue", venue);
  const read = () => readActive(vs, [TEMPLATE_IDS.NavStatement, TICKET_TEMPLATE_IDS.RiskBook, TICKET_TEMPLATE_IDS.EarnDesk, TEMPLATE_IDS.LpShare, TEMPLATE_IDS.VenueCash]);
  let acs = await read();
  const nowSec = () => Math.floor(Date.now() / 1000);

  if (!acs.some((c) => c.createdEvent.templateId.endsWith(":PM.Tickets.Earn:EarnDesk"))) {
    await submitAs(venue, `bootstrap:earndesk:${run}`, [tcmd.createEarnDesk(venue)]);
    log("created the EarnDesk");
  }
  const navs = pick(acs, TEMPLATE_IDS.NavStatement, decodeNavStatement);
  const books = pick(acs, TICKET_TEMPLATE_IDS.RiskBook, decodeRiskBook);
  for (const reserve of TICKET_RESERVES) {
    const commands = [];
    if (!navs.some((n) => n.data.reserveId === reserve)) commands.push(tcmd.createNavStatement({ venue, auditor, reserveId: reserve, asOfSec: nowSec() }));
    if (!books.some((b) => b.data.reserveId === reserve)) commands.push(tcmd.createRiskBook({ venue, reserveId: reserve, product: productOf(reserve), params: riskParamsFor(reserve) }));
    if (commands.length) {
      await submitAs(venue, `bootstrap:reserve:${reserve}:${run}`, commands);
      log(`created the ${reserve} reserve's ${commands.length === 2 ? "statement and book" : "missing piece"}`);
    }
  }

  // The LP's account, once.
  const lpAcs = await client.activeContracts({ parties: [lp], templateIds: [TEMPLATE_IDS.VenueAccount] });
  let accountCid = lpAcs.contracts.find((c) => (c.createdEvent.createArgument as { owner?: string }).owner === lp)?.createdEvent.contractId;
  if (!accountCid) {
    const invited = await client.submitAndWaitForTransaction({ actAs: [venue], commandId: `bootstrap:lp-invite:${run}`, commands: [cmd.inviteAccount(venue, lp, "lp")] });
    const invite = invited.transaction.events.flatMap((e) => ("CreatedEvent" in e ? [e.CreatedEvent] : []))[0]!.contractId;
    const accepted = await client.submitAndWaitForTransaction({ actAs: [lp], commandId: `bootstrap:lp-accept:${run}`, commands: [cmd.acceptInvite(invite)] });
    accountCid = accepted.transaction.events.flatMap((e) => ("CreatedEvent" in e ? [e.CreatedEvent] : []))[0]!.contractId;
    log("opened the LP's venue account");
  }

  acs = await read();
  const shares = pick(acs, TEMPLATE_IDS.LpShare, decodeLpShare);
  for (const reserve of TICKET_RESERVES) {
    if (shares.some((s) => s.data.reserveId === reserve && s.data.provider === lp)) continue;
    const nav = pick(acs, TEMPLATE_IDS.NavStatement, decodeNavStatement).find((n) => n.data.reserveId === reserve)!;
    const piece = RESERVE_SEED_BASE / 4n;
    for (let i = 0; i < 4; i++) {
      const credited = await client.submitAndWaitForTransaction({ actAs: [venue], commandId: `bootstrap:lp-credit:${reserve}:${i}:${run}`, commands: [cmd.creditAccount(accountCid, piece, "lp-seed")] });
      const cash = credited.transaction.events.flatMap((e) => ("CreatedEvent" in e ? [e.CreatedEvent] : [])).find((e) => e.templateId.endsWith(":PM.Money:VenueCash"))!.contractId;
      const issued = await client.submitAndWaitForTransaction({ actAs: [venue], commandId: `bootstrap:supply:${reserve}:${i}:${run}`, commands: [tcmd.issueSupply(nav.cid, { provider: lp, cashIn: piece, validUntilSec: nowSec() + 120 })] });
      const quote = issued.transaction.events.flatMap((e) => ("CreatedEvent" in e ? [e.CreatedEvent] : [])).find((e) => e.templateId.endsWith(":PM.Reserve:SupplyQuote"))!.contractId;
      await client.submitAndWaitForTransaction({ actAs: [lp], commandId: `bootstrap:supply-accept:${reserve}:${i}:${run}`, commands: [tcmd.acceptSupply(quote, [cash])] });
    }
    log(`seeded the ${reserve} reserve with ${RESERVE_SEED_BASE / 1_000_000n} credits from the LP`);
  }

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
    await submitAs(venue, `bootstrap:nav:${reserve}:${run}`, [tcmd.publishNav(earnDesk, nav.cid, nowSec(), inputs)]);
    log(`published the ${reserve} reserve's statement: ${assets / 1_000_000n} credits, ${lpShares.length} share contract(s)`);
  }
}
