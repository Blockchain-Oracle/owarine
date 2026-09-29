/**
 * The agents' venue side (C8f), placeholder the agents lane replaces:
 *
 *   POST /internal/agents/enrol   the seat's standing offers (GrantDesk, DeskOffer, SubscriberInvite, CreatorLicense)
 *   keeper                        creators' aggregate fee payouts (License_Payout)
 */
import type { VenueContext } from "../venue/context";

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
  return { routes: {}, stop: () => undefined };
}
