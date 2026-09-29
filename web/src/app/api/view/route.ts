import type { NextRequest } from "next/server";
import { classifyRejection, viewAs } from "@agari/markets/server";
import { seatServer } from "@/lib/ledger.server";
import { diagnosisReply, refusal, replyWith, seatFromRequest } from "@/lib/seat.server";

/**
 * The view switcher (plan §5): a live active-contracts read AS `me` (the caller's leased seat) or a reserved persona
 * (`alice`, `bob`, `outsider`), echoing the literal `filtersByParty` body. `as` is an enum mapped on the server; it
 * can never name another visitor's seat, or the switcher itself would be the leak.
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
    const view = await viewAs(state.server.client, party);
    return replyWith({ as, ...view, note: `queried as party ${view.party}; the participant returns only contracts this party is a stakeholder of` });
  } catch (error) {
    return diagnosisReply(classifyRejection(error, { step: "read" }), 503);
  }
}
