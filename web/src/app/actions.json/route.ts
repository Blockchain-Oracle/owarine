import { actionHeaders, type ActionsJson } from "@agari/core/x";

/**
 * `GET /actions.json` — the file that makes Agari's links unfurl as cards (S11, `00-plan.md` §S11; adapted in C13a).
 *
 * A card client that meets `useagari.xyz/markets/<id>` looks here to learn which of our URLs it may `GET` as a card.
 * The rules are the reference's: a Window's page maps to its card, whose buttons now answer with a signed Window share
 * link rather than a transaction (`@agari/core/x` `actions.ts`). It is a route handler rather than a file in `public/`
 * because the CORS headers are part of the contract, not a deployment setting someone has to remember.
 */
export const runtime = "nodejs";
export const dynamic = "force-static";

const BODY: ActionsJson = {
  rules: [
    // A Window's own page, shared from the app or by the X relay.
    { pathPattern: "/markets/*", apiPath: "/api/actions/w/*" },
    // The idiomatic `/actions/**` surface every card client probes first.
    { pathPattern: "/actions/**", apiPath: "/api/actions/**" },
  ],
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: actionHeaders() });
}

export function GET() {
  return Response.json(BODY, { headers: actionHeaders() });
}
