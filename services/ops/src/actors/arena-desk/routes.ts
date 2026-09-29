/**
 * The arena desk's `POST /internal/games/*` (HMAC, the web's route handlers only):
 *
 *   state                the arena (public facts: tiers, windows, what it escrows)
 *   match                one match by its room id, whichever contract holds it now
 *   season               the newest season pool, or the one named
 *   open                 what a creator's `Arena_OpenDuel` needs from the sealed deck: only for that pairing's creator,
 *                        and only while the matchmaker holds it (WHO comes from the web's lease, never a body field
 *                        the browser wrote)
 *   season/distribute    the season admin's payout: seat addresses → their venue accounts → one `Season_Distribute`
 */
import { diagnosis, type Diagnosis } from "@agari/core/types";
import { TEMPLATE_IDS } from "@agari/daml";
import { decodeVenueAccount, failureText, pick, readActive, submit } from "@agari/markets/ops/canton";
import { gcmd, seasonCommandId } from "@agari/markets/ops/games";
import type { ArenaDesk } from "./desk";

type Handler = (body: unknown) => Promise<{ status: number; body: unknown }>;

const refused = (d: Diagnosis, status = 409) => ({ status, body: { kind: "refused", diagnosis: d } });
const bodyOf = (b: unknown): Record<string, unknown> => (typeof b === "object" && b !== null && !Array.isArray(b) ? (b as Record<string, unknown>) : {});
const str = (b: Record<string, unknown>, k: string): string | null => (typeof b[k] === "string" && (b[k] as string).length > 0 ? (b[k] as string) : null);

export function arenaRoutes(desk: ArenaDesk): Record<string, Handler> {
  return {
    "/internal/games/state": async () => ({ status: 200, body: await desk.state() }),

    "/internal/games/match": async (raw) => {
      const matchId = str(bodyOf(raw), "matchId");
      if (!matchId) return { status: 400, body: { diagnosis: diagnosis("unknown", "expected {matchId}") } };
      return { status: 200, body: { view: await desk.match(matchId) } };
    },

    "/internal/games/season": async (raw) => ({ status: 200, body: { pool: await desk.season(str(bodyOf(raw), "seasonId") ?? undefined) } }),

    "/internal/games/open": async (raw) => {
      const b = bodyOf(raw);
      const matchId = str(b, "matchId")?.toLowerCase();
      const party = str(b, "party");
      const address = str(b, "address");
      if (!matchId || !party || !address) return { status: 400, body: { diagnosis: diagnosis("unknown", "expected {matchId, party, address}") } };
      const deal = desk.pendingDeal(matchId);
      if (!deal) return refused(diagnosis("order-expired", "no sealed deck is waiting for that match (opened already, dissolved, or never dealt)"));
      if (deal.creator !== address) return refused(diagnosis("signer-required", "only the pairing's creator opens the match"));
      const creatorParty = await desk.seats.partyOf(address);
      if (creatorParty !== party) return refused(diagnosis("signer-required", "the creator's lease does not match the seat that was paired"));
      const challenger = await desk.seats.partyOf(deal.challenger);
      if (!challenger) return refused(diagnosis("order-expired", "the opponent's seat is no longer leased"));
      const snap = await desk.snapshot();
      const t = snap.terms;
      if (!t) return refused(diagnosis("not-deployed", "no ArenaTerms on this participant (run the bootstrap)"), 503);
      const tier = t.data.tiers.find((x) => x.tierId === deal.tierId && x.enabled);
      if (!tier) return refused(diagnosis("market-not-trading", `the ${deal.tierId} tier is not open`));
      return {
        status: 200,
        // Bigints travel as decimal strings: the internal server's `jsonText` writes them so.
        body: {
          kind: "open", arenaCid: t.cid, arenaId: t.data.arenaId, challenger, tierId: tier.tierId, potEach: tier.potEach,
          disclosure: { contractId: t.cid, templateId: t.templateId, createdEventBlob: t.createdEventBlob, synchronizerId: t.synchronizerId },
          deckHash: deal.deckHash, deckSize: deal.deckSize, clientSeeds: deal.clientSeeds, joinWindowSec: t.data.params.joinWindowSec,
        },
      };
    },

    "/internal/games/season/distribute": async (raw) => {
      const b = bodyOf(raw);
      const seasonId = str(b, "seasonId");
      const payouts = Array.isArray(b.payouts) ? (b.payouts as Array<Record<string, unknown>>) : null;
      if (!seasonId || !payouts) return { status: 400, body: { diagnosis: diagnosis("unknown", "expected {seasonId, payouts: [{address, amountBase}]}") } };
      const snap = await desk.snapshot({ fresh: true });
      const pool = snap.pools.find((p) => p.data.seasonId === seasonId);
      if (!pool) return refused(diagnosis("not-deployed", `no season pool ${seasonId}`));
      const acs = await readActive(desk.venue, [TEMPLATE_IDS.VenueAccount]);
      const accounts = pick(acs, TEMPLATE_IDS.VenueAccount, decodeVenueAccount).filter((a) => a.data.venue === desk.venue.party);
      const rows: { account: string; amount: bigint }[] = [];
      for (const p of payouts) {
        const address = typeof p.address === "string" ? p.address : "";
        const amount = typeof p.amountBase === "string" && /^\d+$/.test(p.amountBase) ? BigInt(p.amountBase) : 0n;
        const party = await desk.seats.partyOf(address);
        const account = party ? accounts.find((a) => a.data.owner === party) : undefined;
        if (!account) return refused(diagnosis("unknown", `no venue account for winner ${address}`));
        rows.push({ account: account.cid, amount });
      }
      try {
        const out = await submit(desk.venue, { commandId: seasonCommandId("distribute", seasonId, pool.cid), commands: [gcmd.distributeSeason(pool.cid, rows)] });
        if (out.kind !== "done") return refused(diagnosis("unknown", "DRY RUN: the distribution was prepared, not sent"));
        desk.invalidate();
        return { status: 200, body: { kind: "confirmed", updateId: out.transaction.updateId, paid: rows.length } };
      } catch (error) {
        return refused(diagnosis("contract-revert", failureText(error)));
      }
    },
  };
}

export const ARENA_ROUTES = ["/internal/games/state", "/internal/games/match", "/internal/games/season", "/internal/games/open", "/internal/games/season/distribute"] as const;
