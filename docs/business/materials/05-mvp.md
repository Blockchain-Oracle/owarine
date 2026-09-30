# MVP Materials: Agari on Canton

*Platform material 5 of 6. The criterion reads: "Working prototype, code quality and depth of Canton integration."*

## What it is

Agari, Abu's prediction market on Solana (web and a native iOS app), ported to **Canton and Daml**. The Solana programs were replaced by four Daml packages, and the app now reaches the ledger through its own JSON Ledger API v2 client. Prior work is disclosed in `docs/business/prior-work-disclosure.md`; judged work starts at the tag `hackcanton-s3-start`.

## The one workflow to try

Take a guest seat → buy Up on a 1-minute BTC window at a firm quote → see who can see it → sell half back → watch three oracle parties print, the resolver resolve and the venue pay, with no signature from you.

## Canton integration, concretely

| Layer | What | Where |
|---|---|---|
| Daml | `abu-pm-main` (markets, quotes, legs, cash, oracles, resolution, reserve, grants, events), `abu-pm-tickets`, `abu-pm-agents`, `abu-pm-games`. 11,679 lines in 57 files, all written in the window | `daml/` |
| Tests | 175 Daml Script tests, including outsider-sees-nothing, conservation over 200-step random sequences, resolve-exactly-once, and deadline races | `daml/pm-tests`, `docs/evidence/c8e-tickets-ux.md` |
| Ledger client | JSON Ledger API v2: per-party ACS paging, command deduplication by command id, the `/v2/updates` stream | `packages/ledger` |
| Venue operations | window roller, 3 oracle feeders, pricer, quote issuer, resolver, batch settler, projector | `services/ops` |
| Privacy in the main route | "Who can see this": Alice / Bob / Outsider / You, each a live ledger query as that party with the request body on screen | `docs/evidence/ux/c4b/08-view-*.png` |

## Evidence (local Canton sandbox 3.5.17)

- 43 consecutive 1-minute windows per lane resolved unattended; 160 trades with 0 failures; a crash mid-window recovered (`docs/evidence/c3-gate-2026-09-29.md`).
- A sell-back before the close, and settlement after a partial sale (`docs/evidence/c7a-exit-2026-09-29.md`).
- Every cadence from 1 minute to 1 day, plus a committee-attested event (`docs/evidence/c6-lanes-2026-09-29.md`, `c6d-gap-events.md`).
- Range, moonshot, parlay, boost, short and Earn tickets placed through the real screens (`docs/evidence/c8e-tickets-ux.md`).
- An agent placing a call through a capped grant, where the agent never sees the owner's cash (`docs/evidence/c8f-agents.md`).
- A duel decided on the ledger with a sha-256 deck reveal checked in Daml (`docs/evidence/c9d-seats-games.md`).

## Trust boundary, stated plainly

- On the shared Noders participant, one ledger user can act as all our parties. So the ledger cannot enforce which party a seat acts as; our code does. A route takes the party only from the seat's own lease, never from the request.
- The three price feeders are separate parties, but we run all three. Their prints can be re-derived from the public 1-minute candles, but they are not independent oracles.
- Positions are hidden from other traders and the public, not from the venue or from the node that hosts the parties.

## Not yet shown

- Noders DevNet, a hosted URL and the iOS app on Canton. Update this section when they land.

## Links

Repo: `<public repo URL>` · Live demo: `<URL>` · Video: `<URL>`
