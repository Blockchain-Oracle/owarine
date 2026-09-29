/**
 * Bootstraps a LOCAL Canton sandbox for the venue actors (C3). Refuses anything but an unauthenticated local sandbox:
 * on Noders parties and DARs are created in the Console, never by a script.
 *
 *   1. uploads abu-pm-main (idempotent: the same DAR twice is one package),
 *   2. allocates the infrastructure parties (venue, resolver, three oracles, auditor, lp, agent-runner) and any demo
 *      users named with `--users alice,bob`,
 *   3. creates the VenueDesk, K venue cash shards and the BTC/ETH Series on every crypto cadence (C6: 60 s demo, 300,
 *      900 and 3,600 s, and Masayume's 4 h and 1 d),
 *   4. writes the parties file ops reads (`AGARI_PARTIES_FILE`, default ~/.config/agari/canton/parties.json).
 *
 * Re-running against the same sandbox reuses the parties in the file and creates only what is missing.
 *
 *   pnpm --filter @agari/scripts exec tsx bootstrap-local.ts [--dar path] [--shards 16] [--users alice,bob,outsider] [--seats 8] [--fresh]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createLedgerClient, noAuth, parseLedgerEnv, type Command } from "@agari/ledger";
import { TEMPLATE_IDS } from "@agari/daml";
import { CRYPTO_CADENCES_SEC, CRYPTO_SYMBOLS, EXCHANGE_PRINT_SOURCE, laneKey } from "@agari/core/market";
import { cmd, decodeSeries, decodeVenueCash, pick, readActive, type RoleSession } from "@agari/markets/ops/canton";
import { CANTON_ROLES, ORACLE_ROLES, partiesFilePath, readPartiesFile, type CantonRole, type PartiesFile } from "../services/ops/src/runtime/keys";
import { arg, flag } from "./drive/cli";

const env = parseLedgerEnv(process.env);
if (env.LEDGER_AUTH_MODE !== "none") throw new Error("bootstrap-local runs against an unauthenticated local sandbox only");
const client = createLedgerClient({ baseUrl: env.LEDGER_JSON_API_URL, auth: noAuth(), userId: env.LEDGER_USER_ID });

const DAR = resolve(import.meta.dirname, "..", arg("--dar", "daml/abu-pm-main/.daml/dist/abu-pm-main-0.3.0.dar"));
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
  for (const lane of cryptoLanes(nowSec)) {
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

  const file: PartiesFile = { network: "local", createdAtMs: Date.now(), parties, users, policyVersion: POLICY_VERSION };
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(file, null, 2)}\n`, { mode: 0o600 });
  log(`wrote ${path}`);
}

await main();
