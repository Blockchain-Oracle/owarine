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
 *   4b. (C2d) creates the maker vault: its `MakerDesk` and `maker` statement, seeded from the LP party (`--maker-seed`
 *      credits in 4 supplies into `reserve:maker`), then the first `Maker_PublishNav` (`bootstrap-maker.ts`),
 *   5. (C9b) uploads abu-pm-games and creates the duel arena (`ArenaTerms`, the reference's stake tiers) and a funded
 *      season prize pool (`bootstrap-games.ts`; `--no-games` skips it),
 *   6. (C8f) uploads abu-pm-agents (grants' desk, the strategy registry, the agent desk); the venue's per-seat offers
 *      are created on demand by ops (`/internal/agents/enrol`), so nothing else is bootstrapped for it,
 *   7. writes the parties file ops reads (`AGARI_PARTIES_FILE`, default ~/.config/agari/canton/parties.json).
 *
 * Re-running against the same sandbox reuses the parties in the file and creates only what is missing. The contracts
 * (steps 3–5) are made by `bootstrap/venue.ts`, the same code the DevNet bootstrap runs (`bootstrap-devnet.ts`, C2y).
 *
 *   pnpm --filter @agari/scripts exec tsx bootstrap-local.ts [--dar path] [--tickets-dar path] [--shards 16] [--users alice,bob,outsider] [--seats 8]
 *     [--reserve-seed 10000] [--no-tickets] [--maker-seed 10000] [--no-maker] [--no-games] [--agents-dar path] [--no-agents] [--fresh]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createLedgerClient, noAuth, parseLedgerEnv } from "@agari/ledger";
import { CANTON_ROLES, partiesFilePath, readPartiesFile, type CantonRole, type PartiesFile } from "../services/ops/src/runtime/keys";
import { arg, flag } from "./drive/cli";
import { GAMES_DAR } from "./bootstrap-games";
import { bootstrapVenue, POLICY_VERSION } from "./bootstrap/venue";

const env = parseLedgerEnv(process.env);
if (env.LEDGER_AUTH_MODE !== "none") throw new Error("bootstrap-local runs against an unauthenticated local sandbox only");
const client = createLedgerClient({ baseUrl: env.LEDGER_JSON_API_URL, auth: noAuth(), userId: env.LEDGER_USER_ID });

const DAR = resolve(import.meta.dirname, "..", arg("--dar", "daml/abu-pm-main/.daml/dist/abu-pm-main-0.5.1.dar"));
const AGENTS_DAR = resolve(import.meta.dirname, "..", arg("--agents-dar", "daml/abu-pm-agents/.daml/dist/abu-pm-agents-0.2.1.dar"));
const TICKETS_DAR = resolve(import.meta.dirname, "..", arg("--tickets-dar", "daml/abu-pm-tickets/.daml/dist/abu-pm-tickets-0.1.3.dar"));
/** Credits each ticket reserve starts with, supplied by the LP party in four equal supplies (four reserve shards). */
const RESERVE_SEED_BASE = BigInt(arg("--reserve-seed", "10000")) * 1_000_000n;
const SHARDS = Number(arg("--shards", process.env.VENUE_SHARDS ?? "16"));
/** Base units (demo credits × 10⁶). 2,000 credits a shard: above the worst per-quote venue stake (`MM_MAX_QUOTE_LOTS` × 999 × cashUnit). */
const SHARD_BASE = BigInt(arg("--shard-base", "2000000000"));
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

/** Local sandbox only (this script refuses anything else): on a shared node parties are checked one by one. */
async function knownParties(): Promise<Set<string>> {
  const r = await client.http.request<{ partyDetails?: { party: string }[] }>("GET", "/v2/parties");
  return new Set((r.partyDetails ?? []).map((p) => p.party));
}

async function upload(path: string): Promise<void> {
  if (!existsSync(path)) throw new Error(`${path} is missing: run \`dpm build --all\` in daml/ first`);
  await client.uploadDar(readFileSync(path));
  log(`uploaded ${path.split("/").slice(-1)[0]}`);
}

async function main(): Promise<void> {
  await waitReady();
  log(`sandbox ${env.LEDGER_JSON_API_URL} (${(await client.version()).version})`);
  await upload(DAR);

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
  log(`parties: ${Object.entries(parties).map(([r, p]) => `${r}=${p!.split("::")[0]}`).join(" ")}`);

  const tickets = !flag("--no-tickets");
  const games = !flag("--no-games");
  if (tickets) await upload(TICKETS_DAR);
  if (!flag("--no-agents")) await upload(AGENTS_DAR);
  if (games) await upload(GAMES_DAR);

  // `--lanes crypto,regular,gap,token,preipo,basket` (the default); add `valuation` only with an entitled Pyth key.
  const lanes = new Set(arg("--lanes", "crypto,regular,gap,token,preipo,basket").split(",").map((s) => s.trim()));
  await bootstrapVenue({
    client, parties: parties as Record<CantonRole, string>, dryRun: false, run, shards: SHARDS, shardBase: SHARD_BASE, lanes,
    reserveSeedBase: RESERVE_SEED_BASE, tickets, maker: !flag("--no-maker"), games, log,
  });

  const file: PartiesFile = { network: "local", createdAtMs: Date.now(), parties, users, policyVersion: POLICY_VERSION };
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(file, null, 2)}\n`, { mode: 0o600 });
  log(`wrote ${path}`);
}

await main();
