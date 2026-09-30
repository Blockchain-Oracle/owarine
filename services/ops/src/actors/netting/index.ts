/**
 * Netting (review B4): merges venue-held legs of opposite outcome in one market with `Leg_Merge`, releasing their
 * backing now instead of at settlement.
 *
 *   Step 1 (always): within one `pairId`. The venue holds both halves of a pair only after a buy-back or a close-out;
 *                    the shares sum to the pair's backing exactly, so the merge releases all of it.
 *   Step 2 (`NETTING_CROSS_PAIR=1`): across pairs of equal size, before the market resolves. The ledger releases
 *                    `min(shareA + shareB, quantity)` and keeps the rest owed in a `NettedResidual`, which the settler
 *                    pays out at resolution.
 */
import { TEMPLATE_IDS } from "@agari/daml";
import { cmd, decodeLeg, failureText, isInactive, legBookOf, netLegsCommandId, pick, readActive, submit, type Active, type LegC, type RoleSession } from "@agari/markets/ops/canton";
import { runActor, type PassResult } from "../../runtime/actor";
import type { ShardPool } from "../quote-issuer/pool";
import { venueCashCreated } from "../quote-issuer/pooled-submit";

type LegA = Active<LegC>;

/**
 * Pairs of venue legs to merge: same pair first, then (optionally) same market and size across pairs. Pure. A book's
 * legs (abu-pm-main 0.5.0: the maker vault's, `beneficiaryRef = reserve:<id>`) pair only with the same book's, as the
 * ledger requires (`book-mismatch`), so the released cash lands in that book's bucket.
 */
export function planNetting(venueLegs: readonly LegA[], o: { crossPair: boolean; resolvedTerms: ReadonlySet<string> }): Array<[LegA, LegA]> {
  const out: Array<[LegA, LegA]> = [];
  const used = new Set<string>();
  const byPair = new Map<string, LegA[]>();
  for (const l of venueLegs) {
    const k = `${l.data.termsCid}|${l.data.pairId}|${legBookOf(l.data) ?? ""}`;
    byPair.set(k, [...(byPair.get(k) ?? []), l]);
  }
  for (const legs of byPair.values()) {
    const up = legs.find((l) => l.data.outcome === "SideUp");
    const down = legs.find((l) => l.data.outcome === "SideDown");
    if (up && down && up.data.lots === down.data.lots) {
      out.push([up, down]);
      used.add(up.cid).add(down.cid);
    }
  }
  if (!o.crossPair) return out;
  const open = venueLegs.filter((l) => !used.has(l.cid) && !o.resolvedTerms.has(l.data.termsCid));
  for (const a of open) {
    if (used.has(a.cid) || a.data.outcome !== "SideUp") continue;
    const b = open.find((x) => !used.has(x.cid) && x.data.outcome === "SideDown" && x.data.termsCid === a.data.termsCid && x.data.lots === a.data.lots && x.data.cashUnit === a.data.cashUnit && legBookOf(x.data) === legBookOf(a.data));
    if (!b) continue;
    out.push([a, b]);
    used.add(a.cid).add(b.cid);
  }
  return out;
}

export function startNetting(input: { venue: RoleSession; pool: ShardPool | null; log: (why: string) => void; crossPair?: boolean }): { stop: () => void } {
  const crossPair = input.crossPair ?? process.env.NETTING_CROSS_PAIR === "1";
  const counters = { merged: 0, failed: 0 };
  const pass = async (): Promise<PassResult> => {
    const acs = await readActive(input.venue, crossPair ? [TEMPLATE_IDS.Leg, TEMPLATE_IDS.Resolution] : [TEMPLATE_IDS.Leg]);
    const venueLegs = pick(acs, TEMPLATE_IDS.Leg, decodeLeg).filter((l) => l.data.owner === input.venue.party);
    const resolvedTerms = new Set(acs.filter((c) => c.createdEvent.templateId.endsWith(":PM.Market:Resolution")).map((c) => (c.createdEvent.createArgument as { termsCid: string }).termsCid));
    const plan = planNetting(venueLegs, { crossPair, resolvedTerms }).slice(0, 10);
    const notes: string[] = [];
    for (const [a, b] of plan) {
      try {
        const out = await submit(input.venue, { commandId: netLegsCommandId(a.cid, b.cid), commands: [cmd.mergeLegs(a.cid, b.cid)] });
        if (out.kind === "dry") notes.push(out.note);
        else {
          counters.merged++;
          input.pool?.complete([], new Set(), venueCashCreated(out));
          notes.push(`netted ${a.data.marketId} ${a.data.pairId === b.data.pairId ? "pair" : "cross-pair"} ${a.data.lots} lots`);
        }
      } catch (error) {
        if (isInactive(error)) continue;
        counters.failed++;
        notes.push(`net ${a.data.marketId} failed: ${failureText(error)}`);
      }
    }
    for (const n of notes) input.log(n);
    return { why: `${venueLegs.length} venue legs; ${plan.length} to net${crossPair ? " (cross-pair on)" : ""}; netted ${counters.merged}, failed ${counters.failed}`, detail: { ...counters } };
  };
  return runActor({ name: "netting", log: input.log, dryRun: input.venue.dryRun, everyMs: 20_000, pass });
}
