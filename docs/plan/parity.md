# Parity ledger

Seeded 2026-09-29 in C0 from the reference's local ledger (`agari-wt/s26/docs/plan/parity.md`, 103 rows, Agari @ `661a24ee` lineage), then extended with every capability in the fidelity map (`context/12-port-design/13-fidelity-ledger.md` in the knowledge base) that was not already a row. The Canton disposition of each row comes from `00-plan.md` ("Fidelity contract" and "Every remaining capability, with its disposition").

- **Class:** Exact / Adapted / Additive / Blocked, or Excluded only with a dated owner decision.
- **Status:** Pending → Shell → Partial → Done, or Blocked with its resolution. Excluded rows read Excluded.
- **Owner:** the stage that completes the row (`00-plan.md`, "Build sequence"). Earlier stages may advance it to Shell or Partial.
- **Rules:** rows are only added or advanced, and only at stage gates. Evidence is a commit, a route check or an `acceptance.md` row. A row is Done only when its entry in `capabilities.json` can be `live` (gate passed and acceptance row exists).
- **Evidence column (C10a, 30 Sep; refreshed C10d, 30 Sep):** a row is Partial with "local sandbox" evidence when its `capabilities.json` entry is `local`: proven end to end on the local Canton sandbox with the real ops process, not yet on Noders DevNet or a hosted URL. `capabilities.json` cites the exact evidence lines (`file#L<n>`). None is Done, because nothing is on DevNet yet.
- **C10d refresh:** read every evidence note merged since C10a (C2d maker vault, C2z R1 rehearsal and first call, C3f ledger retry, C4c seat link, C4d security, C8e, C8g and C8i agents and tickets, C9c and C9d games and seats, C11a iOS, C13a community, C10c docs). Nine rows moved to Partial (C-OPS-13, L-52, L-53, A-1c, C-S21a, C-S21b, C-S21c, C-OPS-12, A-2c); 21 Partial rows gained evidence. C3f, C4c, C4d, C11a, C13a and C10c ran no sandbox drive (unit tests, code reading, `expo export` or a static rewrite), so they move no row.
- **Reference ids are kept** (L-, Y-, A-) so each row traces to the reference ledger; new rows use `C-`. The reference's own Class/Status is kept in the last column for comparison.

Status as of 30 Sep (C10d): rows proven on the local sandbox are Partial and cite their evidence; every other row that is not Excluded is Pending.

## Baseline (L)

| # | Capability | Class | Status | Owner | Canton disposition | Reference class / status | Evidence |
|---|---|---|---|---|---|---|---|
| L-01 | Root layout, providers, pre-paint theme, fonts, PWA manifest | Exact | Pending | C1 | Unchanged over the adapter | Exact / Done | — |
| L-02 | Desktop header, grouped nav, balance pill, account menu | Adapted | Partial | C1, C4 | Connected state is the reference's avatar + dropdown: seat, party id, lease time left, reset seat | Exact / Done | local sandbox: [ux/c4b](../evidence/ux/c4b) · `526b332` · [c9d-seats-games](../evidence/c9d-seats-games.md) · [c8i-agents-gaps](../evidence/c8i-agents-gaps.md) |
| L-03 | Mobile pill nav + "Everything" drawer | Exact | Pending | C1 | Unchanged | Exact / Done | — |
| L-04 | AppStrip, Marquee ticker, footer, grain, cursor, theme toggle | Adapted | Pending | C1, C5 | Marquee sentiment cell reads `/api/sentiment` from opt-in `Publication`s (k = 5 floor); BTC/ETH on the marquee kept by default (K-008) | Adapted / Done | — |
| L-05 | Design system (Yosuku port) | Exact | Pending | C0 | The reference design system used directly: `web/src/styles/yosuku/**` byte-identical in the repo (`2855af5`, K-002) | Exact / Done | — |
| L-06 | Toast / transaction feedback | Exact | Pending | C1 | Unchanged; receipts name the update id | Exact / Done | — |
| L-07 | Error boundaries | Exact | Pending | C1 | Unchanged; `components/states/*` reused first | Exact / Done | — |
| L-08 | Write-journal recovery on session start | Adapted | Pending | C4 | Journal id is the Canton `commandId`; recovery reads completions on `DUPLICATE_COMMAND`, never re-sends under a new id | Adapted / Partial | — |
| L-09 | First-run Tutorial | Adapted | Pending | C1 | Copy re-pointed from Solana to Canton | Adapted / Done | — |
| L-10 | Wrong-network banner | Adapted | Pending | C1 | Stays unmounted: D-120's reasoning holds (the participant is the app's); recorded as a C1 decision | Adapted / Done | — |
| L-11 | `/` editorial landing | Adapted | Pending | C10 | Canton mark in the hero; Built-on band re-pointed; Cover section shows the reference's no-holdings state until C7b | Adapted / Done | — |
| L-12 | How it works | Adapted | Pending | C10 | Rewritten for Canton | Adapted / Done | — |
| L-13 | Demo | Adapted | Pending | C10 | Launch film re-shot on the Canton build by Abu (reference HyperFrames project) | Adapted / Partial | — |
| L-14 | Pitch folio | Adapted | Pending | C10 | Rewritten for Canton | Adapted / Done | — |
| L-15 | Stats / traction | Adapted | Partial | C5 | Recount from the venue projection; market-level stats only above k = 5 participants | Adapted / Done | local sandbox: [ux/c5](../evidence/ux/c5) · `9321ae3` |
| L-16 | Status | Adapted | Partial | C4 | Ledger rows (party, offset, token age) and seat-pool size in the existing `StatusRows` | Adapted / Done | local sandbox: [ux/c5](../evidence/ux/c5) · `9321ae3` · [c9d-seats-games](../evidence/c9d-seats-games.md) |
| L-17 | News wire | Exact | Pending | C13 | Unchanged (Finnhub) | Adapted / Done | — |
| L-18 | Download / PWA install | Adapted | Pending | C10, C11 | Public TestFlight link and Android APK (SHA-256 + QR) | Adapted / Done | — |
| L-19 | Native app + `/native-auth` | Adapted | Pending | C11, C13 | Reclassified (plan rev 5): the native app exists in the reference, so this is Done there and Adapted here; `/native-auth` becomes the X sign-in handoff for the app | Blocked (no native source) / Blocked | — |
| L-20 | Documentation site | Adapted | Pending | C10 | Page-by-page rewrite list made in C0; `architecture/*` and `start/wallet` rewritten; see C-DOC-01 | Adapted / Partial | — |
| L-21 | Legacy redirects | Exact | Pending | C1 | Unchanged | Exact / Done | — |
| L-22 | Share cards (The Call, Earned Heat) | Adapted | Pending | C5 | Unchanged surface; data from the projection (own seat) or publications | Adapted / Done | — |
| L-23 | Social OG images | Exact | Pending | C10 | Unchanged surface; brand constants only | Adapted / Done | — |
| L-24 | Wallet connect / disconnect / account switch | Adapted | Partial | C1, C4 | Wallet becomes a seat: guest seat on web, Keychain seat key on iOS; Grofty is an additive web-only connector | Adapted / Done | local sandbox: [ux/c4b](../evidence/ux/c4b) · `526b332` · [c9d-seats-games](../evidence/c9d-seats-games.md) · [c2z-r1-rehearsal](../evidence/c2z-r1-rehearsal.md) · [c9c-games-ux](../evidence/c9c-games-ux.md) |
| L-25 | Get test funds | Adapted | Partial | C4 | Demo-cash credit into `VenueCash`, server-side, also on seat lease; no SOL leg | Adapted / Done | local sandbox: [ux/c4b](../evidence/ux/c4b) · `526b332` · [c8e-tickets-ux](../evidence/c8e-tickets-ux.md) · [c2z-r1-rehearsal](../evidence/c2z-r1-rehearsal.md) · [c9c-games-ux](../evidence/c9c-games-ux.md) |
| L-26 | Add-money modal + CreditWelcome | Adapted | Partial | C4 | Demo-credits grant (`CreditWelcome`, `AddFunds`) | Adapted / Done | local sandbox: [ux/c4b](../evidence/ux/c4b) · `526b332` |
| L-27 | Tap-trading (session key + SESSION grant + sponsor) | Adapted | Pending | C1 | Not needed: a seat already trades in one tap, and the fast-mode chip says so | Adapted / Partial | — |
| L-28 | Trading Balance vault | Adapted | Partial | C7a | `VenueCash` is the trading balance | Adapted / Partial | local sandbox: [c7a-exit](../evidence/c7a-exit-2026-09-29.md) · [c2z-r1-rehearsal](../evidence/c2z-r1-rehearsal.md) |
| L-29 | `/markets` hero-as-ticket | Exact | Pending | C4 | Unchanged over the venue price ladder | Adapted / Partial | — |
| L-30 | §01 live-now rail cards | Exact | Pending | C4 | Unchanged over the venue price ladder | Adapted / Done | — |
| L-31 | §02 "Just ask" word board | Exact | Pending | C4 | Unchanged | Adapted / Done | — |
| L-32 | Call ticket (one-tap) | Adapted | Partial | C4 | Firm house quote over the published venue price ladder; StepProgress + quote ring per Abu's D-081 choice (default K-010) | Adapted / Partial | local sandbox: [ux/c4b](../evidence/ux/c4b) · `526b332` · [c6e-stocks-events](../evidence/c6e-stocks-events.md) · [c2z-r1-rehearsal](../evidence/c2z-r1-rehearsal.md) · [c9d-seats-games](../evidence/c9d-seats-games.md) |
| L-33 | Verdict + inline claim | Adapted | Pending | C4 | Venue `SettleBatch` pays without a signature; `Leg_Claim` for the owner; void returns cost plus fee | Adapted / Partial | — |
| L-34 | Claim-all plate | Adapted | Pending | C4 | Shape under venue-batched settle not yet specified (fidelity map: UNCLEAR); settled in the C4 spec | Adapted / Done | — |
| L-35 | Plain-position cash-out | Adapted | Partial | C7a | `BuyQuote` exit | Adapted / Done | local sandbox: [c7a-exit](../evidence/c7a-exit-2026-09-29.md) |
| L-36 | Range (ticket mode + `/games/range`) | Adapted | Partial | C8 | Range in its own package, pins `MarketTerms` (C-DAML-03) | Adapted / Partial | local sandbox: [c8e-tickets-ux](../evidence/c8e-tickets-ux.md) · [c6d-gap-events](../evidence/c6d-gap-events.md) |
| L-37 | Boost 2×/3× (LeverageReserve) | Adapted | Partial | C8 | Knock-out is an oracle-quorum barrier; `leverage-keeper` posts it | Adapted / Partial | local sandbox: [c8e-tickets-ux](../evidence/c8e-tickets-ux.md) |
| L-38 | Parlay | Adapted | Partial | C8 | Parlay, bilateral | Adapted / Partial | local sandbox: [c8e-tickets-ux](../evidence/c8e-tickets-ux.md) |
| L-39 | Private mode | Adapted | Pending | C8 | `VenueCash` `bucket = private`; `/api/private/{open,cashout,status}` keep their paths | Adapted / Partial | — |
| L-40 | Market Surface | Adapted | Pending | C4 | Runs unchanged, labelled "the venue's published price ladder (indicative, not a public order book)" | Adapted / Done | — |
| L-41 | Sensei AI dock | Exact | Pending | C13 | Sensei and the Brake unchanged | Adapted / Done | — |
| L-42 | The Room | Adapted | Partial | C13 | Bet-gated room: `isSignature` also accepts a Canton update id | Adapted / Partial | local sandbox: [c9d-seats-games](../evidence/c9d-seats-games.md) |
| L-43 | Price alerts | Exact | Pending | C13 | Unchanged | Adapted / Done | — |
| L-44 | Reels | Exact | Pending | C13 | Unchanged | Adapted / Done | — |
| L-45 | Takes | Adapted | Pending | C13 | Takes only from opt-in `Publication` contracts | Adapted / Done | — |
| L-46 | Portfolio | Adapted | Partial | C4, C7a | Per-party ACS reads for own money; the "Also yours. Not counted above" pools have no Canton mapping yet (fidelity map: UNCLEAR) | Adapted / Partial | local sandbox: [c7a-exit](../evidence/c7a-exit-2026-09-29.md) · [c8e-tickets-ux](../evidence/c8e-tickets-ux.md) · [c6d-gap-events](../evidence/c6d-gap-events.md) |
| L-47 | Trader Edge | Exact | Pending | C5 | Unchanged over the projection (own seat) | Adapted / Done | — |
| L-48 | Leaderboard | Adapted | Partial | C5 | From opt-in `Publication` contracts only | Adapted / Done | local sandbox: [ux/c5](../evidence/ux/c5) · `9321ae3` |
| L-49 | Reputation, badges, CSV | Adapted | Pending | C5 | Own seat from the projection, others from publications | Adapted / Done | — |
| L-50 | Earn (maker vault) | Adapted | Partial | C8 | Shared `PM.Reserve`: bilateral `LpShare`, auditor-visible `NavStatement`; LP capital is reserve-tagged venue cash shards | Adapted / Done | local sandbox: [c8e-tickets-ux](../evidence/c8e-tickets-ux.md) · [c2d-maker-vault](../evidence/c2d-maker-vault.md) · [ux/c2d](../evidence/ux/c2d) |
| L-51 | Strategies desk | Adapted | Partial | C8 | Strategy registry in `abu-pm-agents` | Adapted / Done | local sandbox: [c8f-agents](../evidence/c8f-agents.md) · [c8g-agents-ux](../evidence/c8g-agents-ux.md) · [c8i-agents-gaps](../evidence/c8i-agents-gaps.md) |
| L-52 | Launch an agent (4-step builder) | Adapted | Partial | C8 | Builder over `AgentGrant` | Adapted / Partial | local sandbox: [c8g-agents-ux](../evidence/c8g-agents-ux.md) · [c8i-agents-gaps](../evidence/c8i-agents-gaps.md) |
| L-53 | Copy a strategy | Adapted | Partial | C8 | Copy via bilateral subscriptions (a creator never learns who subscribes) | Adapted / Done | local sandbox: [c8g-agents-ux](../evidence/c8g-agents-ux.md) · [c8i-agents-gaps](../evidence/c8i-agents-gaps.md) |
| L-54 | Agents board | Adapted | Pending | C8 | Agents board over the registry | Adapted / Done | — |
| L-55 | Strategy runner + self-host | Adapted | Partial | C8 | Acts through `AgentGrant` as the agent-runner party; self-host uses the creator's own seat | Adapted / Partial | local sandbox: [c8f-agents](../evidence/c8f-agents.md) · [c8g-agents-ux](../evidence/c8g-agents-ux.md) · [c8i-agents-gaps](../evidence/c8i-agents-gaps.md) |
| L-56 | Paid Memory Market | Excluded (removed in the reference 2026-09-22, `d4a693e5`; carried by K-005) | Excluded | — | Sealed strategy memory market stays removed | Adapted / Done | — |
| L-57 | Reversion preset | Exact | Pending | C8 | Unchanged preset | Adapted / Done | — |
| L-58 | Trade from X | Adapted | Pending | C13 | X bind re-pointed to the seat address | Adapted / Partial | — |
| L-59 | X recovery / claim | Adapted | Pending | C13 | Re-pointed to the seat address; native cookie handoff probed in C0 | Adapted / Partial | — |
| L-60 | X relay | Adapted | Pending | C13 | Places calls for bound seats through `AgentGrant` | Adapted / Partial | — |
| L-61 | Games hub | Exact | Pending | C9 | Unchanged | Adapted / Done | — |
| L-62 | Practice | Exact | Pending | C9 | Off-chain, unchanged | Adapted / Done | — |
| L-63 | Duel (Free/Ranked) + match link | Adapted | Partial | C9 | `Arena` in `abu-pm-games`; commit-reveal stays (`DA.Text.sha256`); spectator visibility open | Adapted / Partial | local sandbox: [c9b-games](../evidence/c9b-games.md) · [c9c-games-ux](../evidence/c9c-games-ux.md) · [c9d-seats-games](../evidence/c9d-seats-games.md) |
| L-64 | Games history | Exact | Pending | C9 | Unchanged over the projection | Adapted / Done | — |
| L-65 | Rank + seasons | Adapted | Partial | C9 | `SeasonPool` (fund, distribute once, withdraw remainder); rating ladder stays an ops projection | Adapted / Done | local sandbox: [c9c-games-ux](../evidence/c9c-games-ux.md) · [c9d-seats-games](../evidence/c9d-seats-games.md) |
| L-66 | Lucky Draw | Adapted | Pending | C9 | Lucky on the attested path; `lucky/placed` accepts an update id | Adapted / Done | — |
| L-67 | Moonshot | Adapted | Partial | C8 | Moonshot with range, own package | Adapted / Partial | local sandbox: [c8e-tickets-ux](../evidence/c8e-tickets-ux.md) |
| L-68 | Line Rider | Exact | Pending | C9 | Score-only, unchanged | Exact / Done | — |
| L-69 | Candle Hop | Exact | Pending | C9 | Score-only, unchanged | Exact / Done | — |
| L-70 | Game audio, motion, art, settings | Exact | Pending | C9 | Unchanged | Exact / Done | — |
| L-71 | Game profile, achievements, friends | Adapted | Pending | C9 | Friends removed in the reference (`fb782348`), stays removed (K-005) | Adapted / Done | — |
| L-72 | `/dev/*` fixtures | Adapted | Pending | C1 | `/dev/wallet` → `/dev/seat`; `/dev/session` shows the fast-mode chip; `/dev/private` shows the bucket; new `/dev/<surface>` per new surface | Adapted / Done | — |
| L-73 | Ops host and health | Adapted | Pending | C0, C4 | Coolify on Abu's server, Namecheap DNS straight to the server, no Cloudflare (K-003) | Adapted / Partial | — |
| L-74 | API surface | Adapted | Partial | C3, C4 | `/api/seat`, `/api/ledger/*`, `/api/view` added; `/api/rpc` and `/api/rpc/mainnet` deleted; `/api/index/wallet/*` require the seat cookie | Adapted / Partial | local sandbox: [ux/c4b](../evidence/ux/c4b) · `526b332` · [c7a-exit](../evidence/c7a-exit-2026-09-29.md) · [c8e-tickets-ux](../evidence/c8e-tickets-ux.md) · [c2z-r1-rehearsal](../evidence/c2z-r1-rehearsal.md) |

## Yosuku-lineage rows (Y)

| # | Capability | Class | Status | Owner | Canton disposition | Reference class / status | Evidence |
|---|---|---|---|---|---|---|---|
| Y-01 | Founder waitlist + referral rank (`/waitlist`) | Excluded (Abu 2026-09-13, reference Q-002/Q-003; carried by K-005) | Excluded | — | Owner exclusion carried over | Excluded (user 2026-09-13, Q-002) / Excluded | — |
| Y-02 | Creators guide, creator card studio, creator recovery (`/creators`, `/creator/studio`, `/creator/recover`) | Excluded (Abu 2026-09-13, reference Q-002/Q-003; carried by K-005) | Excluded | — | Owner exclusion carried over | Excluded (user 2026-09-13, Q-002) / Excluded | — |
| Y-03 | Founder Line Studio (`/studio`) | Excluded (Abu 2026-09-13, reference Q-002/Q-003; carried by K-005) | Excluded | — | Owner exclusion carried over | Excluded (user 2026-09-13, Q-002) / Excluded | — |
| Y-04 | Internal social content board (`/social`) | Excluded (Abu 2026-09-13, reference Q-002/Q-003; carried by K-005) | Excluded | — | Owner exclusion carried over | Excluded (user 2026-09-13, Q-002) / Excluded | — |
| Y-05 | `/fund` card on-ramp + cross-chain deposit (CCTP) | Excluded (Abu 2026-09-13, reference Q-002/Q-003; carried by K-005) | Excluded | — | Owner exclusion carried over | Excluded (user 2026-09-13, Q-002) / Excluded | — |
| Y-06 | In-app editorial `/docs` page | Adapted (via L-20) | Pending | C10 | Docs redirect to the docs site | Adapted (via L-20) / Partial | — |
| Y-07 | Agent/MCP tx-builder (`/api/bet/build`), npm SDK, MCP server | Excluded (Abu 2026-09-13, reference Q-002/Q-003; carried by K-005) | Excluded | — | Owner exclusion carried over | Excluded (user 2026-09-13, Q-003) / Excluded | — |
| Y-08 | Polymarket discovery rail; multi-coin ticker + Fear & Greed | Excluded (Abu 2026-09-13, reference Q-002/Q-003; carried by K-005) | Excluded | — | Owner exclusion carried over | Excluded (user 2026-09-13, Q-003) / Excluded | — |
| Y-09 | Sensei persistent memory (MemWal) | Excluded (Abu 2026-09-13, reference Q-002/Q-003; carried by K-005) | Excluded | — | Owner exclusion carried over | Excluded (user 2026-09-13, Q-003) / Excluded | — |
| Y-10 | TEE-attested agent / attested X bind | Excluded (Abu 2026-09-13, reference Q-002/Q-003; carried by K-005) | Excluded | — | Owner exclusion carried over | Excluded (user 2026-09-13, Q-003) / Excluded | — |
| Y-11 | Name-service handle claim (`.yosuku.sui`) | Excluded (Abu 2026-09-13, reference Q-002/Q-003; carried by K-005) | Excluded | — | Owner exclusion carried over | Excluded (user 2026-09-13, Q-003) / Excluded | — |
| Y-12 | Encrypted rooms (Seal) | Excluded (Abu 2026-09-13, reference Q-002/Q-003; carried by K-005) | Excluded | — | Owner exclusion carried over | Excluded (user 2026-09-13, Q-003) / Excluded | — |
| Y-13 | TheBell floating draggable countdown widget | Excluded (Abu 2026-09-13, reference Q-002/Q-003; carried by K-005) | Excluded | — | Owner exclusion carried over | Excluded (user 2026-09-13, Q-003) / Excluded | — |
| Y-14 | Site-wide + per-market OG images | Adapted (via L-23) | Pending | C10 | As L-23 | Adapted (via L-23) / Partial | — |
| Y-15 | `/agent` attested showcase | Excluded (Abu 2026-09-13, reference Q-002/Q-003; carried by K-005) | Excluded | — | Owner exclusion carried over | Excluded (user 2026-09-13, Q-003) / Excluded | — |
| Y-16 | Standalone Trading Balance deposit/withdraw modal | Adapted | Pending | C7a | Deposit/withdraw over `VenueCash` | Adapted (vault controls) / Done | — |
| Y-17 | Native iOS/Android app | Adapted | Pending | C11 | Reclassified (plan rev 5): the reference's Expo app exists and is ported; iOS on public TestFlight, Android APK | Blocked (no native source) / Blocked | — |
| Y-18 | Creator earnings pool row (builder codes) | Excluded (Abu 2026-09-13, reference Q-002/Q-003; carried by K-005) | Excluded | — | Owner exclusion carried over | Excluded (user 2026-09-13, Q-002) / Excluded | — |

## User add-ons (A)

| # | Capability | Class | Status | Owner | Canton disposition | Reference class / status | Evidence |
|---|---|---|---|---|---|---|---|
| A-1a | Bearish exposure via existing primitives | Additive | Pending | C7a, C8 | "Betting against" switch unchanged (UI only) | Additive / Done | — |
| A-1b | Inverse position (linear short, not binary) | Additive | Partial | C8 | `/short` with Boost | Additive / Done | local sandbox: [c8e-tickets-ux](../evidence/c8e-tickets-ux.md) |
| A-1c | Fade a trader/agent | Additive | Partial | C8 | Fade via subscriptions | Additive / Done | local sandbox: [c8g-agents-ux](../evidence/c8g-agents-ux.md) |
| A-2a | Yield on idle Trading Balance | Additive | Pending | C8 | Idle-yield note re-worded truthfully: demo credits earn nothing (the reference names Kamino and Jupiter Lend) | Additive / Done | — |
| A-2b | Supplier ("be the house") UI for every reserve | Additive | Pending | C8 | Supplier tabs per reserve over `LpShare` | Additive / Done | — |
| A-2c | Yield reporting | Additive | Partial | C8 | Realized / on-paper from `NavStatement` history | Additive / Done | local sandbox: [c2d-maker-vault](../evidence/c2d-maker-vault.md) · [ux/c2d](../evidence/ux/c2d) |
| A-3a | Trader profiles, follows, social leaderboards | Additive | Pending | C5, C13 | Profiles and social leaderboards kept; follows removed in the reference (`fb782348`), stay removed (K-005) | Additive / Done | — |
| A-3b | Copy human traders | Additive | Pending | C8 | Mirror via subscriptions | Additive / Done | — |
| A-3c | Ticker rooms, cashtag takes, activity feed, notifications | Additive | Pending | C13 | Unchanged surfaces over the adapter | Additive / Partial | — |
| A-3d | Trade-from-X for stocks | Additive | Pending | C13 | Dialect registry has no Canton counterpart; X grammar kept | Additive / Partial | — |
| A-3e | Blinks: every Window as a signed share link, where the reference had a Solana Action (`/actions.json`, `/api/actions/w/<marketId>`, `/api/actions/t/<symbol>/<cadence>`) | Adapted | Pending | C13 | Solana Actions have no Canton counterpart: the same URLs return a signed Window share link (universal link). Kept by default (K-008); Abu may overrule | Additive / Done | — |

## Reference features since 13 Sep (S19–S26)

| # | Capability | Class | Status | Owner | Canton disposition | Reference class / status | Evidence |
|---|---|---|---|---|---|---|---|
| C-S19a | Baskets `/baskets`, basket hub, measured in points (D-124) | Adapted | Pending | C8d | Attested-print path with the Canton oracle parties | new | — |
| C-S19b | "Your baskets" cover card and basket cover (`pickBasketHedges`) | Adapted | Pending | C7b | Reference's no-holdings state until C7b brings CIP-56 holdings | new | — |
| C-S20a | Valuation lanes (OPENAIV/ANTHROPICV), hub "Token vs Pyth" (D-125) | Adapted | Pending | C8d | Attested prints of Pyth-style values | new | — |
| C-S20b | Pyth entitlement gate: a lane lists only while the probe says the index is readable | Exact | Pending | C8d | `pyth-entitlement` actor unchanged | new | — |
| C-S21a | Desk pages `/desk`, `/desk/new`, `/desk/[id]`, `/desk/[id]/record`, `/desk/[id]/decision/[seq]`, desk OG image (D-126) | Adapted | Partial | C8 | `DeskMandate` on `AgentGrant`; practice desks stay paper ledgers; live leg gated on C7b and trades our own markets (K-085) | new | local sandbox: [c8g-agents-ux](../evidence/c8g-agents-ux.md) · [c8i-agents-gaps](../evidence/c8i-agents-gaps.md) · [ux/c8g](../evidence/ux/c8g) |
| C-S21b | Desk API: `/api/desk/[owner]` + `actions`, `approvals`, `check-now`, `feed`, `mandate`, `mode`, `opened`, `records`, `records/[seq]`, `share`; `/api/desk/marks` | Adapted | Partial | C8 | `/api/desk/marks` serves our own marks | new | local sandbox: [c8g-agents-ux](../evidence/c8g-agents-ux.md) |
| C-S21c | Desk program: attested reference, premium ceiling, hash-chained `operator_checkpoint`, shadow/pause mode, token allowlist | Adapted | Partial | C8 | `DeskMandate` fields and choices of the same names; reference price is the oracle quorum | new | local sandbox: [c8g-agents-ux](../evidence/c8g-agents-ux.md) · [c8i-agents-gaps](../evidence/c8i-agents-gaps.md) |
| C-S21d | `DeskWatcher` toasts; judges' shared read-only desk | Exact | Pending | C8 | Unchanged over the adapter | new | — |
| C-S22 | Desk UX kit from 21st components (D-127), web and native | Exact | Pending | C8 | Reused first for every new surface | new | — |
| C-S23a | Closed market: word board and ticket out of hours, 24/7 chips, "No quotes yet", games tell the truth out of hours | Exact | Pending | C6 | Session logic ported as it is | new | — |
| C-S23b | Pre-open resting call ("Schedule a call") | Adapted | Partial | C6, C7c | Bilateral `RestingCall` in `abu-pm-main` 0.5.1 (K-235): the venue offers, the seat places with its own cash, the venue fills at the call's price after the bell (K-236), unfilled calls are swept and refunded | new | local sandbox: [c7c-resting-call](../evidence/c7c-resting-call.md) · `c7c17d3` |
| C-S24a | Dark-mode balance controls; compact `/short` | Exact | Pending | C6, C8 | UI unchanged | new | — |
| C-S24b | Strategy runner rests while no Window trades; `isStalledOpening` drops a Window whose opening print is over 2 min late | Exact | Pending | C6, C8 | Runner and stalled-opening logic in ops/core | new | — |
| C-S25 | Sponsor visibility: "Built on" band, per-price source line (S25b), docs sponsor page, footer credit | Adapted | Pending | C10 | Re-pointed to Canton, Noders and BitSafe; written permission for any third-party mark | new | — |
| C-PUSH | Push notifications: `api/push/register`, `api/push/drain`, ops `push-clock`, Expo; fills, results, payouts | Adapted | Pending | C11 | Only `inboxFeed`'s data source changes; `push-clock` moves into the default VENUE set | new | — |
| C-DOC-01 | Docs site: 42 pages, `llms.txt`, `llms-full.txt`, `/raw`, `/api/search`, OG, sitemap, captures | Adapted | Pending | C0, C10 | Page-by-page rewrite list in C0; docs app on Coolify | new | — |
| C-PROOF | `/proof` feed and `/proof/[market]` with `ReverifyButton` | Adapted | Partial | C5, C10 | Re-verification from `Resolution` evidence, `PriceQuote`s, archived payloads and live exchange candles | new | local sandbox: [ux/c5](../evidence/ux/c5) · `9321ae3` |

## Markets, prices and lanes

| # | Capability | Class | Status | Owner | Canton disposition | Reference class / status | Evidence |
|---|---|---|---|---|---|---|---|
| C-MKT-01 | Ticker hub `/tickers/[symbol]` + OG (basket and valuation modes) | Exact | Pending | C4, C8d | Unchanged over the adapter | new | — |
| C-MKT-02 | Lanes: Regular, Gap (Monday), 24/7 xStock token, PreStocks pre-IPO; session, halt and gap states | Adapted | Partial | C6 | Logic ported as it is; prints on the attested path | new | local sandbox: [c6-lanes](../evidence/c6-lanes-2026-09-29.md) · [c6d-gap-events](../evidence/c6d-gap-events.md) · [c6e-stocks-events](../evidence/c6e-stocks-events.md) |
| C-MKT-03 | Cadences 300/900/3600 s plus Gap; Masayume 4 h and 1 d; Masayume's BTC/ETH cadence lanes | Adapted | Partial | C6 | `TICKER_SYMBOLS` gains BTC and ETH with a 24/7 basis | new | local sandbox: [c6-lanes](../evidence/c6-lanes-2026-09-29.md) |
| C-MKT-04 | Price sources (`PrintSource`: Pyth, RedStone, Switchboard, attested) | Adapted | Partial | C6 | All become attested prints by our oracle parties; the receipt names the original source (K-065) | new | local sandbox: [c6-lanes](../evidence/c6-lanes-2026-09-29.md) · [c6e-stocks-events](../evidence/c6e-stocks-events.md) |
| C-MKT-05 | Oracle quorum and cross-check-and-void (`maxDeviationBps`, `VoidReason` specific reasons) | Adapted | Partial | C3 | Default 3 parties, quorum 2; more oracle parties addable in `Series` (vs Masayume's 6 sources, minAgreement 4) | new | local sandbox: [c3-gate](../evidence/c3-gate-2026-09-29.md) · [c6d-gap-events](../evidence/c6d-gap-events.md) · [c6e-stocks-events](../evidence/c6e-stocks-events.md) · [c2z-r1-rehearsal](../evidence/c2z-r1-rehearsal.md) |
| C-MKT-06 | BTC/ETH realised-vol re-measure before fair values go live | Adapted | Partial | C6 | C6 step | new | local sandbox: [c6-realised-vol](../evidence/c6-realised-vol-2026-09-29.md) |
| C-MKT-07 | D-123 demo-cash and ladder depth at the reference's scale (100,000 credits a day) | Adapted | Pending | C0 | Sizes recorded in C0 | new | — |
| C-MKT-08 | Region hold (D-095, HTTP 451, `RegionNote`) | Adapted | Pending | C1 | Country from a local IP-to-country database (DB-IP Lite, K-003); exits stay open | new | — |
| C-MKT-09 | `/api/sentiment` crowd flow | Adapted | Pending | C5 | Opt-in `Publication`s only, k = 5 floor, privacy note on hover | new | — |
| C-MKT-10 | `/api/proof/pyth` | Adapted | Pending | C5 | Becomes re-verify an archived price from its payload and `payloadHash` | new | — |
| C-MKT-11 | `/api/dev/verify-message` | Adapted | Pending | C1 | Checks seat signatures | new | — |
| C-MKT-12 | Holdings-dependent UX: cover and hedge cards, "Your stocks", drop bell, landing Cover | Adapted | Shell | C7b | Reference's no-holdings state until a deployment names a tokenised-share instrument; `/api/holdings` now reads the seat's CIP-56 `Holding`s as the leased party, behind `NEXT_PUBLIC_CIP56_HOLDINGS` (off) | new | unit tests: [c7b-canton-coin](../evidence/c7b-canton-coin.md) |
| C-MKT-13 | X grammar `<btc|eth>` | Adapted | Pending | C13 | X grammar gains BTC and ETH | new | — |

## Daml programs

| # | Capability | Class | Status | Owner | Canton disposition | Reference class / status | Evidence |
|---|---|---|---|---|---|---|---|
| C-DAML-01 | Engine `abu-pm-main`: `Series`, `MarketTerms`, `WindowState`, `PriceQuote`, `OpenPrint`, `Resolution`, `VenueCash`, `Quote`, `BuyQuote`, `Leg`, `NettedResidual` and the money gate | Adapted | Partial | C2 | Replaces `agari-events`; money gate first | new | local sandbox: [acceptance](acceptance.md) · [c3-gate](../evidence/c3-gate-2026-09-29.md) · [c6d-gap-events](../evidence/c6d-gap-events.md) · [c2d-maker-vault](../evidence/c2d-maker-vault.md) · [c2z-r1-rehearsal](../evidence/c2z-r1-rehearsal.md) |
| C-DAML-02 | Venue mode (`admin_set_mode`: pause, reduce-only) | Adapted | Pending | C3 | Issuer policy plus optional venue-signed `VenueMode`; user exits never check it | new | — |
| C-DAML-03 | Product dependents (`product_add_dependent` / `release_dependent`) | Adapted | Pending | C8 | Products carry `termsCid`; terms never archived before dependents settle | new | — |
| C-DAML-04 | Strategy `creator_seal` (sealed spec), `set_runner`, `deactivate` | Adapted | Partial | C8 | `Strategy.specHash`, `SetRunner`, `Deactivate` | new | local sandbox: [c8f-agents](../evidence/c8f-agents.md) |
| C-DAML-05 | Season prize pool and arena tiers | Adapted | Partial | C9 | `SeasonPool` in `abu-pm-games`; tiers as a table in `Arena` terms | new | local sandbox: [c9b-games](../evidence/c9b-games.md) · [c9d-seats-games](../evidence/c9d-seats-games.md) |
| C-DAML-06 | Canton Coin rail (CIP-56 allocation) | Adapted | Shell | C7b | `abu-pm-cc` 0.1.0 on the token standard V1: a deposit is the owner's TransferInstruction accepted and credited in one transaction, a withdrawal a TransferFactory transfer, an allowance and an auditor-visible reserve statement; the allocation (V2) route is not built. Proved in Daml Script and unit tests, not on a network: `not-live` in code until DevNet proves it with a real wallet | new | Daml Script + unit tests: [c7b-canton-coin](../evidence/c7b-canton-coin.md) |

## Ops actors

| # | Capability | Class | Status | Owner | Canton disposition | Reference class / status | Evidence |
|---|---|---|---|---|---|---|---|
| C-OPS-01 | Supervisor, heartbeats, `/health`, calendar, earnings, halt-watch, SSE, `print_archive` | Exact | Partial | C3 | Unchanged; DRY_RUN becomes prepare-without-execute | new | local sandbox: [c3-gate](../evidence/c3-gate-2026-09-29.md) · [c2z-r1-rehearsal](../evidence/c2z-r1-rehearsal.md) |
| C-OPS-02 | Window roller | Adapted | Partial | C3 | `execute.ts` → `Series_OpenWindow` | new | local sandbox: [c3-gate](../evidence/c3-gate-2026-09-29.md) · [c6-lanes](../evidence/c6-lanes-2026-09-29.md) · [c2z-r1-rehearsal](../evidence/c2z-r1-rehearsal.md) |
| C-OPS-03 | Oracle feeders (Coinbase, Kraken, Bitstamp 1-minute closes), replacing price-relay | Adapted | Partial | C3 | New sourcing decision, recorded in C3 | new | local sandbox: [c3-gate](../evidence/c3-gate-2026-09-29.md) · [c9c-games-ux](../evidence/c9c-games-ux.md) · [c2z-r1-rehearsal](../evidence/c2z-r1-rehearsal.md) |
| C-OPS-04 | Pricer and quote issuer over K venue cash shards; venue price ladder over SSE | Adapted | Partial | C3 | Seed maker's fair-value math unchanged | new | local sandbox: [c3-gate](../evidence/c3-gate-2026-09-29.md) · [c6-realised-vol](../evidence/c6-realised-vol-2026-09-29.md) · [c2d-maker-vault](../evidence/c2d-maker-vault.md) · [c2z-r1-rehearsal](../evidence/c2z-r1-rehearsal.md) |
| C-OPS-05 | Settler (`SettleBatch`), resolver proposer, netting, rebalancer, expiry sweeper, reserve reporter | Adapted | Partial | C3 | New actors plus settler | new | local sandbox: [c3-gate](../evidence/c3-gate-2026-09-29.md) · [c7a-exit](../evidence/c7a-exit-2026-09-29.md) · [c2d-maker-vault](../evidence/c2d-maker-vault.md) · [c2z-r1-rehearsal](../evidence/c2z-r1-rehearsal.md) |
| C-OPS-06 | Projector (`/v2/updates` → Postgres), replacing the indexer | Adapted | Partial | C3 | Hand-written, not PQS | new | local sandbox: [c3-gate](../evidence/c3-gate-2026-09-29.md) · [c6e-stocks-events](../evidence/c6e-stocks-events.md) · [c9d-seats-games](../evidence/c9d-seats-games.md) |
| C-OPS-07 | Seat funding and close-out | Additive | Partial | C3, C4 | Seat lifecycle `leased → draining → free` | new | local sandbox: [c9d-seats-games](../evidence/c9d-seats-games.md) · [c2z-r1-rehearsal](../evidence/c2z-r1-rehearsal.md) |
| C-OPS-08 | `strategy-runner` + self-host `runner-main.ts` | Adapted | Partial | C8 | Acts through `AgentGrant` | new | local sandbox: [c8f-agents](../evidence/c8f-agents.md) · [c8g-agents-ux](../evidence/c8g-agents-ux.md) · [c8i-agents-gaps](../evidence/c8i-agents-gaps.md) |
| C-OPS-09 | `leverage-keeper` | Adapted | Pending | C8 | Knock-out and settle against the oracle quorum | new | — |
| C-OPS-10 | `game-room`, `matchmaker`, `duel-projector`, `duel-settler` | Adapted | Partial | C9 | Room unchanged; matchmaker (unwired in the reference) wired; projector joins the main projector | new | local sandbox: [c9b-games](../evidence/c9b-games.md) · [c9c-games-ux](../evidence/c9c-games-ux.md) · [c9d-seats-games](../evidence/c9d-seats-games.md) |
| C-OPS-11 | `x-relay` | Adapted | Pending | C13 | Places calls through `AgentGrant` | new | — |
| C-OPS-12 | `desk-runner` (opt-in) | Adapted | Partial | C8 | Acts on `DeskMandate` | new | local sandbox: [c8i-agents-gaps](../evidence/c8i-agents-gaps.md) · [c8g-agents-ux](../evidence/c8g-agents-ux.md) |
| C-OPS-13 | `market-maker` vault mode (`MAKER_MODE=vault`) | Adapted | Partial | C8 | Maps to `./maker` | new | local sandbox: [c2d-maker-vault](../evidence/c2d-maker-vault.md) · [ux/c2d](../evidence/ux/c2d) |
| C-OPS-14 | Actor set split VENUE / LEGACY / OPT-IN | Exact | Partial | C3 | Kept as the reference has it | new | local sandbox: [c3-gate](../evidence/c3-gate-2026-09-29.md) |

## Native app (one row per route in `mobile/src/app`)

| # | Capability | Class | Status | Owner | Canton disposition | Reference class / status | Evidence |
|---|---|---|---|---|---|---|---|
| C-N00 | Native shell: NativeTabs, header, floating pill dock, `BottomDrawer`, More side panel, haptics, pull-to-refresh | Exact | Pending | C1 | Web's 402 px layout ported literally (owner, 25 Sep) | new | — |
| C-N01 | Native route `/` (index, first-run redirect) | Adapted | Pending | C11 | Onboarding flag gets the new app's key prefix (`index.tsx` and `welcome.tsx`) | new | — |
| C-N02 | Native route `/welcome` | Adapted | Pending | C11 | Onboarding flag gets the new app's key prefix | new | — |
| C-N03 | Native route `/onboarding` | Adapted | Pending | C11 | Demo-credits gate is the last page; its accept creates the seat | new | — |
| C-N04 | Native route `/connect` (seat drawer) | Adapted | Pending | C1 | Wallet island replaced by the seat key (Keychain seed) | new | — |
| C-N05 | Native route `/account` | Adapted | Pending | C1 | Seat, party id, lease time left, reset seat | new | — |
| C-N06 | Native route `/funds` (demo-credits grant) | Adapted | Pending | C1 | Demo-credits grant through a signed route; SOL, faucet and lamport lines go | new | — |
| C-N07 | Native route `/ticket` (sheet) | Adapted | Pending | C4 | Firm quote, StepProgress and ring as on web | new | — |
| C-N08 | Native route `/markets` (tab) | Exact | Pending | C4 | Follows the adapter | new | — |
| C-N09 | Native route `/markets/[id]` | Exact | Pending | C4 | Follows the adapter | new | — |
| C-N10 | Native route `/portfolio` (tab) | Exact | Pending | C4 | Follows the adapter | new | — |
| C-N11 | Native route `/portfolio/edge` | Exact | Pending | C5 | Follows the adapter | new | — |
| C-N12 | Native route `/reels` (tab) | Exact | Pending | C13 | Follows the adapter | new | — |
| C-N13 | Native route `/games` (tab) | Exact | Pending | C9 | Follows the adapter | new | — |
| C-N14 | Native route `/games/practice` | Exact | Pending | C9 | Follows the adapter | new | — |
| C-N15 | Native route `/games/duel` | Exact | Pending | C9 | Follows the adapter | new | — |
| C-N16 | Native route `/games/duel/[matchId]` | Exact | Pending | C9 | Follows the adapter | new | — |
| C-N17 | Native route `/games/lucky` | Exact | Pending | C9 | Follows the adapter | new | — |
| C-N18 | Native route `/games/range` | Exact | Pending | C8 | Follows the adapter | new | — |
| C-N19 | Native route `/games/moonshot` | Exact | Pending | C8 | Follows the adapter | new | — |
| C-N20 | Native route `/games/line-rider` | Exact | Pending | C9 | Follows the adapter | new | — |
| C-N21 | Native route `/games/candle-hop` | Exact | Pending | C9 | Follows the adapter | new | — |
| C-N22 | Native route `/games/history` | Exact | Pending | C9 | Follows the adapter | new | — |
| C-N23 | Native route `/games/rank` | Exact | Pending | C9 | Follows the adapter | new | — |
| C-N24 | Native route `/activity` | Exact | Pending | C13 | Follows the adapter | new | — |
| C-N25 | Native route `/agents` | Exact | Pending | C8 | Follows the adapter | new | — |
| C-N26 | Native route `/baskets` | Exact | Pending | C8d | Follows the adapter | new | — |
| C-N27 | Native route `/claim` (X recovery) | Exact | Pending | C13 | Follows the adapter | new | — |
| C-N28 | Native route `/desk` | Exact | Pending | C8 | Follows the adapter | new | — |
| C-N29 | Native route `/desk/new` | Exact | Pending | C8 | Follows the adapter | new | — |
| C-N30 | Native route `/desk/[id]` | Exact | Pending | C8 | Follows the adapter | new | — |
| C-N31 | Native route `/desk/[id]/record` | Exact | Pending | C8 | Follows the adapter | new | — |
| C-N32 | Native route `/desk/[id]/decision/[seq]` | Exact | Pending | C8 | Follows the adapter | new | — |
| C-N33 | Native route `/earn` | Exact | Pending | C8 | Follows the adapter | new | — |
| C-N34 | Native route `/how-it-works` | Exact | Pending | C10 | Follows the adapter | new | — |
| C-N35 | Native route `/leaderboard` | Exact | Pending | C5 | Follows the adapter | new | — |
| C-N36 | Native route `/notifications` (push settings; its nav entry was removed 25 Sep, the screen stays) | Exact | Pending | C11 | Follows the adapter | new | — |
| C-N37 | Native route `/parlay` | Exact | Pending | C8 | Follows the adapter | new | — |
| C-N38 | Native route `/pool` (redirect) | Exact | Pending | C1 | Follows the adapter | new | — |
| C-N39 | Native route `/sensei` | Exact | Pending | C13 | Follows the adapter | new | — |
| C-N40 | Native route `/short` | Exact | Pending | C8 | Follows the adapter | new | — |
| C-N41 | Native route `/status` | Exact | Pending | C4 | Follows the adapter | new | — |
| C-N42 | Native route `/strategies` | Exact | Pending | C8 | Follows the adapter | new | — |
| C-N43 | Native route `/strategies/[id]` (redirect) | Exact | Pending | C1 | Follows the adapter | new | — |
| C-N44 | Native route `/tickers/[symbol]` | Exact | Pending | C4 | Follows the adapter | new | — |
| C-N45 | Native route `/trade-from-x` | Exact | Pending | C13 | Follows the adapter | new | — |
| C-N46 | Native route `/u/[address]` | Exact | Pending | C5 | Follows the adapter | new | — |
| C-N47 | `+native-intent` deep-link handling | Adapted | Pending | C1 | Wallet handling deleted; seat-link universal link (`<scheme>://seat/link?code=…`) handled | new | — |
| C-N48 | Home-screen widget and Live Activity | Adapted | Pending | C11 | Canton clock source in `provider/clock-sync.ts` | new | — |
| C-N49 | Onboarding with sound | Exact | Pending | C11 | Unchanged | new | — |
| C-N50 | Android ongoing notification and Android APK (FCM credentials added) | Adapted | Pending | C11 | Android push was never run in the reference | new | — |
| C-N51 | Live spot stream and venue ladder on the phone (`react-native-sse`) | Adapted | Pending | C1 | Off in the reference today; the port wires it | new | — |
| C-N52 | `DropBellWatcher`, `DeskWatcher` on the phone | Exact | Pending | C7b, C8 | Drop bell depends on holdings | new | — |

## Additions (not in the reference)

| # | Capability | Class | Status | Owner | Canton disposition | Reference class / status | Evidence |
|---|---|---|---|---|---|---|---|
| C-ADD-01 | "Who can see this" chip (web and phone) | Additive | Partial | C1 | Reference `badge` + `tooltip`, `LogoStack` | new | local sandbox: [ux/c4b](../evidence/ux/c4b) · `526b332` |
| C-ADD-02 | Per-party view switcher with the literal query on screen (web and phone) | Additive | Partial | C1, C4 | desk-kit `UnderlineTabs`; Code Block 21st #23586 (web) | new | local sandbox: [ux/c4b](../evidence/ux/c4b) · `526b332` · [c2z-r1-rehearsal](../evidence/c2z-r1-rehearsal.md) |
| C-ADD-03 | Seat link between devices (QR + 6-character code) | Additive | Pending | C1 | 21st #29246 layout + OTP Input #23543; required before the C4 gate | new | — |
| C-ADD-04 | iOS first-run demo-credits gate | Additive | Pending | C11 | "Demo credits, no cash value, test network" | new | — |
| C-ADD-05 | 1-minute demo lane resolved by the three oracle parties | Additive | Partial | C3 | Not in the reference (300/900/3600 s + Gap) | new | local sandbox: [c3-gate](../evidence/c3-gate-2026-09-29.md) · [c2z-r1-rehearsal](../evidence/c2z-r1-rehearsal.md) |
| C-ADD-06 | Institutional event markets resolved by committee attestation | Additive | Partial | C6 | The reference has none | new | local sandbox: [c6-lanes](../evidence/c6-lanes-2026-09-29.md) · [c6d-gap-events](../evidence/c6d-gap-events.md) · [c6e-stocks-events](../evidence/c6e-stocks-events.md) |
| C-ADD-07 | BitSafe governed resolution (`abu-pm-governance`) | Additive | Pending | BitSafe add-on | Never on the critical path; go/no-go Thu 1 morning | new | — |
| C-ADD-08 | Ticket write-progress steps (desk-kit `StepProgress`) and firm-quote ring (20 s) | Additive | Partial | C1, C4 | D-081 direction choice by Abu (default K-010) | new | local sandbox: [ux/c4b](../evidence/ux/c4b) · `526b332` |
| C-ADD-09 | Resolution timeline on `/proof/<market>` beside `ReverifyButton` | Additive | Partial | C5 | desk-kit `Timeline`; web only | new | local sandbox: [ux/c4b](../evidence/ux/c4b) · `526b332` · [ux/c5](../evidence/ux/c5) |
| C-ADD-10 | Seat pool-full, draining and waitlist plates | Additive | Partial | C4 | desk-kit `EmptyState` + `CountdownRing` + `StatusDot` | new | local sandbox: [ux/c4b](../evidence/ux/c4b) · `526b332` · [c9d-seats-games](../evidence/c9d-seats-games.md) |
| C-ADD-11 | Privacy matrix page with a runnable command; trust-boundary statement on `/proof` | Additive | Pending | C5, C10 | Web only | new | — |
| C-ADD-12 | Grofty money rail (PartyLayer connector, web only) | Additive | Pending | Grofty add-on | Never ships in the iOS binary | new | — |

## Owner removals carried (for traceability)

| # | Capability | Class | Status | Owner | Canton disposition | Reference class / status | Evidence |
|---|---|---|---|---|---|---|---|
| C-X01 | "Strategies on X" strip on `/agents` (removed in the reference, `d4a693e5`) | Excluded (reference removal; carried by K-005) | Excluded | — | — | new | — |
| C-X02 | Mobile removals of 25 Sep: install strip, News, Pitch, Demo, Print proof, Stats, Market Surface, Download, the /more and /notifications nav entries | Excluded (Abu 2026-09-25; carried by K-005) | Excluded | — | Web keeps these pages | new | — |
| C-X03 | Friends and follows (removed in the reference, `fb782348`) | Excluded (reference removal; carried by K-005) | Excluded | — | — | new | — |

Totals: 221 rows (103 reference + 118 new). Done: 0 of 221. Partial (local sandbox): 59 of 221. Excluded: 18 of 221. Pending: 144 of 221.
