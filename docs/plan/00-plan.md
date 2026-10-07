# Plan: port the prediction market, web and iOS, to Canton for HackCanton Season 3

> **In this repo.** This is the approved plan (revision 5, 29 Sep 2026), copied into `docs/plan/` in C0. From C0 on it changes only through `decisions.md`.
> - Paths beginning `context/…` and `refs/…` are in Abu's knowledge-base workspace (`canton-season3`), not in this repo. Paths beginning `agari-wt/…` are the reference's worktrees beside it. Paths such as `web/…`, `mobile/…`, `packages/…`, `services/…` and `daml/…` are in this repo.
> - One wording change from the original: the four banned scope phrases are named by reference, so this file passes the `docs-consistency` check it describes.
>
> **Amendments recorded since approval** (each a decision in `decisions.md`; the plan text below is unchanged):
> - **K-002:** the design system is used directly, with no licence gating. The C0 row's "Yosuku CSS submodule" was done (`94a0d65`) and then reversed: `2855af5` put `web/src/styles/yosuku/` back into the repo byte-identical.
> - **K-003:** hosting (Coolify, Namecheap DNS, no Cloudflare) is a later deploy-stage item and blocks nothing now. The C0 host probes run with the first hosted deploy.
> - **K-009:** all building and testing runs on the local Canton sandbox first. Noders onboarding (about 2 minutes, Abu) and the Noders probes happen just before the DevNet skeleton (C2x), not in C0.

Revision 5, Tue 29 Sep 2026, corrected after an adversarial review against the code. It replaces revision 4 (written this morning without real research) and revision 3 (22 Sep, kept outside this repo with Abu's plans). Evidence behind this revision, all gathered today:
- the 21st catalog, searched and pulled for every new surface;
- three read-only explorations: the native app, 372 reference commits since 22 Sep, and Context7 docs for every library a lane touches;
- the six design reviews of 22 Sep.

Anything not checked in source or on the machine is marked **UNVERIFIED**, with the probe that settles it.

## Context

**HackCanton League Season 3**, Track 2 (Financial Applications). Submissions close **Fri 9 Oct 2026 23:59 UTC**, no extensions. Nothing has been built for Canton yet; building starts today, **10 days** out. Abu is a solo builder running AI agents in parallel worktrees.

The product is his prediction market moved onto Canton and Daml, ported from his own reference: **web and iOS**, stocks and crypto, games, agents and desks, nothing left out. His standing rules, which bind every lane:
- **Scope** (`working-rules.md`, D-113): no feature is cut, hidden, deferred or thinned. The deadline is never a reason. Never ask which feature to drop. Order work by dependency and run it in parallel lanes.
- **Fidelity**: the reference is the minimum baseline.
- **UX counts as much as function.** Every new piece of UI is a real 21st.dev component, found, pulled and restyled into the product's tokens. His D-127 already says this: "every new piece is a real catalogue component (search, get, adapt), restyled into Masayume's tokens". His 23 Sep note adds: "real brand logos wherever a brand is named… connected state = avatar + dropdown."
- **Understand a library before using it**: read its Context7 docs and follow the recommended patterns. Reading docs is the review; there is no dependency audit.
- **Tests are not a deliverable, and are still written** wherever money, settlement or privacy correctness is in doubt.
- **Performance is designed in**, not tuned afterwards.
- BitSafe and Grofty are add-ons: "If it doesn't work, it doesn't work."

## The reference as it stands today (checked 29 Sep)

| Fact | Value |
|---|---|
| Fork base | Agari `codex/mobile-takeover` @ `661a24ee` (27 Sep), clean. It contains all of `integration/w1` (the "Window Cut" brand) plus the app. 372 commits since the last plan's base |
| Planning docs | **Out of git since 23 Sep** (commit `386d41ed`). The complete local copy is `agari-wt/s26/docs/plan/`: decisions to **D-129**, parity 103 rows, no mobile rows yet. The acceptance log is tracked at `docs/evidence/acceptance.md` there (here it is `docs/evidence/prior-work/agari-solana-acceptance.md`) |
| Web | Next.js 16, Base UI, `motion` 12, lucide. 70+ page routes. The design system in `web/src/styles/**` is 60 files, ≈14k lines, of which 5,871 are the verbatim `styles/yosuku/` port. The Window Cut brand touched `yosuku/part-02.css` and `part-15.css` (logo sizes only; colour tokens unchanged) |
| New since 22 Sep | Baskets, measured in points (D-124). Pyth valuation lanes behind an entitlement probe (D-125). `agari-desk`, a mainnet agent desk with paper-ledger practice desks (D-126), built from 21st components (D-127). A `/proof` feed. A docs site at docs.useagari.xyz. Push notifications. An `/api/rpc` proxy (D-121). A trusted-proxy rule (D-122). Removed: friends/follows, sealed strategy memory |
| **Mobile** | `mobile/`: Expo SDK 57, React Native 0.86, expo-router, **619 files and ≈54k lines in `mobile/src` (698 in all of `mobile/`), native screens**. Web's 402 px layout ported literally (owner, 25 Sep) with web's header, a floating pill dock and a shared `BottomDrawer`. **`@/` points at `web/src`** (D-129), and 269 web modules are imported directly. Uses Reanimated 4, FlashList 2, MMKV, `react-native-quick-crypto`, push, a widget, a Live Activity and onboarding with sound. No tests inside `mobile/` |
| One seam, plus web's hooks | Both apps reach the chain through `@owarine/markets` (≈22,700 lines, 27 subpaths) **and** through web's own Solana-bound hooks, which mobile imports via `@/`. So web and mobile change in step |
| The seat key already exists | The app's "practice wallet" is a 32-byte ed25519 seed in the Keychain (`mobile/src/wallet/practice-store.ts`, `WHEN_UNLOCKED_THIS_DEVICE_ONLY`). Its address is base58 of the public key, and it signs raw UTF-8 text (`packages/markets/src/sessions/mobile/practice.ts`). That is exactly the seat identity. The tap-trading session key is the wrong base: it is keyed per owner and exists to hold a vault grant |
| Push | Built on web's inbox feed: `api/push/register`, then `api/push/drain` driven by the ops `push-clock`, then Expo. Fills, results and payouts trigger it. On Canton only `inboxFeed`'s data source changes |
| Apple | App Store Connect app "Agari – Call the Close" (bundle `xyz.useagari.app`) on team `86C6ZFJ6V6`; EAS project with an App Store Connect key and an APNs key. **Public TestFlight beta submitted 25 Sep and open by 27 Sep**, so a devnet prediction market from this account passed beta review in about 2 days |
| Deploy | **Coolify** on Abu's server. **The Canton product uses no Cloudflare** (Abu, 29 Sep): its domain is registered at Namecheap and its DNS points straight at the server. (Agari's `useagari.xyz` still answered through Cloudflare on 29 Sep, which is why the reference sets `TRUSTED_PROXY=cloudflare`; that does not carry over.) Agari's apps: `agari-web` (Dockerfile), `agari-ops` (build pack UNVERIFIED; rebuilt with nixpacks on 22 Sep), `agari-db` (Coolify-managed Postgres), docs as `agari-docs`, room WebSocket at `room.useagari.xyz`. The server is a **2-vCPU VPS with a 38 GB disk that filled on 22 Sep and crash-looped the database**. Vercel and Fly files are leftovers. `TRUSTED_PROXY=cloudflare` |
| Owner's mobile removals (25 Sep) | install strip, News, Pitch, Demo, Print proof, Stats, Market Surface, Download, and the /more and /notifications nav entries |
| Previous port's pace | 759 commits in 9 days; 327 on the peak day; up to four lanes at once |

**The work**:
- Rewrite `@owarine/markets` and web's chain-bound hooks as a Canton adapter behind the same exports.
- Replace the wallet islands with the seat on both platforms.
- Replace the Anchor programs with Daml packages.
- Re-point `services/ops`.
- Make the short list of core edits.
- Build the handful of surfaces the reference never had from 21st components, web first, then ported literally to the phone.

## Fidelity contract

| Field | Record |
|---|---|
| Target | The prediction market on Canton with Daml contracts, as a web app and an iOS app. The name is Abu's choice; until then a neutral scope, so a late name changes one constant each (`BRAND`, `SIGNED_MESSAGE_BRAND`, app display name, bundle id) |
| Baseline ledger | The local `parity.md` (103 rows), **plus rows added in M0** for baskets, Pyth lanes, desk, `/proof` feed, docs site and push, and one row per native route taken from `mobile/src/nav/items.ts` and `find mobile/src/app` (not from `TAKEOVER_STATUS.md`, whose table still lists routes Abu removed on 25 Sep), plus Masayume's BTC/ETH cadence lanes. The `context/08-reference-products` inventories are the cross-check |
| Existing exclusions | 14 Yosuku-lineage rows (Abu, 13 Sep, Q-002/Q-003); the mobile removals (25 Sep); friends/follows and sealed strategy memory (removed in the reference). All are carried as his decisions and recorded as Q-001, which he can reopen |
| Authority order | Abu's latest statement → fork code (web, mobile) → Masayume where Stocklana dropped a layer → Yosuku → documents |
| Allowed deviations | Canton/Daml replaces Solana/Anchor. The wallet becomes a guest seat on web and the Keychain seat key on iOS; Grofty is an additive web-only connector |
| Adapted rows | <ul><li>Order book → firm house quote over a published venue price ladder</li><li>Void at 0.5/0.5 → void returns cost plus fee</li><li>Pre-open resting call → bilateral `RestingCall`</li><li>Boost knock-out → oracle-quorum barrier</li><li>Sponsor and gas → a truthful zero fee</li><li>Tap-trading session key → not needed: a seat already trades in one tap, so the fast-mode chip says so</li><li>Mainnet desk via Jupiter → a Canton desk whose live leg is gated on C7b; the practice desk stays a paper ledger</li><li>Baskets and Pyth lanes → the same attested-print path, with the Canton oracle parties</li></ul> |
| Additions (reference kit first, 21st where new, in the reference's tokens) | Write-progress steps and quote ring on the ticket (a D-081 direction choice), "who can see this" chip, per-party view switcher with the literal query, resolution timeline on the proof page, seat pool-full and draining plates, seat link between devices, iOS first-run demo-credits gate |
| Provenance | Yosuku, PIPS and Flicky are third-party code with no licence for public release. Implementation reuse was approved 1 Sep; public redistribution was never recorded |

**Design system (Abu, 29 Sep): used directly, no licence gating.** The reference's stylesheets, Masayume's and Agari's (Abu's own products), come across byte-identical in the repo. The lineage is recorded factually in `THIRD_PARTY_NOTICES.md` and `docs/plan/references.md`.

## UX and 21st: how every screen is built

**Authority.** The reference is the authority for everything it already has (D-036/D-081): chrome, cards, ticket, portfolio, tokens, type and motion, on web and on the phone. Drift is fixed, not waived, and byte-identical reference values are never treated as inconsistency. 21st supplies what the reference never had. It never replaces a reference surface without Abu's say.

**The workflow** (21st skills `21st-cli-use`, `21st-ui-build`, `21st-ui-review`). Abu's account is paid tier: search and code retrieval are unlimited and AI generation is off, so every new piece is a real catalog component, adapted.
1. **M0:** `21st init --design-context` fills `.21st/design.json` with the reference's tokens, type, radii and motion. The fork's own `.21st/` holds only empty files.
2. **Reuse the reference's primitives first.**
   - `components/ui`: badge, button, sheet, skeleton, switch, tabs (Base UI), toast, tooltip, and the desk kit.
   - `components/states`: `EmptyState`, `ErrorState`, `LoadingState`, `StaleTick`, `ReadingBoundary`.
   - The RainbowKit-replica connect ladder, receipts, the proof page's `ReverifyButton`.
   - On the phone, the `BottomDrawer` and the app's kit.
3. **For each genuinely new surface:**
   1. `21st search "<need>" --context auto`
   2. `21st get <id>`
   3. Choose, preferring components whose imports the reference already ships (`motion/react`, React, lucide, Base UI).
   4. Restyle onto `tokens.css`/`theme.css`. No raw hex or px values: the `design-literals` invariant enforces it.
   5. Wire real data and every state: loading, empty, error, not-live, stale.
   6. Add a `/dev/<surface>` fixture.
   7. Port the result literally to React Native, the way the reference ported the web (the `mobile-design-literals` invariant applies).
4. **Real brand logos** wherever a brand is named (`21st logo <brand>`), including Canton and each exchange that feeds a price.
5. **At every stage gate:** `21st review <changed paths>`. Only deterministic fixes are applied automatically. Subjective recommendations go to Abu as a list, never as a silent redesign.

**The reference already has a 21st kit on both platforms, so it comes first.** S22/D-127 built the desk kit from 21st components, adapted into the tokens and ported natively: web `web/src/components/ui/desk-kit/`, phone `mobile/src/features/desk/kit/`. Reusing it keeps the app looking like one product (D-036). Code was pulled and read today (`21st get`); the catalogue ids below are the reference's own sources.

| New surface | Built from | Source |
|---|---|---|
| Ticket write progress, with `WritePhase`'s six values mapped onto steps (composing, submitted, confirming, confirmed; reverted and unknown shown as error) | desk-kit `StepProgress` | 21st #29458, already adapted, web and native |
| Firm-quote expiry (20 s) | `web/src/components/data/CountdownRing.tsx` with its urgent state; `mobile/src/components/ui/CountdownRing.tsx` | the reference's own ring |
| Alice / Bob / outsider view switcher | desk-kit `UnderlineTabs` on Base UI's tab indicator. Tabs are the right semantics: Segmented Control #23552 is a radiogroup and is rejected for driving tab panels | 21st #24956, web and native |
| Resolution evidence on `/proof/<market>` | desk-kit `Timeline` / `TimelineNode`, beside `ReverifyButton` | 21st #28276, #29318 |
| The literal ledger query on screen | **Code Block** 21st #23586 (85 lines, React only): the one genuinely new component. Rewritten from Tailwind classes into a `*.css` in the tokens, with update ids and parties rendered by `components/data/Hash.tsx` | new |
| Demo-credits grant | web `features/funding/CreditWelcome.tsx` and `AddFunds.tsx`; mobile `components/funding/CreditWelcome.tsx` | reference |
| Lease time left in the account dropdown | `components/data/Countdown.tsx` | reference |
| Pool full, draining, waitlist position | desk-kit `EmptyState` + `CountdownRing` + `StatusDot` | reference |
| **Seat link between devices** | The layout of 21st **Two-Factor Authentication Card** #29246 (a QR, a manual code with copy, then code entry), rebuilt on the reference's primitives. Code entry uses 21st **OTP Input** #23543 (505 lines, `motion/react` + React only; per-cell entry, paste, keyboard, error state). The QR is drawn with the reference's own `qrcode-generator` dependency, not #12248's extra `qrcode` package. On the phone the QR is a universal link (`<scheme>://seat/link?code=…`) that the iOS Camera app opens, so no in-app camera module is needed; typing the 6-character code works everywhere | new (searched and read 29 Sep) |
| "Who can see this" chip | reference `badge.tsx` + `tooltip.tsx`, the two stakeholders shown with `LogoStack` | reference |
| Privacy matrix page (business deliverable) | desk-kit `PartitionBar`/`StatusDot` in a table, the runnable command in Code Block | reference + #23586 |
| Ledger rows on `/status` (party, offset, token age) | the existing `StatusRows` | reference |
| Trust-boundary statement on `/proof` | desk-kit `Panel`/`EmptyState` grammar | reference |

**Rules the review added:**
- Every 21st pick is rewritten from utility classes into `*.css` with tokens. The reference styles through yosuku and Tailwind v4 layers, and the desk kit carries no utility strings.
- **The ticket is a reference-authority surface (D-081).** Adding StepProgress and the ring to it follows D-081: two or three directions shown at `/dev/ticket-canton`, Abu chooses, and the choice is recorded before the ticket changes.
- The fork's `.21st/design.json` was generated on 23 Sep and detected no tokens. M0 hand-completes it from `tokens.css`/`theme.css` so `--context auto` searches are grounded.

**UX decisions specific to Canton:**
- **No wait without feedback.** A Canton submit takes about 2 s (sandbox; DevNet measured in C2x). The placement is a TanStack mutation scoped to the seat. Its pending state drives StepProgress, and the receipt names the update id and links the proof.
- **Nothing happens per keystroke.** Indicative prices come from the venue ladder over SSE plus core's own quote kernel. A firm quote contract exists only at the click. Expiry offers the fresh price in place and never re-prices silently.
- **Privacy is shown, not asserted.** The chip, the switcher and the literal query body make the thesis visible in five seconds, on web and on the phone.
- **Always a way out.** Stale refund and claim are one tap each and work with the worker down; the UI says so.
- **Truthful states.** A capability shows live only when its gate has passed and its acceptance row exists (see the capability registry).
- **Seats feel like an account.** The connected state is the reference's avatar plus dropdown. The dropdown shows the seat, its party id, the lease time left and "reset seat".

## Performance and libraries (from today's Context7 reads)

| Area | Design, per the library's own docs |
|---|---|
| Server secrets | Every ledger and OAuth module starts with `import 'server-only'`, so a client import fails the build. Nothing secret is `NEXT_PUBLIC_`. Env is parsed in `instrumentation.ts` `register()` under `NEXT_RUNTIME === 'nodejs'` with zod 4 (`z.url()`, `z.stringbool()`, `z.coerce`), failing with `z.prettifyError` (Next 16 `data-security`, `instrumentation`; zod v4) |
| Price stream | A `force-dynamic` Node route handler returns a `ReadableStream` as `text/event-stream` with `no-store` and tears down on `request.signal` abort. It is never wrapped in `'use cache'`. Alternatively clients hit ops' SSE directly (Next `streaming`) |
| Per-user reads | Dynamic route handlers, cached only in the browser by TanStack Query. Shared market metadata uses a `'use cache'` helper, never the GET export itself (Next `use-cache`, `use-cache-private`) |
| Price updates on the client | One app-level SSE subscription feeds `queryClient.setQueryData`, with a finite `staleTime` and polling only as a fallback (TanStack `QueryClient`) |
| Placing a call | `useMutation` with `scope: { id: seat }` so one seat's writes run one at a time, and **no retries** (default 0). Idempotency comes from Canton instead: a stable `commandId` per intent, journalled before sending, and a fresh `submissionId` per attempt (TanStack `mutations`; JSON API) |
| Ledger calls | `submit-and-wait-for-transaction` with `ACS_DELTA`, so the created `Leg` comes back in one round trip. Endpoints removed in 3.6 (`/v2/updates/flats`, `/trees`) are never used. The active-contracts paging endpoint is **UNVERIFIED** (the local docs disagree); the node's `/docs/openapi` settles it in M0 |
| Projection DB | postgres.js `sql.begin` with row locks or `pg_advisory_xact_lock`; the offset cursor as int8 via `types.bigint`, advanced in the same transaction; `sql.listen` with `onlisten` re-drain; small `max`, `idle_timeout`, `max_lifetime` (postgres.js README) |
| Token | One password grant per process, single-flight, refreshed before expiry, never on a 401 storm |
| Ops | Quotes pipelined over K = 16 venue cash shards; settles in batches (start at 25, measured); all oracle prints in one command |
| Mobile lists | FlashList v2 with no `key` inside rows, `memo`'d leaves and `getItemType`. Ticking prices go to Reanimated shared values rendered through an animated `TextInput` via `useAnimatedProps`, so recycled rows never re-render and `.value` is never read on the JS thread (FlashList `performant-components`; Reanimated performance guide) |
| Mobile SSE | **The app's live spot stream is off today**: `react-native-sse` is declared but never imported, and `spot-stream.ts` returns early without `EventSource`. The port wires it: a `react-native-sse` instance with our own backoff on `error`/`timeout`, closed in the background, with `focusManager` refetch on foreground (react-native-sse docs; TanStack RN) |
| Mobile storage and crypto | The seat seed in SecureStore `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, without `requireAuthentication` (a biometric change would make it unreadable forever); Face ID gates the action instead. Signing via `react-native-quick-crypto` Ed25519 with no `@solana/kit` in the path. An MMKV outbox keyed by `commandId` (Expo SecureStore; RNQC; MMKV v4) |
| Mobile updates | `runtimeVersion` policy `appVersion`, already set. `expo-updates` carries copy and bug fixes only (Expo `eas-update`) |

**Before a lane writes code**, its brief lists the Context7 reads for what it touches. Context7's monthly quota ran out on 29 Sep. Until Abu adds a free API key (context7.com/dashboard), lanes read the same libraries' official docs directly (WebFetch or Firecrawl), recommended patterns first, and cite them. Canton sources are local: `context/03-sdks-tools/json-ledger-api-v2.md`, the node's `GET /docs/openapi` and `refs/official`. Findings that change a design go into the lane's spec, cited.

**Tests, per his rule.** Tests are written where correctness is in doubt, not as a deliverable:
- the Daml money gate;
- a differential test of the TS pricer against `prepare`;
- seat hygiene: a recycled seat is empty, and seat B gets 403 on seat A's data;
- a fault-injecting proxy that drops a submit response and asserts exactly one `Leg`;
- `seat.ts` signing parity with the server verifier;
- the reference's existing vitest suites kept green.

## What measurement settled

| Question | Answer | Evidence |
|---|---|---|
| Per-party privacy at the API level | Holds. Each party's query returns only its own contracts | `context/09-prediction-market/toolchain-spike-verified.md` |
| Shared pool or book under load | One shared contract admits exactly 1 of N writers; one contract per user admits all N | `contention-measured.md` |
| User trades alone | `Quote_Accept` with the user as sole controller works | `single-controller-verified.md` |
| Dry run | `interactive-submission/prepare` executes nothing, exposes cost and position, 0.5 s | `quote-dryrun-verified.md` |
| Slow approvals | `getTime` in a choice dies at ~80 s; `assertWithinDeadline` survives ~100 s | `signing-window-measured.md` |
| Deadline semantics | `assertWithinDeadline` fails **at** the deadline; `assertDeadlineExceeded` passes at it. The reference admits a print at `now == deadline`, so an exact port asserts against `deadline + 1s`. Failure id `stdlib.daml.com/deadline-exceeded` | `daml-stdlib-3.5.2/DA/Assert.daml:64-86` |
| Reference money grid | Integer and exact: price in ticks of 1000, size in lots, `cash = lots × ticks × cashUnit`. "No rounding happens anywhere in the engine" | `docs/plan/specs/events-engine.md:28` |
| Reference market shape | No strike. A Window resolves Up when `close ≥ open`, ties to Up | `docs/plan/specs/prints.md:267` |
| Noders shared node | One Keycloak account = one ledger user with act-as on its own ≤20 parties. Tokens last 3 h. **DAR upload and party creation are through the Console**; the API user is not `participant_admin` | `context/11-wallet-and-deployment/s3-materials-update-2026-09-21.md:30-42` |
| Apple and a devnet prediction market from Abu's account | Agari's public TestFlight beta was submitted 25 Sep and public 27 Sep | `agari-wt/mobile-takeover` commits `6832b6f2`, `661a24ee`; `mobile/TAKEOVER_STATUS.md` |
| Grofty holding our contracts on MainNet by 9 Oct | The wallet's node must vet our package and our MainNet node needs committee approval, neither of which we control; so Grofty carries money through the token standard, and our contracts live on DevNet | `context/11-wallet-and-deployment/` |

## Architecture

```
iOS APP  the reference's native Expo app (mobile/), same @…/markets client half as the browser
  seat seed in the Keychain · ed25519 via react-native-quick-crypto · push on settle · SSE ladder
        │
BROWSER  no ledger credential, ever
  packages/markets (client half): hooks, order lane, localStorage journal, recovery,
  indicative quotes = core book-math over the venue price ladder (SSE/poll), seat key (ed25519)
        │ same-origin HTTPS, seat cookie (web) or signed seat header (iOS)  ▲ SSE prices + ladders
        ▼                                                     │
NEXT ROUTE HANDLERS (runtime nodejs)                    SERVICES/OPS  one process, single writer
  /api/seat            lease, renew, release              roller · 3 oracle feeders · pricer
  /api/ledger/me/*     per-party ACS reads                quote issuer over K cash shards · expiry sweeper
  /api/ledger/quotes   → ops /internal/quotes (HMAC)      resolver proposer · settler · netting · rebalancer
  /api/ledger/*/accept actAs = the cookie's seat party    PROJECTOR (/v2/updates as venue → Postgres)
  /api/index/*         projection reads (kept wire shape) seat funding + close-out · heartbeats · /health
  /api/view            per-party view switcher            agent runner · game room
        │ packages/markets/server → packages/ledger             │ packages/markets/ops → packages/ledger
        └──────────────────────────┬────────────────────────────┘
                                   ▼
        Canton participant: local sandbox │ Noders DevNet (demo of record) │ hosted sandbox (Plan B)
        Postgres: projection of the VENUE's view, seat table, command journal, print archive, off-chain product data
```

**1. `packages/markets` splits by subpath, not by bundler tricks.** The root and client subpaths become an HTTP client against our own routes; the precedent is `provider/indexer-base.ts` (same-origin in the browser, loopback or an internal URL on the server). The ledger half is a new `@…/markets/server` subpath over `packages/ledger`, following the existing "server-only, not re-exported from root" convention of `holdings/` and `sponsor/`. The `server-only` guard sits in `web/src/lib/ledger.server.ts`, because ops is plain Node.

**2. The app's `Address` is a browser-held ed25519 seat key, not the party id.** `isAddress` is base58-of-32-bytes (`packages/core/src/types/primitives.ts:25`), about 50 web files validate with it, and every signed route (takes, room, strategies, x bind, push register) verifies ed25519 against it. A party id (`c2ede6f6-alice::1220…`) fails all of that. The fork already mints browser keys with WebCrypto (`web/src/features/games/duel/game-keypair.ts`); the seat key follows D-066 (non-extractable). The server maps seat address → leased party. `signText`, the signed routes, HMAC tokens, DB keys, avatars and the journal stay as they are. The party id appears as a second fact in the account modal and the chip. `MarketId` is a derived base58-32 value (hash of series key and window index) stored on the terms contract.

**3. Trust boundary, stated honestly.** On Noders one ledger user can act as all our parties, so the ledger cannot enforce who acts as whom; our code does. Rules: a route derives the party **only** from the seat row the cookie names, never from body or query; infrastructure party ids live in a module `web/` may not import; quote issuance goes web → ops over HMAC so venue authority is never exercised from the web tier. The proof page says this plainly. A second platform account for seats would make the split real; that is a question for Noders, asked openly, never done quietly.

**4. Seats.** Parties are a fixed set created in the Console. Budget: venue (the primary party), resolver, 3 oracles, auditor, liquidity provider, agent runner = 8; outsider and one demo persona = 2; 2 for drive scripts; **about 8 visitor seats**, final split fixed in C0 after onboarding. Lease only on an explicit "Take a seat" click, `FOR UPDATE SKIP LOCKED`, idle TTL 15 min, counted only while the seat holds no open leg or live quote; a seat with open legs is never drained before they settle, and the ~4 h hard cap applies only after its last leg settles, so a backgrounded phone still gets its settle push. Multi-day event positions could otherwise hold a seat for days. A seat whose only open legs are on markets settling more than 24 h out, and whose devices have not renewed for 24 h, drains through `Leg_CloseOut` at cost plus fee, shown in its history with the reason. The pool size is watched on `/status`, and Noders is asked (openly) for more quota or a second account. States `leased → draining → free`: ops stops quoting to the seat, short lanes settle, open legs close out at cost via a two-controller `Leg_CloseOut`, cash sweeps, open quotes archive, fresh demo cash credits. Off-ledger history is keyed by seat address plus lease id, and reads filter by the lease's start offset, so a new visitor never sees the last one's positions. Pool exhausted → a state-kit plate ("All guest seats are taken, next frees in m:ss, this page will take it for you"), FIFO waitlist, all public reads stay live. LocalNet and Plan B have unlimited seats.

**5. Reads.** Per-party ACS (1–2 s cache, invalidated on own writes) for anything that gates a write or shows the user's own money, and always for the view switcher, which echoes the literal `filtersByParty` body on screen and whose `as` parameter is an enum of reserved personas, never another visitor. The projection serves history, lists, stats. The existing `/api/index/wallet/<address>/*` routes are open today (`queries.ts:56-73`), which is a privacy breach on Canton: they require the cookie and `address === cookie.address`, else 403. Honest wording on one shared participant: "queried as party X; the participant returns only contracts X is a stakeholder of". The multi-participant LocalNet run carries the strong claim.

**6. Prices and the quote handshake.** The pricer (the reference's `fair.ts`, `gap-fair.ts`, `token-fair.ts`, unchanged) publishes a **venue price ladder** per side as `BookLevel[]`, the shape core's `book-math.ts` already walks. `quoteFromBook`, `useStakeQuote`, the depth widgets and `/surface` run unchanged, labelled "the venue's published price ladder (indicative, not a public order book)". Zero server calls and zero contracts per keystroke. At click: `POST /api/ledger/quotes {marketId, side, stakeBase, displayedMaxCostBase}` → ops walks the ladder with the same kernel → cost above the confirmed cap returns a requote and creates nothing (the existing `RequoteError`) → else `VenueCash_IssueQuote` on a leased shard → the accept follows in about a second. Quote lifetime **20 s** on seats; 150 s only for the Grofty surface. `BookedOrder` is built from the created `Leg` event, never from the request.

**7. Units.** Integers end to end, including in Daml (`Int`): ticks 1–999, lots, `cashUnit`; `userStake = lots × ticks × cashUnit`, `venueStake = lots × (1000 − ticks) × cashUnit`, exact by construction. Fee `⌈quantity × rateBps × t × (1000 − t) / 10¹⁰⌉` with `quantity = lots × 1000 × cashUnit`. It is computed once in the pricer as integer ceiling `(a + b − 1) / b`, carried as a quote field, and bounded by an `ensure`. A further `ensure` bounds `lots × cashUnit` so every product fits Int64 (Daml aborts on overflow). `Decimal` appears only at the CIP-56 edge in C7b. One conversion file, `packages/ledger/src/units.ts`, strings ↔ bigint, never `Number`; `no-float-money` extends to it.

**8. Writes.** The journal id (already a UUID, `submitter/journal.ts`) is the `commandId`, stable per logical action; a fresh `submissionId` per attempt. Normal path is synchronous `submit-and-wait-for-transaction`; polling `GET /api/ledger/commands/:id` runs only after a timeout or 503. `lastValidBlockHeight` keeps its field and stores the deadline in epoch seconds. AD-3 becomes "never re-send under a new command id". A retry with the same `commandId` **and the same `actAs` set** is deduplicated only within the participant's deduplication period (measured in M0). The duplicate returns `DUPLICATE_COMMAND`, not the original transaction, so recovery reads the completions stream or looks up the update. Command ids are ledger strings of at most 255 characters. `userId` is omitted, because the token's `sub` supplies it. All Canton rejections map onto the existing 28 `Diagnosis` kinds; none added. Noders returns only a trace id on errors, so user-facing choices use `failWithStatus` with stable ids and C2x captures real failure bodies as fixtures.

**9. Tokens. Abu's decision, default shown.** The only credential Noders gives is Abu's own platform email and password. Noders' guide says to store the rotated refresh token; two processes doing that independently would invalidate each other. Two ways out:
- **Default (A):** `packages/ledger` takes a password grant per process, single-flight, re-granted at 80% of `expires_in`, and stores no refresh token. Cost: the platform password sits in the secret store of **both** the web host and the ops host for the build and the judging window. User exits keep working with the worker down.
- **Alternative (B):** only ops holds the credential and serves short-lived access tokens to the route handlers over `/internal/token`. Cost: one extra hop, and user exits depend on that process being up.
Either way the password is unique to this login, server-only, never in a `NEXT_PUBLIC_*` name, and rotated after judging. **UNVERIFIED:** whether the realm limits concurrent sessions; if it does, B is forced. Probed in M0.

**10. Hosting: Coolify, a Namecheap domain, no Cloudflare.**
- **DNS.** Abu adds A records at Namecheap straight to the server's IPv4: `@` (web), `docs`, `ops` (price and ladder SSE), `room` (duel WebSocket). A wildcard `*` would also work. `dig +short <host> A` verifies each. AAAA only if the server's IPv6 path works.
- **TLS.** Coolify's Traefik issues Let's Encrypt certificates with the HTTP challenge (Coolify docs), so the records must resolve before the first deploy of each app.
- **Apps.** Web, ops and Postgres run from the reference's Dockerfiles (`web/Dockerfile`, `services/ops/Dockerfile`) as new Coolify apps beside Agari's, which stays up. Docs is a fourth app. The worker is a single machine, as the reference requires. The first hosted deploy is a lane inside M1, not a late stage.
- **Client IP (D-122).** With Traefik as the only proxy, set `TRUSTED_PROXY=forwarded`. The reference's `web/src/lib/client-ip.server.ts` already supports exactly this ("a proxy that owns that header (Traefik …)"). `publicOrigin()` then reads Traefik's `x-forwarded-proto` and `x-forwarded-host`, so the faucet's same-origin check and the X OAuth callback work over TLS.
  - Traefik's docs do not state plainly what it does with a forged `X-Forwarded-For` from an untrusted client (UNVERIFIED in its docs; **measured in C4e, 6 Oct: Coolify's Traefik drops it**, `docs/evidence/c4e-deploy.md`). So C0 probes it: send a request carrying a fake header and confirm the app records the real address. If the header passes through, Coolify's Traefik gets explicit `forwardedHeaders` settings, and the seven routes that read `x-forwarded-for` directly (`strategies/preview`, `holdings/gate`, `private/open`, `sponsor`, `room/limits`, `sensei/rate`, the faucet) are moved onto `clientIp()`.
- **Region hold (D-095).** Detection reads `x-vercel-ip-country` (`web/src/lib/region-mark.ts:12`), a header only Vercel sets, so without Vercel or Cloudflare nothing marks a visitor's country. The port gives `proxy.ts` its own country source: a local IP-to-country database read at the edge of the request (default: DB-IP's free "IP to Country Lite", which needs no account, under CC BY 4.0 with attribution on `/legal`). `OWARINE_REGION_OVERRIDE` still forces the state for testing. Abu chooses the source (see his decisions).
- **No CDN edge, so the app carries what the edge did.**
  - Static assets rely on Next's immutable `_next/static` caching.
  - Public read caching stays in the app (the reference's 2 s shared cache on `/api/index/*`).
  - Abuse protection is the reference's own per-IP rate limits, which only work once the client IP is trusted.
  - SSE must not pass through any compression middleware that buffers it: C0 checks that price events arrive one by one through Traefik.
  - Traefik's rate-limit middleware stays available if abuse appears during judging.
- **Capacity first.** The VPS filled its 38 GB disk on 22 Sep. Before the first Canton deploy, C0 checks free disk, sets Coolify to one concurrent build, prunes images, and gives the new apps a disk budget. If that budget does not fit beside Agari's apps, Abu adds a volume or a second small server; that is his call, recorded as a decision.
- **Deleted.** `/api/rpc` and `/api/rpc/mainnet` (D-121), each with a `no-solana` entry.

### Adapter mapping (all 27 subpaths)

**Web's hooks are part of the seam.** Mobile imports 269 web modules through `@/` (D-129), and several of them are Solana-bound: `providers/UserSessionProvider`, `providers/wallet/*`, `features/session/*`, `features/vault/*`, `features/private/*`, `features/funding/*`, `features/markets/faucet/useFaucet`, `features/games/duel/{gas,game-keypair}`, `lib/wallet-session`. The adapter work therefore includes these hooks, changed as behaviour-neutral splits (D-129: web never imports from `mobile/`). Two subpaths are new since 22 Sep: `./sessions/mobile`, which becomes the seat signer, and `./desk`, which becomes the Canton desk client, with its mainnet leg gated on C7b and practice desks as paper ledgers.

| Subpath | On Canton | Live from |
|---|---|---|
| `.` root | HTTP client barrel: runtime config, `marketsProvider` (22 methods), boot facts, submitter session, journals, recovery, `diagnose`, `assertFunded` | C4; `freshExitQuote`, vault reads C7a; board and history C5 |
| `./env`, `./chain` | new zod schema (network, ledger path, indexer, price and ladder URLs, package name); `chainId` stays derived; `EXPLORER_URL` → our `/proof` | C1 |
| `./runtime` | ladder coordinator replaces account subscriptions; spot stream unchanged; `SeriesFacts` (`lotBase`, `tickBase`, `cashUnit`, `minLots`, `seatBond = 0n`) and `VenueFacts` re-meant. Deleted: `solana()`, paced RPC, account loaders, `decodeBook` | C4 |
| `./react` | same 51 hooks; only `WalletSession.signer` changes type. `useReadingQuery.ts:97-100` preserved exactly (a failed boot fact is the answer, else the app hangs on skeletons) | C1 shell, C4 live |
| `./sessions` | `SessionSigner = {seat} | {role}`; `nonce-queue.ts` kept (two tabs must not race one seat's cash). Deleted: keypair, session-key, sponsor transport | C4 |
| submitter (via root) | the nine order-lane steps re-pointed: status gate, re-quote, expiry, funding, build → issue quote, simulate → prepare, sign → accept, confirm, book from events | C4 |
| `./identity`, `./perf` | unchanged | C1 |
| `./faucet` | demo-cash credit into `VenueCash`, server-side, also on seat lease. No SOL leg | C4 |
| `./sponsor` | machinery deleted, path kept: status truthfully reports no network fee. `checkGas`/`GasCheck` keep their names and return zero required | C1 |
| `./vault` | `VenueCash` is the trading balance; grants are `AgentGrant` | C7a |
| `./maker` | liquidity-provider reserve; `PoolTop` from the ladder | `PoolTop` C4, rest C8 |
| `./range`, `./parlay`, `./leverage`, `./strategies`, `./private`, `./games` | stub kit (`absent`, `unavailableFor`, `refusedFor`) until each package's money gate passes | C8, C9 |
| `./ops`, `./ops/{prints,indexer,settle,roller,maker}` | infrastructure ledger sessions per role party | C3 |
| `./deploy` | bootstrap manifest: parties, DAR versions, series, shards | C2x |
| `./proof` | re-verification from `Resolution` evidence, `PriceQuote`s, archived payloads, live exchange candles | C5 |
| `./holdings` | reads CIP-56 holdings once Surface B exists; honest read error before | C7b |
| `./x` | the reference's X bind, receipts and relay re-pointed to the seat address; the X API tier and the native cookie handoff are probed in M0 (UNVERIFIED) | C13 |
| `./prices/legacy` | deleted (Pyth/Switchboard posting) | C1 |

**Mobile follows the same seam.** `mobile/` imports `@…/core` and `@…/markets` like the web, so the adapter carries it. What changes on the phone: the wallet island `mobile/src/wallet/` (Mobile Wallet Adapter, Phantom and Solflare links) is replaced by the seat key, reusing the practice wallet's `practice-store.ts` (Keychain seed) and WebCrypto Ed25519 through the `react-native-quick-crypto` polyfill; `packages/markets/src/sessions/mobile/` becomes the seat signer; the connect drawer becomes the seat drawer; `@solana-mobile/*` and `@…/clients` leave `mobile/package.json`; the app reads the Canton network config instead of `addresses.devnet.json`. The widget and Live Activity keep running on `marketsProvider.nowMs()`, so `provider/clock-sync.ts` gets a Canton clock source (the server's clock against ledger time) in 1b. Everything else (screens, ticket, games, portfolio, onboarding) follows the adapter.

**Explicit `packages/core` edits** (it is not ported untouched): `isSignature` also accepts a Canton update id (`room/bet`, `lucky/placed` and `diagnosisSchema` validate tx hashes; never fake a signature by padding); `TICKER_SYMBOLS` gains BTC and ETH with a 24/7 basis; `VoidReason` gains the specific reasons additively; `Cluster`, `SOLANA_EXPLORER_URL`, `FEE_RESERVE_LAMPORTS` go; `ClaimKind` gains `stale-refund`.

**Invariants re-pointed:** `kit-import-boundary` → `ledger-import-boundary`; `write-boundary` bans `/v2/commands`, `execute`, `actAs` outside the ledger packages; new `no-credential-in-client`, `no-party-from-request`, `no-party-enumeration`; `idl-no-destination` → `choice-no-destination` (no choice takes a caller-chosen payout party); `program-id-drift` → `package-drift`; `no-solana` shrinking allowlist, empty at the C1 gate; `venue-identity` word list inverted (it bans `btc|eth|bitcoin|ethereum` today, which would fail the gate the moment crypto lanes land; it keeps banning `masayume|yosuku|somnia|dreamdex|flicky`, stops banning the crypto asset names, adds `stocklana|solana|lamport|phantom|helius|anchor`, and adds `agari` only after the package-scope rename lands); `accept-single-controller` (no user-controlled choice calls `getTime`); `file-length` covers `.daml`; new `docs-consistency` (below).

## Daml model

One package per product family so parallel lanes never contend for a version and a games release cannot force a money upgrade: `abu-pm-main`, `abu-pm-tickets`, `abu-pm-agents`, `abu-pm-games`, `abu-pm-governance` (BitSafe), `abu-pm-mainnet` (Grofty), and `pm-tests` as the only package depending on daml-script. damlc 3.5.2 targeting LF 2.2, the default. The Noders node runs **Canton 3.5.18** (public `/v2/version`, checked 29 Sep). The local sandbox comes from the dpm 3.5.10 assembly (Canton 3.5.17), so it has the POST `active-contracts-page` the node has; the 3.5.2 bundle's Canton 3.5.6 has only GET-with-body, which Node's `fetch` refuses. No contract keys. **Package names are shared across the whole participant**, and the same name and version with different content is rejected. So `daml.yaml` versions are bumped on every upload; the spike is never uploaded (it would occupy `pmspike-*` forever); C2x uses a throwaway `abu-pm-dev`; `abu-pm-main` first uploads at R1; after R1 every change passes the upgrade check (no removed fields; new fields Optional).

**Rules.** Every user-visible contract has exactly two stakeholders, that user and the venue; the duel match is the one named exception. Market terms are immutable and status is derived from the clock as in the reference (no `Open`/`Close` choices, which would add two transactions per window and kill in-flight accepts). The user's accept path fetches nothing shared. Window creation goes through a consuming `Series_OpenWindow` that checks `nextIndex`, so a crash-retry cannot duplicate a window.

| Template | Signatory | Seen by | Notes |
|---|---|---|---|
| `Series` | venue | resolver, auditor | cadence, `cashUnit`, `nextIndex`, oracle list, quorum, `maxDeviationBps`, append-only `policyVersions` (the reference's dated price-policy versions) |
| `MarketTerms` | venue | resolver; users by disclosure | `tradingStart`, `lockAt`, `expiry`, `openDeadline`, `closeDeadline`, `policyVersion`, `printSource`, `tieUp`, and the **oracle list, quorum and `maxDeviationBps` copied from `Series` at open**, so resolution never fetches `Series`, which the roller consumes every window. Terms stay immutable. A single-use `WindowState` created with the terms is consumed by `Terms_RecordOpen` into `OpenPrint`, and `OpenPrint` is consumed by exactly one of `Terms_Resolve` or `Terms_Void` (controller **resolver**). A market therefore resolves or voids **exactly once** |
| `PriceQuote` | oracle | venue, resolver | one per `(oracle, symbol, boundaryT)` (identified by those fields, since there are no contract keys), not per market, so one print serves every cadence's close and the next window's open. `priceE8 : Int`, 1-minute candle close, `barStart`, `fetchedAt`, `payloadHash` |
| `OpenPrint`, `Resolution` | **resolver and venue** | venue; users witness it inside their own settle subtree, and `Leg_Claim` receives it as a disclosed contract (`createdEventBlob`) | both signatories, so neither can forge one and it exists only via the resolver's choice on venue-signed terms. Carries open and close price, winner, void reason, evidence, signer count |
| `VenueCash` | venue, owner | | `bucket` tag; `Spend`, `Merge` (owner); `IssueQuote`, `IssueTwoWay` (venue, on its own shards, locks the venue stake) |
| `Quote`, `BuyQuote` | venue | **observer user** | `termsCid`, `pairId`, `lockAt`, `priceTicks`, `lots`, `fee`, `ensure validUntil <= lockAt`. `Accept` (user only, takes a list of cash cids), `Expire` (venue, after `validUntil + 5s`), `Withdraw` (venue, named reason) |
| `Leg` | venue, owner | | `termsCid`, `pairId`, `outcome`, `lots`, `backingShare`, `feePaid`, `refundAfter`, `beneficiaryRef : Optional Text`. `Settle` (venue), `Claim` (owner), `Merge`, `CloseOut` (both), **`RefundStale`** (owner, needs no other contract: the real escape) |
| `NettedResidual` | venue | | what a cross-pair merge still owes at resolution or void |
| `VenueAccount`, `Publication`, `AgentGrant`, `LpShare`/`NavStatement` | bilateral | | grants embed their budget; caps from the reference's `caps.vectors.json` enforced in `Grant_AcceptQuote`; revoke returns the budget |

**Money rules fixed by review.** Fee is escrowed in the leg (`feePaid`), recognised as venue revenue only at a non-void settle; a void returns `backingShare + feePaid`. Merge within one `pairId` first; cross-pair merge releases `min(shareA + shareB, quantity)` with the rest held in `NettedResidual`, because paying the venue the full quantity leaves a void short (62 + 40 owed against 100). "Fully backed" is ledger-enforced only per pair; on DevNet the venue can mint its own demo cash, so solvency is a reserve claim the auditor party checks until C7b brings real Canton Coin. The plan and the deck say it that way.

**Money gate (the owner's rule: no financial stage starts until it passes).** In `pm-tests`: conservation after every step of 200-step seeded random sequences; pair invariant; the full tick grid; void after cross-pair merge; void returns backing plus fee; fee recognised only at settle; settle once; claim equals settle; deadline races at T−1, T, T+1 in both orders for accept/expire, open print/void, close print/void, resolve/stale refund, grant expiry and day rollover; venue cannot resolve at all; **the resolver cannot resolve without an oracle quorum, or outside `Terms_Resolve`**; **a market resolves or voids exactly once**; resolution bound to terms; quorum cannot be faked; late quote ignored; deviation voids; venue cannot confiscate; venue cannot accept for a user; wrong user cannot accept; stale refund without the market; stale refund of a losing leg is venue risk (the documented limit, with an alarm on any resolved market holding unsettled legs); outsider sees nothing; user sees only own; claim needs disclosure; open-window idempotent; policy coverage; grant caps vectors; grant revoke race; expired grant returns budget. Each product package adds its own conservation and void test. Outside Daml: `prepare` versus the TS pricer differential, `contention.py 16`, batch-settle sizing, kill-the-worker.

**The other nine programs** (arena, desk, leverage, maker, parlay, private, range, strategy, vault), in build order, each with the simplest faithful shape under the two-stakeholder rule: shared `PM.Reserve` (bilateral `LpShare`, auditor-visible `NavStatement`; four reference programs repeat this) → vault grants (M) → Earn/maker (M) → range and moonshot (S–M) → `BuyQuote` exit → leverage, Boost and `/short` (L; knock-out needs an oracle quorum beyond a pinned barrier) → parlay (M) → strategy registry, copy, fade, mirror (M; the sealed memory market was removed in the reference on 22 Sep and stays removed; subscriptions bilateral so a creator never learns who subscribes) → arena and duels (L; commit-reveal **stays**, it proves deck fairness, and `DA.Text.sha256` verifies the reveal on ledger; seat keys and credits go). Private desk (S) lands any time after the engine: the route and promise stay, the machinery goes, and visibility against the operator is unchanged, as the reference itself says. **Desk:** the reference's `agari-desk` (D-126) buys PreStocks via Jupiter on Solana mainnet; on Canton it becomes a `DeskMandate` built on `AgentGrant` (caps enforced in the choice, decisions recorded as contracts). Its practice desks stay paper ledgers, and its live leg trades our own markets with venue cash, which is a Daml-native mandate needing no external DEX. What the live leg holds is recorded for Abu as a decision (default: our own markets). Specs are written by a dedicated spec lane and frozen with the engine on **Fri 2 Oct**.

## Venue operations and the projector

| Actor | Change |
|---|---|
| supervisor, actor loop, heartbeats, `/health`, exit 78/70, DRY_RUN default, calendar, earnings, halt-watch, SSE, `print_archive` | unchanged. Spot feeds are unchanged except that the `ops/prints` fetchers (Jupiter, PreStocks, the Switchboard Surge simulator) move to an off-chain `prices/` module, since `./ops/prints` becomes a ledger session. `push-clock` moves from the LEGACY set into the default VENUE set, so settle pushes run by default. `market-maker` vault mode (`MAKER_MODE=vault`) maps to `./maker` in C8; `seat/valuation-fair.ts` and `lane-quote.ts` join the pricer. `matchmaker` (not wired in the reference's `main.ts`) gets wired in C9. DRY_RUN becomes prepare-without-execute, which validates against live ledger state |
| window-roller | `plan*.ts`, `versions.ts` unchanged; `execute.ts` → `Series_OpenWindow`. Deleted: book recycle, sweep, release, grow, rent maths |
| price-relay | becomes three oracle feeders (Coinbase, Kraken, Bitstamp 1-minute candle closes) posting `PriceQuote`, one command per oracle and boundary covering all symbols (`commandId` `print:<oracle>:<T>`). **This is a new sourcing decision, not a port**: the reference relay fetched Pyth Hermes, RedStone, Switchboard and Jupiter. It is recorded as a decision, and the reference sources are fetched too (see Lanes). Raw payloads still archived byte-identical; `payloadHash` binds them. The same feeders fetch the stock, xStock, PreStocks and Pyth prices for C6 (see Lanes) |
| settler | `decide.ts` nearly unchanged plus the quorum wait; terminal actions collapse to one venue-only `SettleBatch [legCids]` (users witness only their own sub-action; start at 25 on DevNet, measure 25–200 on sandbox; bisect on failure). Deleted: sweep, redeem-for, release book, close ledger, close market |
| seed maker | fair-value math unchanged, becomes the pricer; `quote.ts` becomes the issuer: an in-process FIFO over a shard pool (free / in-flight / quarantined until the completion for that `commandId` appears), K = 16 to start, rebuilt from the ACS at boot, shared with the sweeper, rebalancer and netting so the single writer is real |
| indexer | becomes the projector |
| new | expiry sweeper, netting, rebalancer, reserve reporter, resolver proposer, seat funding and close-out |
| role keys | `roleSecret(role)` → `roleParty(role)` from env or the bootstrap's `parties.json`; null still means scan-and-report |

**Projector: hand-written, not PQS** (PQS cannot refresh a password-grant token, and adds a JVM and a gRPC client). One `/v2/updates` WebSocket with `TRANSACTION_SHAPE_LEDGER_EFFECTS` filtered to the venue. It resumes from the stored cursor; with no cursor it replays from the pruning offset. It handles `OffsetCheckpoint` messages (emission delay up to 75 s on the node) and reconnects from the cursor on every token re-grant, at least every 3 h. Venue-wide reads, including the shard rebuild, use the paged POST or the WebSocket to avoid 413s; the cursor advances in the same DB transaction as the writes; rows keyed `(update_id, node_id)`; sandbox and DevNet get separate databases. Deleted with the Solana indexer: the commitment column, finality promotion, dropped-tx deletion, gap backfill, the signature walk. `/api/index/*` keeps its path table and wire shapes; only `idx/read.ts` SQL changes. `idx_orders` → `idx_quotes`. Scope is stated on screen: this is the venue's view as counterparty. Leaderboards, takes and activity come **only from opt-in `Publication` contracts**; market-level stats may use the venue view above k = 5 participants. Idempotent `commandId`s everywhere: `open:<series>:<index>`, `print:<oracle>:<T>`, `resolve:<termsCid>`.

**Lanes.** Crypto cadence lanes at the reference's cadences (300, 900 and 3,600 s, plus Masayume's BTC/ETH set) and a **1-minute demo lane, an Addition** (built in C3, because the sandbox has no static time and ops needs a fast loop) resolved by the three oracle parties. Institutional event markets resolved by committee attestation are an **Addition**, not a port; the reference has none. Equity, xStock-token, PreStocks-basket and Pyth-valuation lanes: the session, halt, gap, closed-market (S23) and pre-IPO logic is ported as it is, and the oracle feeders also fetch these prices off-chain (Pyth Hermes, the reference's Alpaca calendar, PreStocks) and post them onto the same attested path as crypto. There is no Pyth contract on Canton, and none is needed for an attested print. Whether those sources may be redistributed this way is a licence question for Abu, due **Thu 1** with a default (attested with the source named on every receipt, as D-101 already does). The equity feeder lane runs in C6.

## Every remaining capability, with its disposition

The completeness map (29 Sep) checked every parity row, web route, route handler, mobile route, ops actor, Anchor instruction, S19–S26 feature, docs page and Masayume/Yosuku row against this plan. These are the ones not already placed above. **Nothing here is Excluded**: an exclusion needs Abu's dated decision, and the ones he may want are listed at the end for him.

**Products and programs**

| Capability | Disposition on Canton | Stage |
|---|---|---|
| `product_add_dependent` / `release_dependent` (range, parlay and leverage pin a Window) | Product contracts carry the `termsCid`, and `MarketTerms` is never archived before its dependents settle. Settlement checks a dependents count in the projection, not on the ledger | C8 |
| `admin_set_mode` (venue pause, reduce-only) | Issuer policy plus an optional venue-signed `VenueMode` contract for audit; user exits never check it | C3 |
| Season prize pool (`admin_create_season`, deposit, distribute, withdraw remainder), Elo rank, `/games/rank`, arena tiers | `SeasonPool` in `abu-pm-games`: funded by the venue, distributed once, remainder withdrawn; the rating ladder stays an ops projection; tiers as a table in `Arena` terms | C9 |
| Strategy `creator_seal` (sealed spec, not the removed memory feature), `set_runner`, `deactivate` | `Strategy` holds a `specHash` sealed at publish; `SetRunner` and `Deactivate` choices by the creator | C8 |
| Desk attested reference, premium ceiling, hash-chained `operator_checkpoint`, shadow/pause mode, token allowlist | `DeskMandate` fields and choices of the same names: `Checkpoint` stores the previous hash, `Pause`/`Unpause` by owner, `allowList` of market series, `maxPremiumBps`. The reference price is the oracle quorum. `/api/desk/marks` serves our own marks | C8 |
| Private balance (`owner_move_to_private`, `withdraw_private`); `/api/private/{open,cashout,status}` | `VenueCash` `bucket = private`; the three routes keep their paths and call the same seat-authorised ledger writes | C8 |
| Earn: how LP capital backs the ladder | `LpShare` capital is a set of venue cash shards tagged to the reserve; the pricer's per-market cap is sized from reserve NAV | C8 |
| A-1a "Betting against" switch, A-2a idle-yield note (names Kamino, Jupiter Lend), A-2c realized yield | Switch unchanged (UI only). Idle-yield note re-worded truthfully for Canton (demo credits earn nothing). Realized / on-paper from `NavStatement` history | C7a, C8 |
| Leverage knock-out keeper, duel projector and settler, matchmaker | Ops actors, rows below | C8, C9 |

**Holdings-dependent UX before C7b** (cover and hedge cards, "Your stocks", basket cover, the drop bell, the landing Cover section): the reference reads real Solana wallet holdings. A seat holds none. These surfaces render the reference's own "no holdings" state until C7b brings Canton Coin holdings. After that they read CIP-56 holdings of Canton-native tokenised assets where any exist. The cover logic itself is unchanged.

**Social, X and share**

| Capability | Disposition | Stage |
|---|---|---|
| Blinks (`/actions.json`, `/api/actions/w/[marketId]`, `/api/actions/t/[symbol]/[cadence]`) and the Dialect registry | **Adapted**: Solana Actions have no Canton counterpart. The same URLs return a signed Window share link that opens the ticket on web or in the app (universal link). Abu may instead exclude them (listed below) | C13 |
| `/native-auth` (a blocked plate today) | Gets a job: the X sign-in handoff for the app, forwarding the X session into the app's scheme, which closes the reference's open native X gate | C13 |
| `/api/sentiment` (crowd flow on the marquee) | From opt-in `Publication` contracts only, with the k = 5 floor, and the privacy note on hover | C5 |
| Achievements, Trader Edge, reputation and badges, CSV, share cards, OG images, `/u/[address]`, `/activity`, `/news`, alerts | Unchanged surfaces over the adapter; their data comes from the projection (own seat) or publications (others) | C5, C13 |

**Proof, status, dev**

| Capability | Disposition | Stage |
|---|---|---|
| `/api/proof/pyth` (re-post an archived Pyth update to the Solana receiver) | Becomes "re-verify an archived price": recompute from the archived payload and its `payloadHash` on the `PriceQuote`. No chain post is needed | C5 |
| `/api/dev/verify-message`, `/dev/wallet`, `/dev/session`, `/dev/private` | `verify-message` checks seat signatures; `/dev/wallet` becomes `/dev/seat`; the session fixture shows the fast-mode chip's "a seat already trades in one tap"; private shows the bucket | C1 |
| Region hold (D-095, HTTP 451, `RegionNote`) | Kept: the server routes answer 451 and exits stay open. The country now comes from a local IP-to-country database, because no Vercel or Cloudflare header exists on this host (see Hosting) | C1 |
| L-10 wrong-network banner | Stays unmounted: the reasoning of D-120 holds on Canton (the participant is the app's), recorded as a decision | C1 |
| Parity rows L-19 / Y-17 "native app blocked" | Reclassified: the app exists, so these rows become Done in the reference and Adapted here | M0 |
| `/demo` launch film (Solana footage) | Re-shot on the Canton build by Abu with the reference's HyperFrames project (`agari-video`) | C10 |
| Docs site, 42 pages | Page-by-page rewrite list made in M0; `architecture/*` and `start/wallet` rewritten for Canton; the rest follow the product | C10 |

**Prices and lanes**

| Capability | Disposition | Stage |
|---|---|---|
| Price sources (`PrintSource`: Pyth, RedStone, Switchboard, attested) | All become **attested prints by our oracle parties**: the feeders fetch Pyth Hermes, RedStone and Switchboard values off-chain and sign them, and the receipt names the original source. The Alpaca session calendar is a calendar, not a price | C6 |
| Pyth valuation lanes (D-125 entitlement gate) | Kept: the lane lists only while the entitlement probe says the index is readable ("no dead lane is ever shown") | C8d |
| Oracle quorum: 3 exchanges versus Masayume's 6 sources with `minAgreement` 4 | Recorded as a decision. The default is 3 parties, quorum 2, with the ledger allowing more oracle parties in `Series` so a fourth is added without a code change | C3 |
| Masayume 4 h and 1 d cadences; BTC/ETH realised-vol re-measure; X grammar `<btc|eth>` | Cadences come across in C6. The realised-vol measurement is a C6 step before BTC/ETH fair values go live. The X grammar gains BTC and ETH | C6, C13 |
| D-123 demo-cash and ladder depth | Demo credits per seat and ladder depth sized to the reference's scale (100,000 credits a day), recorded in M0 | M0 |
| S24 (dark-mode balance controls, compact `/short`, runner rests when no Window trades, stalled-opening state) | All carried: UI unchanged, runner and stalled-opening logic in ops | C6, C8 |

**Ops actors not yet placed**

| Actor | Canton |
|---|---|
| `strategy-runner` + self-host `runner-main.ts` | Acts through `AgentGrant` as the agent-runner party; self-host keeps working with the creator's own seat |
| `leverage-keeper` | Posts knock-out and settle for Boost positions against the oracle quorum |
| `game-room`, `matchmaker`, `duel-projector`, `duel-settler` | Room unchanged (WebSocket, own subdomain); matchmaker and settler exercise `Arena` choices; the projector becomes part of the main projector |
| `x-relay` | Unchanged, placing calls for bound seats through `AgentGrant` |
| `push-clock` | Unchanged; the drain reads the Canton inbox |
| `desk-runner` (opt-in) | Acts on `DeskMandate` |
| `pyth-entitlement` | Unchanged probe gating the valuation lanes |
| Set split (VENUE / LEGACY / OPT-IN) | Kept as the reference has it |

**For Abu, optional exclusions** (each only by his dated word; the default is to build it):
- Blinks, if the share-link adaptation is not wanted.
- BTC/ETH on the marquee, if it reads as Y-08's excluded "multi-coin ticker".
- The "Strategies on X" strip, which the reference already removed (`d4a693e5`); recorded as his removal.

## How the work runs: his method, adapted

**Repo.** A new private repo beside this workspace; worktrees in `../<repo>-wt/`. No tool configuration files in it (his rule, D-113 note); standing rules live in `docs/plan/working-rules.md`. This workspace stays the knowledge base. Layout is the fork's, plus what Canton and iOS add: `web/` and `mobile/` (both ported), `packages/{core,markets,ledger,clients,db,brain}` (`ledger` new, `clients` regenerated from the DARs), `services/ops/`, `daml/{abu-pm-main,abu-pm-tickets,abu-pm-agents,abu-pm-games,abu-pm-governance,abu-pm-mainnet,pm-tests,vendor,released}` replacing `anchor/`, `scripts/` (bootstrap, codegen, invariants, drives, review harness committed this time), `infra/` (sandbox and LocalNet configs), `docs/plan/`.

**`docs/plan/` created in M0:** `working-rules.md`, `00-plan.md`, `STATUS.md`, `decisions.md` (the new repo's decisions use **`K-` numbers** so they never collide with the reference's D-113, D-127, D-128 and D-129 cited here; one block per stage so parallel lanes never collide: C0 K-001–009, C1 010–019, C2 020–034, C3 035–049, C4 050–059, C5 060–064, C6 065–074, C7 075–084, C8 085–099, C9 100–114, C10 115–124, C11 iOS 125–139, C13 140–149, BitSafe 150–159, Grofty 160–169, business 170–179, overflow from 200), `acceptance.md` (every command sent to Noders gets a row, failures included, with trace id), `parity.md` (seeded from the local `agari-wt/s26/docs/plan/parity.md`, 103 rows, plus the new mobile, basket, Pyth, desk, proof-feed, docs and push rows; advances only at gates). The reference's planning docs left git on 23 Sep, so this repo keeps them tracked or local exactly as Abu chooses; the default is to track them, because judges read them as evidence, `references.md` (code versus ideas licence discipline), `stage-NN-*.md`, `stage-90-business.md`, `specs/`, `runbooks/{noders-console,rebootstrap,snapshot}.md`. `working-rules.md` carries over his read order, scope rule, pnpm, 400-line cap, pure core, tests policy, Context7-first and commit convention verbatim; boundary, money, secrets, CLI and evidence lines change for Canton; new lines: DevNet is single-writer, parties are a fixed set, every DAR release runs `upgrade-check` and ends "needs Abu".

**Two guards against rules getting lost** (D-113 records a rule lost because a handoff said the opposite): handoffs may not restate rules, and a `docs-consistency` invariant fails the fast gate on the four banned scope phrases under `docs/plan` (listed in `working-rules.md`, spelled there so the check does not match itself). A **capability registry** (one file: capability → state, dependency, parity row, acceptance row) drives every honest-state plate, and an invariant fails if anything is marked live without evidence. Plates are scaffolding each stage deletes; the end state is D-113's: nothing in the app says "not live".

**Gates.** Fast `pnpm typecheck && pnpm invariants` · Web `pnpm build` · Daml `cd daml && dpm build --all && (cd pm-tests && dpm test)` · Release `dpm upgrade-check` against the last DAR in `daml/released/`. `main` is the trunk from day one; checks that need Abu are separate "owner check" boxes that never block a merge (last time they froze `main` for a week and the `m1-first-call` tag was never applied). CI lifted from Sotto's `ci.yml`: a `daml` job and a `ts` job, on PRs and pushes to `main` only, since lane pushes would burn a private repo's minutes in two days.

**Lanes and this machine.** Measured 29 Sep: 16 GB M1 Pro, **38 GiB disk free (91% full)**, no sandbox running. Ceilings: four **ledger or sandbox** lanes at once, with doc, spec, UX and business lanes running beside them; at most two sandboxes, each `-Xmx1536m`; one browser pass at a time; `pnpm build` only in the owner's and the `live` worktree; Docker LocalNet (12 GB VM) only at night with every lane stopped, or off-machine. The mobile lane builds in the cloud with EAS by default; a local `expo run:ios` is allowed only with no sandbox running (disk is 38 GiB free today). The Simulator is for side-by-side passes (the reference's `mobile/scripts/webdump.mjs`); a real iPhone for signing and push. Lane *n* uses web port `31n0`, JSON API `75n5`, ops `87n7`, database `pm_c<stage><lane>`. Only the stage owner edits manifests, the lockfile, `core/src/ports/**`, `markets/src/{env,index}.ts`, `ledger/src/{auth,env}.ts`, Daml version fields, `web/src/providers/**`, `services/ops/src/main.ts`, `scripts/invariants/**`, `.env*` and `docs/plan/**`. DevNet has one writer: the stage owner.

**Release train.** DevNet DAR releases are numbered R1, R2…, batched, each preceded by `upgrade-check` and each ending in a Console upload only Abu can do.

## iOS: port the reference's native app, ship on TestFlight

**Shape.** The reference's `mobile/` comes across as it is: web's phone layout ported literally. It follows the Canton adapter through `@owarine/markets` and through web's hooks (`@/` points at `web/src`), so every web hook change reaches the phone in the same commit. Only its wallet island and Solana copy change. From the native-app map, in order:
1. **Seat signer.** `packages/markets/src/sessions/mobile/practice.ts` becomes `seat.ts`: `{address: base58(pubkey), signMessage}` via WebCrypto `crypto.subtle` Ed25519 (the `react-native-quick-crypto` polyfill already installed in `polyfills.ts`), with no `@solana/kit` and no devnet check. A unit test proves the signature verifies with the server's `verifyWalletMessage`.
2. **Seat store and provider.** `mobile/src/wallet/practice-store.ts` becomes `seat-key-store.ts`, with the same seed and the same Keychain options. `WalletProvider.tsx` becomes the SeatProvider: load or create the seed, lease the seat with a signed canonical text, and fill web's `WalletShellContext`. `WalletSession.signer` becomes optional in web and markets.
2b. **Seat link between devices.** The web seat key and the phone's Keychain seed are different keys, so one seat on both needs signed pairing. The leased device shows a one-time QR or code (`POST /api/seat/link`, 60 s, single use), and the other device's key joins the same lease. It is a new surface, built with the 21st workflow. It is required before the C4 gate and the demo's step 1.
3. **First run.** The demo-credits gate becomes the last onboarding page (`onboarding-copy.ts:39-45`). Its accept creates the seat. The flag gets the new app's key prefix (both readers: `app/index.tsx:9` and `app/welcome.tsx`), and the SeatProvider re-checks it before creating a seat.
4. **Deletions.**
   - Phantom and Solflare links (`link-port.ts`, `link-store.ts`).
   - MWA (`mwa.ts`), `choices.ts`.
   - The tap-trading key (`session-key-store.ts`, `web-shims/session-key-provider.tsx`, `features/session-key/*`, the ticket's `session/*`).
   - `bytes-signer`, `link-wallet`, `link-crypto`.
   - `@solana-mobile/*`, `@agari/clients`.
   - The Phantom and Solflare query schemes in `app.json`.
   - The `+native-intent` wallet handling.
   - The mainnet-signer shim once the desk is on Canton.
5. **Env.** `lib/env.ts` and `web-shims/env.ts` drop `addresses.devnet.json`, the program ids and the Solana RPC. The app reads the Canton `MarketsEnv` (API base, price and ladder feed).
6. **Funds.** `app/funds.tsx`, `FundingFacts.tsx` and `AccountGate.tsx` become a demo-credits grant through a signed route. SOL, faucet and lamport lines go, including in duel (`DuelWaiting`, `DuelPicking`, `usePicking`), strategies and desk.
7. **Links and copy.** `lib/external.ts:25-28` and its ~12 callers point at our `/proof` and update ids. The Solana copy in onboarding, strategies, desk and portfolio changes. Phantom, Solflare, Backpack and Solana marks leave `brand-logos.ts`; Canton and the exchange logos arrive via `21st logo`.
8. **Live prices.** Wire `react-native-sse` so the spot stream and the venue ladder run on the phone; today they are silently off.
9. **Invariants.** The renamed `ledger-import-boundary` adds `@solana-mobile/` (the only Solana package the old rule missed; `mobile/` is already in scope).
9b. **Shim map.** `mobile/metro.config.js` swaps nine web files for shims by exact path: `lib/env`, `lib/visibility`, `lib/toast`, `lib/url-state`, `funding/credited`, `mainnet-signer`, `SessionKeyProvider`, `useGameKey`, and `markets/runtime/page`. It also has module shims for `next/navigation` and `lucide-react`. A web split that moves one would silently bundle the browser version: it crashes at runtime while `tsc` stays green. So the shim map changes in the same commit as any web split, and a new invariant fails if a shim key path no longer exists. `web-shims/game-key.ts` gets the Canton duel key: the seat key signs room credentials. `spot-stream.ts` takes an injectable `EventSource`.
10. **Push.** The client stays as it is: it already signs text with the wallet's `signMessage`, and a seat address satisfies `addressSchema`. On the server, `inboxFeed` reads the Canton projection, and `networkLine` names Canton.
11. **New surfaces.** The chip, the switcher, StepProgress, the quote ring, the seat link and Code Block use the native desk kit where it already exists (`mobile/src/features/desk/kit/`, `components/ui/CountdownRing.tsx`) and are otherwise ported literally from their web versions under the `mobile-design-literals` invariant, and verified side by side with `mobile/scripts/webdump.mjs`.

**Checks** (the reference's own, now joined by a seat test):
- `pnpm --filter @owarine/mobile typecheck`
- `pnpm invariants`
- `expo export` for iOS and Android
- a simulator side-by-side pass
- a real-phone pass for the seed, signing, push, the same seat on web and phone, and the empty outsider view

**Distribution: a public TestFlight link.** It is not Unlisted. Apple's guideline 2.2 says "Demos, betas, and trial versions of your app don't belong on the App Store – use TestFlight instead". Unlisted requests "will be declined … if your app is in a beta or prerelease state". Once approved, an unlisted app cannot become public without a new app record. First-hand evidence: Agari's public beta, a devnet prediction market from this same account, went from submission to public in about two days (25 → 27 Sep).
- The Canton app is a new product and gets new identifiers throughout:
  - a new **EAS project** (new slug, `projectId` and `updates.url`), so no update channel can ever reach Agari's live TestFlight build;
  - a new `scheme`, `android.package` and bundle id;
  - a new App Group, and new widget and Live Activity extension ids;
  - new SecureStore and MMKV key prefixes.

  Abu creates the App Group, the extension ids and Push on the new identifiers by hand, because builds run with `EXPO_NO_CAPABILITY_SYNC=1`. The App Store Connect API key and the APNs key are reused. The `eas.json` profiles carry over with the new `ascAppId`; Node stays at 25.9.0 as pinned there.
- D-128 says the practice wallet stays off externally reviewed builds while the account is Individual (guideline 3.1.5(i)). A new decision entry supersedes this: the seat key holds no asset and is a demo-account key, not a wallet.
- An Android APK from the new EAS project (with FCM credentials added: Android push was never run in the reference) follows the reference's release shape: a GitHub release, its SHA-256 and a QR code on `/download`.
- Carry over what worked for Agari:
  - an `xcrun altool` upload if the EAS submit queue stalls;
  - `EXPO_NO_CAPABILITY_SYNC=1` with App Groups and Push set by hand;
  - an internal group first.
- A public App Store submission on the same record is an optional parallel stretch. It costs nothing if rejected.

**Review hygiene** (from Apple's pages):
- Age rating: Simulated Gambling = Frequent, which gives 18+, volunteered.
- A first-run gate: "demo credits, no cash value, test network".
- No purchase path of any kind.
- No real-money path in the binary, so the Grofty connector never ships in the app (guideline 2.3.1).
- `ITSAppUsesNonExemptEncryption = false`.
- App Privacy declares the seat identifier.
- Review notes name a 1-minute market so a reviewer sees a full settle.
- The backend stays up throughout review (guideline 2.1(a)).
- Store listing: the name and subtitle avoid "prediction market" and "wallet"; category Utilities or Education.

## Build sequence: Tue 29 Sep → Thu 8 Oct

**Critical path.** M0 → (Daml money gate ∥ web+mobile shell ∥ DevNet skeleton) → ledger client and projector → venue ops on a 1-minute lane → hosted deploy → M1 → iOS beta review. Everything else runs beside it: at most four ledger or sandbox lanes, with doc, spec, UX and business lanes alongside. The Daml lane starts today because `daml/` does not depend on the import.

| Stage | Dates | Delivers | Gate |
|---|---|---|---|
| **C0 / M0** the fork builds | Tue 29 – Wed 30 noon | <ul><li>Baseline proven on untouched `661a24ee`: `pnpm install && pnpm typecheck && pnpm invariants && pnpm test && pnpm build`, plus `mobile` typecheck and `expo export`.</li><li>Import via `git archive` without `anchor/`; tag `hackcanton-s3-start`.</li><li>Yosuku CSS submodule.</li><li>Identity rename, leftovers itemised.</li><li>Invariants re-pointed, including the inverted `venue-identity` list and `no-solana`.</li><li>Toolchain check script (measured 29 Sep: a fresh zsh has no `dpm` on PATH, no JVM for `java_home`, and Homebrew Node 26.7.0 as default). It adds `~/.dpm/bin`, sets `JAVA_HOME` to openjdk@21, runs `nvm use 25.9.0` for `mobile/`, and installs the dpm 3.5.10 assembly for the local sandbox.</li><li>`.21st/design.json` hand-completed from `tokens.css`/`theme.css` (the 23 Sep auto-generation found no tokens), so `21st search --context auto` is grounded.</li><li>Parity ledger extended with every capability from the fidelity map (web routes, mobile routes, ops actors, programs, S19–S26).</li><li>`docs/plan/*`, CI on, env check.</li><li>**Noders probe**, every result an acceptance row (already known: Canton 3.5.18, CORS open, `/v2/version` public): rights, `POST /v2/parties`, DAR validate, token life, concurrent sessions, deduplication period, `synchronizerId` from `/v2/state/connected-synchronizers`, pruning offset, ledger-time tolerance, whether the primary party counts toward the quota, and a throwaway `abu-pm-dev` DAR with a package-name collision check.</li><li>Exchange-candle lag measured.</li><li>**Host probes on the Coolify server**, each an acceptance row: free disk and image prune; a forged `X-Forwarded-For` does not reach the app; `x-forwarded-proto` is `https`; SSE events arrive unbuffered through Traefik; a Let's Encrypt certificate is issued for each subdomain once its Namecheap record resolves.</li></ul> | three gates green; probe rows recorded |
| **C2** Daml engine | Tue 29 – Thu 1; hard marker Fri 2 | Two lanes: templates, then harness. `abu-pm-main` as modelled below; money gate tests first | the money gate |
| **C1** Canton shell, web and mobile | Wed 30 – Fri 2 | <ul><li>Lanes in order: 1a core edits → 1b stub adapter, including web's Solana-bound hooks → 1c web seat island → 1d consumer port → 1e mobile seat island (steps 1–7 of the iOS section, including 2b seat link) → 1f live prices on the phone.</li><li>1g **UX lane**: the Canton surfaces from the UX table, built from the reference kit first, with Code Block #23586 and the seat-link component from 21st. Each gets a `/dev` fixture. Native ports go only to surfaces the phone has: the chip, the switcher, StepProgress, the ring, the seat link and the demo-credits grant. Proof-page, privacy-matrix and trust-statement surfaces stay web-only, because the phone has no proof screen (Abu, 25 Sep). Canton and exchange logos come via `21st logo`. The D-081 ticket directions go to Abu at `/dev/ticket-canton` by Thu 1.</li><li>Seam inventory generator written.</li></ul> | <ul><li>Fast and web gates; `mobile` typecheck.</li><li>`no-solana` allowlist empty.</li><li>Every web route at 390/768/1440 in both themes, and mobile side-by-side via `webdump.mjs`.</li><li>Settled-state sweep; `21st review` on changed paths; `expo export` for iOS and Android.</li></ul> |
| **C2x** DevNet skeleton | Thu 1 | <ul><li>A throwaway `abu-pm-dev` 0.0.x DAR with the frozen C2 template shapes (`Series`, `MarketTerms`, `WindowState`, `PriceQuote` in Int, `Quote`, `Leg`, `VenueCash`, `OpenPrint`, `Resolution`), uploaded by Abu in the Console. The spike is never uploaded.</li><li>Market → quote → accept → resolve → settle through the real client, from four viewpoints.</li><li>Failure bodies captured.</li><li>`contention.py 16` and a 10-minute cadence soak.</li></ul> | first ledger updates on Noders |
| **R1** | Fri 2 | `abu-pm-main` after the money gate, uploaded by Abu in the Console | package vetted on Noders |
| **C3** ledger, projector, ops | 3.0 and 3a–3c from Thu 1 on the `abu-pm-dev` DAR; 3d–3e only after the money gate and R1 (Fri 2), to Sat 3 | <ul><li>3.0 `packages/ledger`.</li><li>3a projector.</li><li>3b roller.</li><li>3c oracle feeders.</li><li>3d pricer, issuer, sweeper and the SSE ladder.</li><li>3e resolver, settler, netting.</li></ul> | <ul><li>30 consecutive 1-minute windows unattended.</li><li>Projector rebuild equals live.</li><li>Kill the worker.</li></ul> |
| **C4 / M1** first call | Sat 3 – Mon 5 | <ul><li>Web adapter live.</li><li>Seat lease with reset, on web and phone.</li><li>Ticket with StepProgress and the countdown ring (as Abu chose under D-081).</li><li>View switcher and chip in the main route.</li><li>Hosted deploy on Coolify.</li><li>DAR release R2.</li><li>The same call from the phone on an internal TestFlight build.</li></ul> | <ul><li>`first-call.ts` four runs on sandbox, then on Noders.</li><li>Acceptance rows for lease, quote, prepare, accept, owner view, second seat empty, outsider empty, three attestations, resolve, settle, void refund, killed submit reconciled, stale refund.</li><li>`/status` green from outside.</li><li>Tag `m1-first-call`.</li></ul> |
| **C11** iOS | new bundle id and app record Wed 30; development build from EAS Thu 1; internal TestFlight build Sun 4; **beta review submitted Mon 5, hard date Tue 6** | <ul><li>The iOS section's steps 1–11.</li><li>Push on settle through the Canton inbox feed.</li><li>Review notes naming the 1-minute market.</li><li>Android APK from the same build.</li></ul> | <ul><li>Internal build leases a seat, places a call, receives the settle push.</li><li>Public link approved.</li><li>The TestFlight link and APK are handed to C10's `/download`.</li></ul> |
| **Wave 1** | Sat 3 – Wed 7 | <ul><li>C5 proof and analytics (proof re-verify, publications leaderboard, recount).</li><li>C6 lanes and states: crypto cadence lanes, committee-attested event markets, and the equity, xStock-token, PreStocks-basket and Pyth-valuation feeders on the attested path, with session, halt, gap and closed-market (S23) states live.</li><li>C7a trading balance and `BuyQuote` exit.</li><li>C13 assistant and community: Sensei and the Brake, reels, takes, the bet-gated room, X bind, receipts and relay (friends and follows were removed in the reference and stay removed).</li></ul> | each stage's own gate |
| **Wave 2** | Mon 5 – Thu 8 | <ul><li>C8 `PM.Reserve` → range and moonshot → Boost and short → parlay → Earn; agents, grants, strategies, copy and fade; private mode.</li><li>C8d baskets (points) and Pyth-style valuation lanes on the attested-print path; the desk with paper practice desks, live leg on C7b.</li><li>C9 games: off-chain first, then duel, Lucky, bet-gated room.</li><li>C7b Canton Coin rail if vetted on Noders.</li><li>C10 public story: landing, `/proof` feed, docs site port (docs.… on Coolify), `/download` with the TestFlight link and APK, and S25 sponsor visibility (the "Built on" band, per-price source lines, the docs sponsor page) re-pointed to Canton, Noders and BitSafe, with written permission for any third-party mark.</li></ul> | each package's own money gate plus acceptance rows |

**The same lane order continues after the snapshot.** A capability shows live if and only if its gate has passed and its acceptance row exists. Until then its route renders the D-015 state naming the gate it waits on. STATUS reports progress only as numbers: rows Done over total, and gates passed per day.

**Submission snapshot** (his soak-worktree pattern):
- From Mon 5, a daily tag `snap-N` marks the last gate-green `main`.
- The judged web URL is built from a detached `live` worktree at `snap-N`; development deploys elsewhere.
- Promotion needs all gates, `upgrade-check` against Noders, the live four-viewpoint smoke, `/status` green, the capability registry, and a link check.
- **Video Wed 7 evening**, after the C7a gate, against `snap-N`. **Thu 8:** tag `submission`, repo public, submit. Until Fri 9 20:00 UTC, a later snapshot replaces it only by passing promotion.
- After the deadline, no DAR goes to Noders until Mon 19 Oct.
- Wave 2 reaches the phone by dependency. JS-only work ships by `expo-updates` to the approved build. A final build goes to the approved public group on Thu 8 morning (review time for later builds of an approved version is UNVERIFIED; the reference's own second build is the evidence to watch).

## Add-ons, never on the critical path

| Add-on | Shape | Gates |
|---|---|---|
| **BitSafe governed resolution** | <ul><li>The governance Daml and its script tests run in `dpm test` in core CI.</li><li>`resolver` is a separate party from the first commit.</li><li>The three-node LocalNet needs a 12 GB VM: nights only with every lane stopped, or a rented host Abu provisions.</li><li>Do not apply for Gold (the apply date is Oct 4): Gold forfeits the pool.</li></ul> | <ul><li>Go/no-go: one unattended overnight run Wed 30. No first-hand propose → confirm → execute by Thu 1 morning, the lane stops.</li><li>Salvage: upstream setup fixes and the run report as a guide.</li></ul> |
| **Grofty money rail** | The C7b allocation path plus a PartyLayer connector on the web only | <ul><li>No invite by Thu 1, the lane stops.</li><li>Salvage: C7b ships anyway.</li></ul> |

## The business lane

Five of six judging criteria score this. It runs as one permanent lane with a fixed line in the STATUS header. Agents draft; Abu sends, enters, speaks and approves. No agent touches the hackathon platform, and the journal is never automated or padded.

| Date | Deliverable | Agent | Only Abu |
|---|---|---|---|
| **Tue 29** | <ul><li>**Mana, the hard gate.** It is 100 a day, claimed and burned from the dashboard button, and 1,000 is needed to publish. The organizers called **30 Sep "the cliff"**: Wed 30 through Thu 8 is exactly ten days, so from tomorrow no day can be missed. Check the dashboard count today and claim today too.</li><li>Quests are mandatory, and publishing needs **six materials uploaded as markdown files** (the dashboard gives hints). The agent drafts each one; Abu uploads.</li><li>Publish the project to the Projects tab early, so mentors see it.</li><li>Profile, Track 2.</li><li>A message to Grofty, the add-on.</li><li>15 interview outreach messages.</li></ul> | outreach texts; `docs/brief.md` | everything sent or entered |
| Daily | Platform activity and a journal entry | an evening facts file (commits, update ids, gates) | the entry, in his words |
| Wed 30 – Thu 1 | ICP document, interview guide, at least 3 bookings | drafts | bookings |
| Thu 1 – Tue 6 | At least 5 interviews, widened to reachable practitioners if needed | summaries only from his notes | runs them |
| Sat 3 | Metrics and a privacy matrix with a runnable command | drafts | review |
| Mon 5 – Tue 6 | Three usability tests on the M1 URL, and on the phone through the internal TestFlight group (testers must be App Store Connect users until the public link opens) | script | runs them |
| Mon 5 | GTM, regulatory posture, listing policy, deck v1, demo script, notices, public-release audit | drafts | review |
| **From M0, continuous** | **Prior-work disclosure.** The rule is verbatim: "You may build on a pre-existing codebase, but you must disclose it, and the work done during the hackathon must be clearly identifiable. Judges evaluate only that work." So: the tag `hackcanton-s3-start` on the import commit; a README section "Prior work (Agari, Solana) vs built 18 Sep – 9 Oct (Canton)" with the diff stat and a link to `git diff hackcanton-s3-start..submission`; the journal naming each day's in-window work; nothing presented as new that was imported | drafts, updated at each gate | review |
| Wed 7 | Rehearse and record | — | Abu |
| Thu 8 | Repo public after the audit; submit; every link opened in a private window | link check | the form |
| 10 – 18 Oct | Uptime watch; re-bootstrap runbook | probe | Console steps |

**Positioning:**
- A private event-risk desk, not "Polymarket but private".
- Claims stay inside `context/09-prediction-market/regulatory-framing.md`.
- Three self-run feeders are honest re-derivable prices, not independent oracles.

**What judges do** (Opening Ceremony): "open your repository… open your journal… run your demo… we judge working products not decks". So the landing page links the live demo and the video, and a stranger can take a seat and place a call in under a minute without help.

**Demo, 90 seconds:**
1. Alice takes 100 Up at 62 with one click, first on the web and then on the phone.
2. Bob sees only his own position.
3. The outsider's query returns nothing, with the body on screen.
4. Alice sells half back.
5. Three oracles post, the resolver resolves, and Alice is paid without signing; a push arrives on the phone.
6. A second market voids on disagreement and refunds cost plus fee.

## Verification

1. Daml money gate per package.
2. Fidelity per stage:
   - web at 390/768/1440 in both themes against the reference;
   - mobile side-by-side against the reference app;
   - drift fixed, not waived;
   - `21st review` on changed paths.
3. Sandbox four-viewpoint smoke.
4. Regressions:
   - contention;
   - prepare dry-run;
   - batch size;
   - the drop-a-response proxy.
5. Seat hygiene on both platforms.
6. Live smoke on Noders; `verify-live` after every deploy.
7. Kill the worker; the user still exits.
8. `upgrade-check` before every DAR.
8b. **Performance, measured.**
    - Web: a Chrome DevTools performance trace and Lighthouse on `/markets`, a Window page and the ticket at 390 px, against the reference's numbers on useagari.xyz. No regression in LCP or INP.
    - A price tick re-renders only the ticking cells (React Profiler).
    - Bundle check: no ledger module in any client chunk.
    - Mobile: a price tick does not re-render list rows (Reanimated shared values), and the market list holds frame rate while scrolling (Perf Monitor on a real iPhone).
    - Ops: quote issuance p50 and p95 on DevNet, with the settle-batch size recorded.
9. iOS on a real phone:
   - the seed persists;
   - a signed header is accepted;
   - a push arrives on settle;
   - the same seat is visible on web and phone;
   - the outsider view is empty.

   Then repeat the loop on a second phone through the public link.
10. Before submitting:
    - secret scan;
    - link check;
    - the prior-work tag;
    - `git log` inside the window.

## Risks

| Risk | Detect by | Response |
|---|---|---|
| Noders rights or quota differ | Wed 30, M0 probe (Noders said at the 21 Sep workshop that the party quota can be raised on request; every team can see all DARs, and the Console cannot delete them) | <ul><li>Create all 20 parties by hand.</li><li>Static seat pool.</li><li>Release train with Abu.</li><li>**Plan B**: a Canton sandbox on a VPS, switched by env var, rehearsed by Sat 3.</li></ul> |
| Only 10 days, nothing built | daily gate count in STATUS | <ul><li>The critical path above.</li><li>Four lanes from Wed 30.</li><li>The Daml lane starting today.</li><li>Money gate first, then everything that can run beside it.</li></ul> |
| Daml unfamiliarity slows the money gate | Wed 30 20:00: the resolver test and half the gate tests not green | No financial stage starts; add a second harness lane; non-financial lanes continue on the `abu-pm-dev` DAR |
| Mana gate missed | today | A fixed daily slot for Abu, never automated |
| Apple review slow or rejects | beta review outcome by Wed 7 | <ul><li>Submit Mon 5.</li><li>The Agari evidence (2 days).</li><li>Answer the reviewer once.</li><li>Expedited request under the event criterion by Tue 6 if unreviewed.</li><li>The web app is the demo of record either way; `/download` states the app's status truthfully.</li></ul> |
| A rule lost across sessions | every gate | Rules only in `working-rules.md`; the `docs-consistency` invariant; lane briefs inline the rules |
| Memory or disk | daily | Lane ceilings; `-Xmx`; one sandbox per ledger lane; Docker only at night |
| Node wobbles during judging | external probe from Mon 5 | Console runbook, API bootstrap, Plan B env flip, recorded video |
| Late pivot | any mechanism change after the C2 freeze (Fri 2) | Evidence-backed decision entries only |

## What Abu does

- **Daily:** click "claim mana" on the HackCanton dashboard. That's 100 a day, and 1,000 is needed to submit, so it must be 10 separate days. The organizers called 30 Sep the last day to start.
- **Only when the build reaches it, and asked then in plain words:**
  - Before the public DevNet demo: sign in once to the Noders wallet and console with his HackCanton account, about 2 minutes.
  - Before the iOS build: the new App Store Connect app record.
  - At the end: the video and the submission form.
- Everything else is decided by default and recorded in `docs/plan/decisions.md`, where Abu can overrule any of it. Domain and hosting come later.

## First actions on approval

1. Memory is already written (working style; iOS scope; Agari app as reference). Add the 29 Sep research facts: the reference's 21st kit (reused first); the web-hook coupling; planning docs out of git; hosting on Coolify with a Namecheap domain and **no Cloudflare** (Abu, 29 Sep); the Mana cliff; Context7 quota out.
2. Persist today's three research reports and the six from 22 Sep into `context/12-port-design/`, and point the workspace router at them, so they survive context clears.
2b. Correct the knowledge base where today's checks found it wrong:
   - `context/09-prediction-market/daml-sketches.daml.md`: the 12 passages listed by the Canton re-check (status field and `Market_Close`, strike, flexible `Market_VoidStale`, venue-controlled resolve, venue-only `Resolution`, fee at accept, `Quote_Expire` slack, Decimal `Leg.cost` and void refund, merge-to-quantity, Decimal rounding guidance, the false "`/` does not work on Int" gotcha, §4.3 rows);
   - `context/03-sdks-tools/json-ledger-api-v2.md:147`: GET-with-body up to 3.5.8, POST from 3.5.10, fields `pageToken`/`maxPageSize`;
   - `mechanism-design.md:99,108,185`: 20 s seat quotes, 150 s for Grofty only;
   - `single-controller-verified.md`: "19 tests" becomes 18 tests plus 2 setup scripts.
3. Start in parallel:
   - the C0 import and baseline on untouched `661a24ee`;
   - the Daml lane from the spike;
   - the Noders and candle probes;
   - `21st init --design-context` in the new repo.
