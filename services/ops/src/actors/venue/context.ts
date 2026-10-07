/**
 * The Canton venue context every C3 actor shares: one ledger client for the process (one token source, one
 * single-flight grant), and one role session per infrastructure party (`roleParty`). A role without a party has no
 * session: its actor scans and reports only. DRY_RUN (default on) makes every session prepare-only.
 */
import { ledgerClientFromEnv, ledgerConfigSummary, parseLedgerEnv, type LedgerClient } from "@owarine/ledger";
import { TEMPLATE_IDS } from "@owarine/daml";
import { pick, readActive, type RoleSession } from "@owarine/markets/ops/canton";
import { readOpsEnv } from "../../runtime/env";
import { CANTON_ROLES, readPartiesFile, roleParty, type CantonRole, type OracleRole } from "../../runtime/keys";

export interface VenueContext {
  client: LedgerClient;
  dryRun: boolean;
  /** The session acting as `role`, or null when the role has no party (scan-and-report). */
  session(role: CantonRole): RoleSession | null;
  /** Party ids by role, for the ones that have one. */
  parties: Partial<Record<CantonRole, string>>;
  /** The price-policy version the feeders stamp on prints (the bootstrap's Series), `ORACLE_POLICY_VERSION` overrides. */
  policyVersion: number;
  /** The venue's one `VenueDesk` contract id, read once and cached. */
  deskCid(): Promise<string>;
  summary: string;
}

export function createVenueContext(env: NodeJS.ProcessEnv = process.env): VenueContext {
  const ledgerEnv = parseLedgerEnv(env);
  const client = ledgerClientFromEnv(ledgerEnv);
  const dryRun = readOpsEnv(env).dryRun;
  const file = readPartiesFile(env);
  const parties: Partial<Record<CantonRole, string>> = {};
  for (const role of CANTON_ROLES) {
    const p = roleParty(role, env, file);
    if (p) parties[role] = p;
  }
  const sessions = new Map<CantonRole, RoleSession>();
  const session = (role: CantonRole): RoleSession | null => {
    const party = parties[role];
    if (!party) return null;
    let s = sessions.get(role);
    if (!s) sessions.set(role, (s = { role, party, client, dryRun }));
    return s;
  };
  let desk: Promise<string> | null = null;
  const deskCid = () => {
    desk ??= (async () => {
      const venue = session("venue");
      if (!venue) throw new Error("no venue party: VENUE_PARTY or the parties file");
      const [first] = pick(await readActive(venue, [TEMPLATE_IDS.VenueDesk]), TEMPLATE_IDS.VenueDesk, (v) => v);
      if (!first) throw new Error("the venue has no VenueDesk: run the bootstrap");
      return first.cid;
    })().catch((error: unknown) => {
      desk = null;
      throw error;
    });
    return desk;
  };
  const policyVersion = Number(env.ORACLE_POLICY_VERSION ?? file?.policyVersion ?? 1);
  const cfg = ledgerConfigSummary(ledgerEnv);
  const missing = CANTON_ROLES.filter((r) => !parties[r]);
  const summary = `ledger ${cfg.url} (${cfg.mode}), ${dryRun ? "DRY RUN" : "live"}, parties ${CANTON_ROLES.length - missing.length}/${CANTON_ROLES.length}${missing.length ? ` (missing ${missing.join(",")})` : ""}`;
  return { client, dryRun, session, parties, policyVersion, deskCid, summary };
}

/** The short oracle name in its role (`oracle-kraken` → `kraken`): what `print:<oracle>:<T>` carries. */
export const oracleName = (role: OracleRole) => role.slice("oracle-".length);

export const nowSec = () => Math.floor(Date.now() / 1000);
