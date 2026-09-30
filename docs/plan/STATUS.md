# STATUS — updated 2026-09-30 03:15 UTC by Claude (lane C10a, deploy readiness)

```
Where it runs:  local Canton sandbox only (Canton 3.5.17, dpm 3.5.10). Noders DevNet: nothing uploaded, not onboarded. Hosted URL: none yet.
main:           e40eb7b (C9d merged at f6ac105, then the B1 business drafts)
Progress:       parity rows Done 0 / 221 · Partial (proven on the local sandbox) 49 / 221 · Excluded 18 / 221
Capabilities:   live 0 · local 49 · not-live 172 (of 221; docs/plan/capabilities.json)
Stage gates:    29 Sep: 3 (C2b money gate, C1, C3) · 30 Sep: 0 so far
Fast gate:      slice/C10a on 30 Sep: typecheck green · invariants 0 errors, 1 warning (existing) · vitest 246 files, 2,061 tests passed, 25 skipped
DAR releases:   none on Noders. Local: abu-pm-main 0.4.0 (0.5.0 in flight), abu-pm-tickets 0.1.2, abu-pm-agents 0.2.0, abu-pm-games 0.1.0
Blockers:       DevNet (C2x, R1) waits on Abu's Noders onboarding; iOS (C11) waits on the App Store Connect record
```

## Stages (plan "Build sequence")

"Local" means proven end to end on the local sandbox with the real ops process, with an evidence note. It does not mean on DevNet or on a hosted URL.

| Stage | State | Evidence / what is left |
|---|---|---|
| **C0** fork builds | done, except the Noders and host probes | Baseline, import, tag `hackcanton-s3-start`, stylesheets, invariants (`acceptance.md` C0 rows). The Noders probes move to C2x. The Coolify host probes move to the first hosted deploy (`runbooks/coolify-deploy.md` §6) |
| **C1** Canton shell, web and mobile | gate passed 29 Sep (local) | `acceptance.md` C1 gate, dd04218 |
| **C2** Daml engine | 0.4.0 merged (ab15a17); **0.5.0 in flight** (slice C2d, maker vault) | `dpm test` green on main (175 scripts at C8e). 0.5.0: 4 commits on `slice/C2d-maker-vault`, not merged |
| **C2x** DevNet skeleton / **R1** | **not started** | Needs Abu's Noders onboarding (below). Then `runbooks/devnet-r1.md` |
| **C3** ledger, projector, ops | gate passed 29 Sep (local) | `evidence/c3-gate-2026-09-29.md`: 43 × 1-minute Windows per lane, a kill and restart, projection rebuild equals live |
| **C4 / M1** first call | local only | Seat, ticket, view switcher, portfolio, grant (`ux/c4b`, 526b332; copy C4c). Not done: the hosted deploy, `first-call.ts` on Noders, the phone on TestFlight, tag `m1-first-call` |
| **C5** proof and analytics | local | `ux/c5`, 9321ae3: re-verify passes 23 checks, the board and stats from publications, `/status` Canton rows |
| **C6** lanes and states | local | `evidence/c6-lanes…`, `c6-realised-vol…`, `c6d-gap-events`, `c6e-stocks-events`. Not live: valuation lanes (no entitled Pyth key), Switchboard (down upstream) |
| **C7a** trading balance and exit | local | `evidence/c7a-exit-2026-09-29.md` |
| **C7b** Canton Coin rail | not started | — |
| **C8** tickets, agents, desk | tickets merged (C8c, C8e: 0.1.2); agents merged (C8f); **maker vault in flight** (C2d); **agents UX in flight** (slice C8g) | `evidence/c8e-tickets-ux.md`, `c8f-agents.md`. Not shown live: the Boost knock-out, the desk's live leg, runner self-host. C8d (baskets, valuation hub) not started |
| **C9** games | merged (C9b, C9c, C9d), local | `evidence/c9b…`, `c9c…`, `c9d-seats-games.md`: a decided UI duel, rank, the season payout, the bet-gated room. Owed: Lucky placed from its screen (needs a quoting stock Window) |
| **C10** public story and deploy | **in flight** (this lane: deploy readiness) | Done here: 7 IP readers on `clientIp()`, region hold on DB-IP, ops indexer default, Dockerfiles, env examples, runbooks. Not started: landing and `/download` updates, the docs site on Coolify, sponsor visibility |
| **C11** iOS | **not started** | Needs the App Store Connect record (below). The phone code typechecks with every stage, but nothing has run on a device or simulator against Canton |
| **C13** assistant and community | not started as a stage | The bet-gated room works locally (C9d). Sensei, reels, takes, X bind, receipts and relay: not yet |
| **BitSafe** add-on | not started in this repo | No run evidence here. The plan's go/no-go (one overnight run Wed 30) stands |
| **Grofty** add-on | not started | No invite recorded. The outreach draft is in `docs/business/outreach.md` |
| **Business** | drafts merged (B1, e40eb7b) | 20 files in `docs/business/`. Nothing sent or uploaded. 0 interviews, 0 usability tests |

## Needs Abu

- **Every day:** press "claim mana" on the HackCanton dashboard. It needs 10 separate days to reach 1,000, so no day can be skipped from today (30 Sep).
- **Every evening:** write your journal entry in your own words.
- **To start DevNet (about 15 minutes, once):** sign in to the Noders wallet ("Onboard yourself") and the Console ("Sign in with Authfactory"), create 19 parties from the list, then upload 4 files in the order given. The exact clicks are in `docs/plan/runbooks/devnet-r1.md`. Nothing on DevNet can start before this.
- **For the phone app:** create the new app record in App Store Connect and tell me its bundle id. The iOS work cannot start without it.
- **For the website:** buy or choose the domain at Namecheap, then add 5 A records pointing at your Coolify server (`@`, `www`, `ops`, `room`, `docs`). The list and a check command are in `docs/plan/runbooks/coolify-deploy.md` §1. Also tell me whether I may use a Coolify API token, or whether you prefer to click the deploy steps yourself.
- **This week (business):** send the outreach messages, and book at least 3 interviews (`docs/business/README.md`).

Everything else has a default in `decisions.md` that Abu can overrule.

## In flight

| Lane | Branch | What |
|---|---|---|
| C2d maker vault | `slice/C2d-maker-vault` | abu-pm-main 0.5.0: the maker vault's book and NAV, bindings, `@agari/markets/maker`, `MAKER_MODE=vault` |
| C8g agents UX | `slice/C8g-agents-ux` | Agents, strategies and desk through the real screens (9 fixes so far) |
| C10a deploy readiness | `slice/C10a-deploy-status` | This file, the registry, deploy readiness, the runbooks |

## Known gaps (named, not hidden)

- The Docker images have not been built. This host's load average was about 110 (the rule is no `next build` above 40), so the Dockerfiles were reviewed statically. The install layer was checked offline with the exact files the Dockerfiles copy. The first build happens on the Coolify server.
- PreStocks answers 429 to this development host, so the pre-IPO and basket lanes pause here. On the server this is unmeasured.
- The phone has never run against Canton: it typechecks only.
