import type { NextRequest } from "next/server";
import { classifyRejection, relabelView, viewAs } from "@agari/markets/server";
import { seatServer } from "@/lib/ledger.server";
import { diagnosisReply, refusal, replyWith, seatFromRequest } from "@/lib/seat.server";

/**
 * The view switcher (plan §5): a live active-contracts read AS `me` (the caller's leased seat) or a reserved persona
 * (`alice`, `bob`, `outsider`), echoing the literal `filtersByParty` body. `as` is an enum mapped on the server; it
 * can never name another visitor's seat, or the switcher itself would be the leak. Every party in the rows is named by
 * its role (C4d M4: `venue`, `alice`, `you`, `a seat`, …), so no party id but the one queried leaves the server.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PERSONAS = ["alice", "bob", "outsider"] as const;
type Persona = (typeof PERSONAS)[number];

export async function GET(request: NextRequest) {
  const as = request.nextUrl.searchParams.get("as") ?? "me";
  let party: string | null;
  if (as === "me") {
    const auth = await seatFromRequest(request, { write: false });
    if (!auth.ok) return auth.response;
    party = auth.seat.lease.party;
  } else if ((PERSONAS as readonly string[]).includes(as)) {
    const state = seatServer();
    if (!state.ok) return refusal("not-deployed", state.reason, 503);
    party = state.server.parties.personas[as as Persona];
    if (!party) return refusal("not-deployed", `no ${as} persona on this network`, 404);
  } else {
    return refusal("unknown", "as must be me, alice, bob or outsider", 400);
  }
  const state = seatServer();
  if (!state.ok) return refusal("not-deployed", state.reason, 503);
  try {
    const view = relabelView(await viewAs(state.server.client, party), roleLabels(state.server.parties, party, as));
    return replyWith({ as, ...view, note: `queried as party ${view.party}; the participant returns only contracts this party is a stakeholder of` });
  } catch (error) {
    return diagnosisReply(classifyRejection(error, { step: "read" }), 503);
  }
}

/** Each party this deployment knows, by the role a viewer understands; the queried party is "you" or its persona. */
function roleLabels(p: { venue: string | null; agentRunner: string | null; oracles: string[]; seats: string[]; personas: Record<Persona, string | null> }, queried: string, as: string): Map<string, string> {
  const labels = new Map<string, string>();
  for (const s of p.seats) labels.set(s, "a seat");
  p.oracles.forEach((o, i) => labels.set(o, `oracle ${i + 1}`));
  if (p.agentRunner) labels.set(p.agentRunner, "agent runner");
  for (const persona of PERSONAS) {
    const party = p.personas[persona];
    if (party) labels.set(party, persona);
  }
  if (p.venue) labels.set(p.venue, "venue");
  labels.set(queried, as === "me" ? "you" : as);
  return labels;
}
