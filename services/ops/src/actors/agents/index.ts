/**
 * The agents' venue side (C8f):
 *
 *   POST /internal/agents/enrol   the seat's standing offers (GrantDesk, DeskOffer, SubscriberInvite, CreatorLicense)
 *   keeper                        creators' aggregate fee payouts (License_Payout), once a period per creator
 */
import { runActor } from "../../runtime/actor";
import type { VenueContext } from "../venue/context";
import { handleEnrol } from "./enrol";
import { payCreators, PAYOUT_PERIOD_SEC } from "./fees";

type Handler = (body: unknown) => Promise<{ status: number; body: unknown }>;

export interface AgentsVenueHandle {
  routes: Record<string, Handler>;
  stop: () => void;
}

export const AGENTS_ROUTES = ["/internal/agents/enrol"] as const;

export async function startAgentsVenue(input: { venue: VenueContext; log: (why: string) => void; everyMs?: number }): Promise<AgentsVenueHandle | null> {
  const session = input.venue.session("venue");
  if (!session) {
    input.log("VENUE_PARTY and the parties file are missing: no seat is enrolled for agents");
    return null;
  }
  const infrastructure = new Set(Object.values(input.venue.parties));
  let lastPeriod = -1;
  const keeper = runActor({
    name: "agents-fees",
    log: input.log,
    dryRun: session.dryRun,
    everyMs: input.everyMs ?? 60_000,
    pass: async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const period = Math.floor(nowSec / PAYOUT_PERIOD_SEC);
      if (period === lastPeriod) return { why: `fees paid for period ${period}; next at ${new Date((period + 1) * PAYOUT_PERIOD_SEC * 1000).toISOString()}` };
      const r = await payCreators(session, nowSec, input.log);
      lastPeriod = period;
      return { why: `period ${period}: ${r.paid} payout(s) to ${r.creators} creator(s) with held fees`, detail: r };
    },
  });
  return {
    routes: {
      "/internal/agents/enrol": async (body) => {
        try {
          return await handleEnrol(session, infrastructure, body, input.log);
        } catch (error) {
          return { status: 500, body: { diagnosis: { kind: "unknown", retryable: true, technical: error instanceof Error ? error.message : String(error) } } };
        }
      },
    },
    stop: keeper.stop,
  };
}
