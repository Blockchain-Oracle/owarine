# STATUS — updated 2026-09-30 08:40 UTC by Claude (lane C10d, copy and status)

```
Where it runs:  local Canton sandbox only (Canton 3.5.17, dpm 3.5.10). Noders DevNet: nothing uploaded, not onboarded. Hosted URL: none yet.
main:           7ad5e7a (B2 BitSafe merged). This lane: slice/C10d-copy-status, 13 commits on c1eb1ff, not merged.
Parity:         Done 0 / 221 · Partial (local sandbox) 59 / 221 · Excluded 18 / 221 · Pending 144 / 221
Capabilities:   live 0 · local 59 · not-live 162 (of 221; docs/plan/capabilities.json)
Gates today:    30 Sep: 0 stage gates · 17 lane merges to main (C9d, B1, C10a, C2y, C10b, C2d, C8g, C11a, C2z, C13a, C3f, C4c, C4d, C4e, C8i, C10c, B2)
Last gates:     29 Sep: 3 (C2b money gate, C1, C3)
Fast gate:      slice/C10d on 30 Sep: typecheck green (web, mobile, packages, ops) · invariants 0 errors, 0 warnings · vitest 292 files, 2,268 tests passed, 52 skipped
Daml gate:      188 tests + 14 setup scripts, 0 failures (B2, 30 Sep 08:24 UTC)
DAR releases:   R1 staged in daml/released/, none on Noders: abu-pm-main 0.5.1 (replaces 0.5.0, which was never uploaded; adds the pre-open RestingCall, K-235), abu-pm-tickets 0.1.3, abu-pm-agents 0.2.1 and abu-pm-games 0.1.1 (rebuilt against main 0.5.1, new package ids). abu-pm-governance 0.1.0 (BitSafe) is LocalNet-only
Blocked on Abu: DevNet (R1) waits on Noders onboarding; iOS on device waits on the App Store Connect record; the hosted deploy waits on the domain
```

## Stages (plan "Build sequence")

"Local" means proven end to end on the local sandbox with the real ops process, with an evidence note. It does not mean on DevNet or on a hosted URL.

### Done (local)

| Stage | Evidence |
|---|---|
| **C0** fork builds | `acceptance.md` C0 rows. The Noders probes move to R1, the Coolify host probes to the first hosted deploy |
| **C1** Canton shell | gate passed 29 Sep |
| **C2** Daml engine | abu-pm-main 0.5.1: the maker vault (C2d) and the pre-open resting call (C7c, K-235); R1 DARs and manifest in `daml/released/` |
| **C2z** R1 rehearsal | `evidence/c2z-r1-rehearsal.md`: the whole R1 sequence and the four-viewpoint first call on one sandbox |
| **C3** ledger, projector, ops | gate passed 29 Sep; C3f: a slow write pauses under the same command id |
| **C5** proof and analytics | `ux/c5` |
| **C6** lanes and states | `evidence/c6-*`, `c6d`, `c6e`: crypto, stocks, xStocks, pre-IPO, baskets, Gap, events |
| **C7a** trading balance and exit | `evidence/c7a-exit-2026-09-29.md` |
| **C8** tickets, agents, desk, maker vault | `evidence/c8e`, `c8f`, `c8g`, `c8i`, `c2d-maker-vault.md` |
| **C9** games | `evidence/c9b`, `c9c`, `c9d-seats-games.md` |

### In flight

| Lane | Branch | What |
|---|---|---|
| C8j live markets | `slice/C8j-live-markets` | PreStocks prices on this host, valuation lanes only with an entitled Pyth key, desk check timing |
| C10d copy and status | `slice/C10d-copy-status` | This file, the registry refresh, app copy that matched the reference and not the code, docs-site marks and old media |

### Not done, and what each waits on

| Stage | State | Waits on |
|---|---|---|
| **C2x / R1** on DevNet | not started | Abu: Noders onboarding and the 4 DAR uploads (below) |
| **C4 / M1** first call, hosted | local only | the domain and DNS; R1 on DevNet; the phone on TestFlight |
| **C7b** Canton Coin rail | not started | — |
| **C8d** baskets hub, valuation hub | not started | valuation lanes need an entitled Pyth key |
| **C8** gaps | named | Boost knock-out never triggered live; the desk's live `Mandate_Trade` never ran; runner self-host refused |
| **C9** gap | named | Lucky never placed from its screen (needs an open stock Window) |
| **C10** public story and deploy | copy, docs site and readiness merged | landing and `/download` updates; docs site on Coolify; the sponsor band (C-S25) |
| **C11** iOS | C11a merged: identity, seat link, push, `expo export` green | Abu: app name, Apple identifiers, App Store Connect record. Never run on a simulator or device |
| **C13** assistant and community | C13a merged (tests and code reading) | a sandbox drive; X keys; the iOS universal-link id |
| **BitSafe** | B2 merged: abu-pm-governance 0.1.0, 14 Daml tests | the LocalNet run (go/no-go in `docs/business/bitsafe.md`) |
| **Grofty** | not started | an invite |
| **Business** | B1 drafts merged | nothing sent; 0 interviews, 0 usability tests |

## Needs Abu

1. **Every day:** press "claim mana" on the HackCanton dashboard. It takes 10 separate days to reach 1,000, so no day can be skipped. Write the evening journal entry in your own words.
2. **DevNet, once (about 20 minutes):** onboard the Noders wallet, sign in to the Console with Authfactory, create the 19 parties, save the party list on this Mac, then upload the 4 DARs in order (main 0.5.1, tickets 0.1.3, agents 0.2.1, games 0.1.1). The clicks are in `docs/plan/runbooks/devnet-r1.md`. Then tell me "done".
3. **iPhone app:** confirm the name "Agari Canton" and the bundle id `xyz.useagari.canton` (they cannot change later). Then register the App Group and the two App IDs in the Apple Developer portal, create the App Store Connect record, and send me its Apple ID number. The steps are in `docs/evidence/c11a-ios.md`, "What Abu must do".
4. **Website:** choose the domain, add the 5 A records at Namecheap (`@`, `www`, `ops`, `room`, `docs`), and tell me whether I may use a Coolify API token or you prefer to click the deploy steps. See `docs/plan/runbooks/coolify-deploy.md` §1.
5. **At the end:** record the video and send the submission form (delivery closes 9 Oct 23:59 UTC).

Everything else has a default in `decisions.md` that Abu can overrule.

## Known gaps (named, not hidden)

- The Docker images have not been built here (load too high for `next build`); the first build happens on the Coolify server.
- The phone has never run against Canton: it typechecks and exports only.
- Pyth, the Pyth index and Switchboard are down on Canton (no entitled key; Switchboard Surge not answering). Stocks settle on RedStone and Alpaca, xStocks on the Jupiter Price v3 median.
- Resting calls before the bell run on the local sandbox only (C7c, K-235 to K-237): none has been placed on a hosted network, and the phone screens are typechecked, not run.
- The web and phone still show PreStocks marks in the per-price source line and the landing band; the plan asks for written permission for any third-party mark (C-S25), and none is recorded.
