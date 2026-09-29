/**
 * The reserve reporter (plan "Venue operations", new actor): what the venue holds against what it owes, as the auditor
 * party would check it. "Fully backed" is ledger-enforced only per pair; on DevNet the venue mints its own demo cash, so
 * overall solvency is a claim, and this is the number behind it. Report only: `/reserve` and the heartbeat.
 *
 *   freeBase       venue cash in the pool (shards, change, fees)
 *   lockedBase     venue stake locked in live quotes
 *   venueLegBase   backing inside the venue's own legs
 *   userLegBase    backing plus escrowed fees inside users' legs (what users paid in)
 *   maxOwedBase    the most the venue can owe on open legs: every user leg winning its pair
 */
import { TEMPLATE_IDS } from "@agari/daml";
import { decodeLeg, decodeQuote, decodeVenueCash, pick, readActive, type RoleSession } from "@agari/markets/ops/canton";
import { runActor, type PassResult } from "../../runtime/actor";
import { isShardBucket } from "../quote-issuer/pool";

export interface ReserveSnapshot {
  asOfMs: number;
  freeBase: string;
  lockedBase: string;
  venueLegBase: string;
  userLegBase: string;
  maxOwedBase: string;
  /** (free + locked + venue legs + user legs) − max owed: never negative on a solvent venue. */
  headroomBase: string;
  openLegs: number;
  liveQuotes: number;
}

export function startReserveReporter(input: { venue: RoleSession; log: (why: string) => void }): { stop: () => void; latest: () => ReserveSnapshot | null } {
  let latest: ReserveSnapshot | null = null;
  const pass = async (): Promise<PassResult> => {
    const acs = await readActive(input.venue, [TEMPLATE_IDS.VenueCash, TEMPLATE_IDS.Quote, TEMPLATE_IDS.Leg]);
    const me = input.venue.party;
    let free = 0n, locked = 0n, venueLegs = 0n, userLegs = 0n, maxOwed = 0n;
    for (const c of pick(acs, TEMPLATE_IDS.VenueCash, decodeVenueCash)) if (c.data.owner === me && isShardBucket(c.data.bucket)) free += c.data.amount;
    const quotes = pick(acs, TEMPLATE_IDS.Quote, decodeQuote).filter((q) => q.data.venue === me);
    for (const q of quotes) locked += q.data.lots * BigInt(1000 - q.data.priceTicks) * q.data.cashUnit;
    const legs = pick(acs, TEMPLATE_IDS.Leg, decodeLeg).filter((l) => l.data.venue === me);
    for (const l of legs) {
      if (l.data.owner === me) venueLegs += l.data.backingShare;
      else {
        userLegs += l.data.backingShare + l.data.feePaid;
        maxOwed += l.data.lots * 1000n * l.data.cashUnit + l.data.feePaid;
      }
    }
    const headroom = free + locked + venueLegs + userLegs - maxOwed;
    latest = {
      asOfMs: Date.now(), freeBase: free.toString(), lockedBase: locked.toString(), venueLegBase: venueLegs.toString(), userLegBase: userLegs.toString(),
      maxOwedBase: maxOwed.toString(), headroomBase: headroom.toString(), openLegs: legs.length, liveQuotes: quotes.length,
    };
    return { why: `free ${free}, locked ${locked}, legs ${venueLegs}+${userLegs}, max owed ${maxOwed}, headroom ${headroom}`, detail: { ...latest } };
  };
  const { stop } = runActor({ name: "reserve-reporter", log: input.log, dryRun: false, everyMs: 30_000, pass });
  return { stop, latest: () => latest };
}
