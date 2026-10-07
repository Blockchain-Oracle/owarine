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
 *
 * The maker vault (abu-pm-main 0.5.0, K-092, K-200): this actor publishes its statement (`Maker_PublishNav`, on the
 * vault's queue, every `MAKER_NAV_MS` when the book's value or shares moved, and at least once a minute), and reports
 * it beside the venue's figures as `maker`. Its cash is a reserve bucket, so it is never in `freeBase`; its quote locks
 * and legs are in `lockedBase` and `venueLegBase` as before, and also inside `maker.assetsBase`.
 */
import { TEMPLATE_IDS } from "@owarine/daml";
import { decodeLeg, decodeQuote, decodeVenueCash, pick, readActive, type RoleSession } from "@owarine/markets/ops/canton";
import { runActor, type PassResult } from "../../runtime/actor";
import type { MakerVault } from "../maker-vault/vault";
import { failureText } from "@owarine/markets/ops/canton";
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
  /** The maker vault's live statement and what of it is idle; null without a vault in this process. */
  maker: { navSeq: number; assetsBase: string; shares: string; liquidBase: string; deployedBase: string; openWindows: number } | null;
}

export function startReserveReporter(input: { venue: RoleSession; log: (why: string) => void; maker?: MakerVault | null }): { stop: () => void; latest: () => ReserveSnapshot | null } {
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
    const m = input.maker?.state() ?? null;
    latest = {
      asOfMs: Date.now(), freeBase: free.toString(), lockedBase: locked.toString(), venueLegBase: venueLegs.toString(), userLegBase: userLegs.toString(),
      maxOwedBase: maxOwed.toString(), headroomBase: headroom.toString(), openLegs: legs.length, liveQuotes: quotes.length,
      maker: m && { navSeq: m.navSeq, assetsBase: m.assetsBase.toString(), shares: m.shares.toString(), liquidBase: m.liquidBase.toString(), deployedBase: m.deployedBase.toString(), openWindows: m.open.length },
    };
    return { why: `free ${free}, locked ${locked}, legs ${venueLegs}+${userLegs}, max owed ${maxOwed}, headroom ${headroom}`, detail: { ...latest } };
  };
  const { stop } = runActor({ name: "reserve-reporter", log: input.log, dryRun: false, everyMs: 30_000, pass });
  const maker = input.maker ?? null;
  const nav = maker
    ? runActor({
        name: "maker-nav",
        log: input.log,
        dryRun: input.venue.dryRun,
        everyMs: maker.env.navEveryMs,
        pass: async (): Promise<PassResult> => {
          try {
            const r = await maker.publishNav();
            return { why: r.note, detail: { published: r.published } };
          } catch (error) {
            return { why: `maker NAV not published: ${failureText(error).slice(0, 200)}`, detail: { published: false } };
          }
        },
      })
    : null;
  return {
    stop: () => {
      stop();
      nav?.stop();
    },
    latest: () => latest,
  };
}
