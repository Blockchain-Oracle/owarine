/**
 * Creators' fees (C8f): a subscriber's fee is held by the venue in a venue-only `StrategyFee` at subscribe time; once a
 * period, per creator, the venue aggregates every held fee into one `CreatorPayout` (a total and a count, never a
 * subscriber) through that creator's licence (`License_Payout`). The creator claims it from the app (`Payout_Claim`).
 * The command id names the creator, the period and the exact fees, so a pass that dies half-way is repeated safely.
 */
import { AGENT_TEMPLATE_IDS } from "@owarine/daml";
import { failureText, isInactive, pick, readActive, submit, type RoleSession } from "@owarine/markets/ops/canton";
import { acmd, decodeCreatorLicense, decodeStrategyFee, sha256Hex } from "@owarine/markets/ops/agents";

/** One payout per creator per this many seconds (the reference paid at subscribe; K-086 made it periodic). */
export const PAYOUT_PERIOD_SEC = Number(process.env.AGENTS_PAYOUT_PERIOD_SEC ?? 3_600);

/** `only` pays one creator now, whatever the period (C8i: the seat drain, before the seat's party is recycled). */
export async function payCreators(venue: RoleSession, nowSec: number, log: (why: string) => void, only?: string): Promise<{ paid: number; creators: number }> {
  const A = AGENT_TEMPLATE_IDS;
  const acs = await readActive(venue, [A.StrategyFee, A.CreatorLicense]);
  const fees = pick(acs, A.StrategyFee, decodeStrategyFee).filter((f) => f.data.venue === venue.party && (only === undefined || f.data.creator === only));
  const licenses = pick(acs, A.CreatorLicense, decodeCreatorLicense);
  const byCreator = new Map<string, string[]>();
  for (const f of fees) byCreator.set(f.data.creator, [...(byCreator.get(f.data.creator) ?? []), f.cid]);
  const period = Math.floor(nowSec / PAYOUT_PERIOD_SEC);
  let paid = 0;
  for (const [creator, cids] of byCreator) {
    const lic = licenses.find((l) => l.data.creator === creator);
    if (!lic) {
      log(`fees held for ${creator.split("::")[0]} but it has no licence; kept`);
      continue;
    }
    if (venue.dryRun) continue;
    const sorted = [...cids].sort();
    try {
      await submit(venue, { commandId: `payout:${sha256Hex(`${creator}\u0000${period}\u0000${sorted.join(",")}`).slice(0, 40)}`, commands: [acmd.payout(lic.cid, sorted, period)] });
      paid += 1;
    } catch (error) {
      if (!isInactive(error)) log(`payout to ${creator.split("::")[0]} failed: ${failureText(error)}`);
    }
  }
  return { paid, creators: byCreator.size };
}
