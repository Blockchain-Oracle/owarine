/**
 * The Canton Coin rail actor (C7b, opt-in: `OPS_ACTORS=cc-rail`, never on `all`, because the rail's capability is
 * `not-live` until DevNet proves it). One pass every few seconds acting as the venue only: settle the deposits owners
 * instructed, answer the withdrawals they asked for, close what is in flight, and publish the auditor-visible reserve
 * statement. Every decision is `@owarine/markets/ops/cc`'s `railPass`; this file is the wiring: env, the listing, the
 * registry client, the seat leases (K-224) and the history reader.
 *
 * It contacts nothing until it is started with a registry URL and a ledger. DRY_RUN (the default) prepares only.
 */
import { CC_TEMPLATE_IDS } from "@owarine/daml";
import { getDb, isDbConfigured, seatHolderLeases } from "@owarine/db";
import { failureText, pick, readActive, submit } from "@owarine/markets/ops/canton";
import {
  archivedByExercise, ccCmd, createRegistryClient, decodeListing, railPass, type RailPassResult, type RegistryClient,
} from "@owarine/markets/ops/cc";
import { runActor, type PassResult } from "../../runtime/actor";
import type { VenueContext } from "../venue/context";
import { readCcRailEnv, type CcRailEnv } from "./env";

const summarize = (r: RailPassResult): string =>
  `settled ${r.settled}, rejected ${r.rejected}, accepted ${r.accepted}, declined ${r.declined}, completed ${r.completed}, refunded ${r.refunded}, held ${r.held}${r.attested ? ", attested" : ""}${r.failures.length ? `, ${r.failures.length} failed` : ""}`;

export function startCcRail(input: { venue: VenueContext; log: (why: string) => void; env?: NodeJS.ProcessEnv; registry?: RegistryClient | null }): { stop: () => void } | null {
  const session = input.venue.session("venue");
  const auditor = input.venue.parties.auditor;
  if (!session || !auditor) {
    input.log("the venue or auditor party is missing: the Canton Coin rail does not run");
    return null;
  }
  let cfg: CcRailEnv;
  try {
    cfg = readCcRailEnv(input.env);
  } catch (error) {
    input.log(`the Canton Coin rail's configuration is invalid: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
  const registry = input.registry === undefined ? (cfg.registryUrl ? createRegistryClient({ baseUrl: cfg.registryUrl }) : null) : input.registry;
  if (!registry) input.log("no CC_REGISTRY_URL: the rail reads and reports, and attempts no deposit or withdrawal");
  if (!isDbConfigured() && cfg.requireLease) input.log("no database: with CC_REQUIRE_LEASE on, no seat has a live lease, so every deposit and every withdrawal is held, and none is settled or paid (K-224)");

  async function ensureListing(): Promise<void> {
    const acs = await readActive(session!, [CC_TEMPLATE_IDS.CcListing]);
    const have = pick(acs, CC_TEMPLATE_IDS.CcListing, decodeListing).find((l) => l.data.venue === session!.party && l.data.listingId === cfg.listingId);
    if (have) return;
    if (!cfg.createListing) return;
    if (!cfg.instrumentAdmin) throw new Error("CC_CREATE_LISTING is on but CC_INSTRUMENT_ADMIN is not set");
    await submit(session!, {
      commandId: `cclisting:${cfg.listingId}`,
      commands: [
        ccCmd.createListing({
          venue: session!.party, auditor: auditor!, listingId: cfg.listingId, instrumentAdmin: cfg.instrumentAdmin, instrumentId: cfg.instrumentId,
          unitsPerCoin: cfg.unitsPerCoin, minDepositUnits: cfg.minDepositUnits, maxDepositUnits: cfg.maxDepositUnits, depositsOpen: true,
        }),
      ],
    });
    input.log(`created listing ${cfg.listingId}: ${cfg.instrumentId} of ${cfg.instrumentAdmin} at ${cfg.unitsPerCoin} cash units per coin`);
  }

  const { stop } = runActor({
    name: "cc-rail",
    log: input.log,
    dryRun: session.dryRun,
    everyMs: cfg.everyMs,
    pass: async (): Promise<PassResult> => {
      try {
        await ensureListing();
        const db = getDb();
        const leases = cfg.requireLease ? (db ? await seatHolderLeases(db) : new Map<string, { address: string; fromOffset: number }>()) : null;
        // Read again just before a command goes out: a seat can be re-leased while the pass is on (K-224).
        const freshLease =
          cfg.requireLease && db
            ? async (party: string) => {
                const l = (await seatHolderLeases(db, { parties: [party] })).get(party);
                return l ? { startOffset: l.fromOffset } : null;
              }
            : undefined;
        const result = await railPass({
          venue: session,
          registry,
          listingId: cfg.listingId,
          nowSec: () => Math.floor(Date.now() / 1000),
          log: input.log,
          ...(leases ? { leaseOf: (party: string) => (leases.has(party) ? { startOffset: leases.get(party)!.fromOffset } : null) } : {}),
          ...(freshLease ? { freshLease } : {}),
          allowedPackageIds: cfg.allowedPackageIds,
          refundAfterSec: cfg.refundAfterSec,
          transferWindowSec: cfg.transferWindowSec,
          attestEverySec: cfg.attestEverySec,
          history: (cids, from) => archivedByExercise({ client: session.client, venue: session.party }, cids, from),
        });
        return { why: summarize(result), detail: { ...result } };
      } catch (error) {
        return { why: `pass failed: ${failureText(error).slice(0, 200)}` };
      }
    },
  });
  return { stop };
}
