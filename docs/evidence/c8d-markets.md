# C8d — baskets and valuation lanes, then the C8 rows with no evidence (evidence)

Date: 2026-10-06 · lane C8d (`slice/C8d-markets`, from main `5e0d81c`) · decisions K-260 – K-268 · follows `c8j-live-markets.md` (A2, A3), `c8i-agents-gaps.md`, `c8e-tickets-ux.md`, `c2d-maker-vault.md`.

No Daml changed: R1 (`daml/released/`, five DARs) was loaded on the sandbox byte for byte. Where the plan names a Daml shape, this lane built the projection or ops form the plan's own words allow and records the ledger part as a decision for a later DAR release.

## Setup

- **Sandbox.** `dpm sandbox` (Canton 3.5.17), `JAVA_OPTS=-Xmx1536m`, ports 7600–7605 (ledger :7600, admin :7601, sequencer :7602/:7603, **JSON API :7604**, mediator :7605). DARs uploaded from `daml/released/` (main 0.5.1, tickets 0.1.3, agents 0.2.1, games 0.1.1).
- **Bootstrap.** `bootstrap-local.ts --seats 4 --users alice,bob,outsider --lanes crypto,preipo,basket` (then `--seats 10`, re-run, to add seats). Parties file in the lane's scratch directory, mode 600.
- **Ops.** The real process, `services/ops/src/main.ts`, `OPS_ACTORS=all,desk-runner`, `DRY_RUN=0`, :8760, Postgres `pm_c8d` (projector on), `ROLLER_SERIES=BTC-1m,ETH-1m,BTC-5m,OPENAI-60m,ANTHROPIC-60m,AILABS-60m,FRONTIER-60m,PREDMKTS-60m,DEFSPACE-60m,PREALL-60m`. The ops env file (`services/ops/.env.local`, gitignored, linked from the main checkout) supplied `PYTH_API_KEY` and the Alpaca keys; no key was printed. `DESK_MODEL_STUB=ACT_NOW` for the desk part (no model call was made in the lane). `OPS_ADMIN_SECRET` and `OPS_INTERNAL_SECRET` were throwaway values in the scratch env.
- **Web.** `next dev -p 3160` against the same parties file and database (restarted twice: new seats, then `NEXT_PUBLIC_SHARED_DESK_ID`).
- **Drive.** `scripts/drive/c8d-markets.ts` (parts `basket`, `valuation`, `venue-mode`, `products`, `knockout`, `strategies`, `mirror`, `private`, `earn`, `rest`), seats leased through `/api/seat` with WebCrypto-style Ed25519 keys, each check one acceptance-shaped row with its update id.
- **Browser.** Headless Chrome through CDP (`shot.mjs`, scratch) for public pages; an isolated Chrome DevTools context for the seat-owned pages. The shared Browser pane belongs to other lanes and was not used after the first look.
- **Host.** Load average 26–85; one network outage paused the lane for about four hours (nothing was lost: the sandbox, ops and web kept running).

## 1. Baskets, measured in points (C-S19a, C-N26)

| Check | Result | Evidence |
|---|---|---|
| Every basket Series opens on its attested index | AILABS, FRONTIER, PREDMKTS, DEFSPACE, PREALL 60m each opened at 02:00Z | update `12203c98b6f4d703409b85702affef4c15bd0831b99ddd163d5e1badd7498bde9986` (OpenPrint AILABS-60m) |
| Three oracle parties attest each index; the policy names PreStocks | 15 basket PriceQuotes, 5 boundaries with all 3 oracles; print sources `attested:basket:<SYM>` | update `1220eca09c894cd31b0490779d188440c700b8f3418514dea9e35977f1911e973c10` (PriceQuote AILABS by oracle-coinbase) |
| A basket call through the web | seat A: AILABS-60m:1 Up, 18 lots at 264 ticks; 1,000.00 → 995.21 credits | update `1220b7f48cce721e0b5fb87b2c1bbce744b0067b09a8f6e083065dfb015976f8fe49` (Quote_Accept) |

`/baskets` shows all five cards with the index in points, the Window live and quoted ("Live · 1h · 24/7 … Up 54¢ Down 52¢"); `/tickers/AILABS` shows the basket hub (`04-baskets`, `05-basket-hub`). The phone's `/baskets` and the basket hub share the same hooks; they were typechecked and exported, not run.

## 2. Valuation lanes and the Pyth gate (C-S20a, C-S20b)

- **Probe.** Ops' `pyth-entitlement` actor with the key from the env file: `OPENAI denied (403 pyth-indices)`, `ANTHROPIC denied (403 pyth-indices)` (again on 6 Oct; C8j.2 saw the same on 30 Sep).
- **No dead lane.** The bootstrap refuses `--lanes valuation` while denied (C8j.2), so no OPENAIV/ANTHROPICV Series exists; the drive checks "a valuation Series exists iff the probe says entitled" (pass) and that ops' roller states carry no valuation lane (pass). A Series registered earlier and later refused would read `paused: no signed source (Pyth feed not entitled)`; the lane boards now treat that as unlisted, never a paused card (`pausedInLane`, test).
- **The surface says why (K-260).** `/tickers/OPENAIV` renders the D-015 block: "OpenAI valuation (Pyth) is not listed … the venue's Pyth key may not read it (Hermes answered 403, group pyth-indices, checked 01:50 UTC)", "waiting on a Pyth key entitled to the pyth-indices group", and a way to the OpenAI token's hub (`01-valuation-unlisted`). `/tickers/OPENAI` says why its Pyth rows are absent in one caption (`02-preipo-index-absent`). While entitled, the valuation hub shows Pyth index · Token price · Token vs Pyth · Index age and the lane's Window (`/dev/pyth-index`, `03-dev-pyth-index`).
- **Ticker previews (C-MKT-01, K-261).** A 24/7 name's OG card reads ops' live print instead of an NYSE close: AILABS "1,156.47 pts · Index in points", OPENAI in dollars, OPENAIV "Not listed" with the reason (`og-AILABS`, `og-OPENAI`, `og-OPENAIV`).

## 3. Venue mode (C-DAML-02, K-264)

| Check | Result | Evidence |
|---|---|---|
| Open: seat B buys a BTC-5m leg | 10 lots Up | update `122001220a976ae4ac92b55dc27da99552c0413487b136f29ba10e422d225ebe189f` |
| The operator sets reduce-only | admin route (`OPS_ADMIN_SECRET`) → `venue_mode_log` row; `/session.venueMode` reduce-only | `POST /internal/admin/venue-mode` |
| New risk is refused | firm quote, range ticket, Earn supply: `market-not-trading` "the venue is reduce-only by its operator (C8d drive): no new positions; exits, claims and refunds stay open" | `/api/ledger/quotes`, `/tickets/range`, `/tickets/earn` |
| A way out is not | seat B sells its 10 lots back | update `12204ce08e1d07f21a9aa4af731c02c2601f19570c5e825996cb4e8495bae4f5aaff` (BuyQuote_Accept) |
| The roller holds new Windows | `BTC-1m "paused: venue reduce-only (C8d drive)"` | ops `/session.lanes` |
| Open again | a BTC-1m quote issued | update `1220b9f9084d3b12b14fa0c2ee6a209c9e733df0bd318866a4c71039c757148eca8f` |

`/status` gains "Venue mode · new positions" (`12-status`), the paused card reads "Paused: venue reduce-only" with the reason (`/dev/states`; live, the lanes said so in `/session` — a fresh browser's first visit to `/markets` is covered by the welcome card, so no live screenshot was kept), and `/api/venue/facts` carries the reference's numeric mode.

## 4. Products against the oracle quorum (C-OPS-09, C-DAML-03)

| Check | Result | Evidence |
|---|---|---|
| Seat C opens two 3x boosts and a range on one BTC-5m Window | Up 3x at 0.49 (front 7.99), Down 3x at 0.58 (front 7.89), range inside ±0.1% | `/api/ledger/tickets/{boost,range}` + accept |
| The projection counts the dependents | 3 open on the Window's terms: boost, short, range | update `1220bf05a6809fe557623c532d298365a51fa62f2c7bf976b62d2ef0d316fbaa5035` (idx_dependents) |
| The leverage keeper reports the book | "2 live boost(s), 2 with a barrier" | ops `/health` |
| Every dependent closes with its choice | boost Boost_Settle; short Boost_Settle; range Round_Settle | update `1220c4606218d18eff4f25dc98d52a30973f1e4e9334e8f680bc3f0fe905cada3824` |
| A knock-out at a quorum print past the barrier | BTC-5m:72 Down 3x at 0.40, knocked out at the 07:47:00Z boundary (median 85,567.70 vs barrier 85,555.09, 3 oracles), fifth Window tried | update `1220054965200529ee0083aec9b47f90f1bb52cc819874d1c25444bc35de2e93686f` (Boost_KnockOut) |

The keeper's heartbeat before it: "1 live boost(s), 1 with a barrier · closest BTC-5m:72 Down 4 bps from its barrier". The first knock-out run (cheap side ≤ 0.30 only) found one such Window in 40 minutes and it settled; the ceiling is now 0.60.

## 5. Strategies, copy a trader, the agents board (L-57, A-3b, L-54)

| Check | Result | Evidence |
|---|---|---|
| Seat D publishes Mean-reversion and a copy of seat A (house runner) | reversion `#4432851860288276`, copy-A `#4402313553539727` | License_Publish ×2 |
| Seats E and F copy them with funded permissions | grants and subscriptions landed | GrantDesk_Open, Subscriber_Subscribe |
| **L-57** the runner places E's Mean-reversion call | FRONTIER-60m:1 Up, 19 lots | update `12209016aef19908c284aa4d16f049ecaed7baa8581949fec3fed161967207422917` (Grant_AcceptQuote) |
| **A-3b** seat A calls and publishes; the runner copies for F | Up on BTC-5m:15, F Up 1 lot | update `122058ea445396c4336f0cb4ca42e03bca0bef69d46b2b24e46c88518c1c216ec97e` |
| **L-54** the agents board lists the house runner | 2 strategies, 3 fills | `/api/strategies` (`11-agents`, `13-strategies`) |

The first A-3b attempt failed: the runner read the trader's `wallet/*` fills, which answer 403 to anyone but that seat, so every copy logged "calls are unreadable" (fixed, C8d.3). A second attempt failed only because seat A's call came two seconds before lock; the step now calls at least 150 s before lock.

## 6. Private mode on Canton (L-39, K-266)

| Check | Result | Evidence |
|---|---|---|
| Status | ready, mode `venue-bucket`, 1–50 credits per call | `GET /api/private/status` |
| Move 20 credits in | public 1,000.00 → 980.00; private 20.00 | update `12209bd58f989a2a4ebfb9a85f392e6c97ca8cf6f434d4c2ac322b82a717aca2c51c` (VenueCash_Withdraw + VenueAccount_Credit "private", one transaction) |
| A signed private call | BTC-5m:73 Up 10 lots for 4.70; private 15.30; public unchanged; not in public positions | update `122040e23e96cfa779e830526e58c6f276696b38b93e82a528773ab80c527716d064` (Quote_Accept, beneficiaryRef "private") |
| Cash out before settlement | `open`, nothing moved | `POST /api/private/cashout` |
| Cash out after settlement | won: payout 10.00 home (15.30 → 25.30); a second cash-out answers `done`; publishing the receipt answers 409 | Receipt_Dismiss + re-bucket |
| Move the rest out | 25.30 out; public 980.00 → 1,005.30 | update `1220aa2a5df7e38691d8ed5e1b87623f87c8b4682977fc077ba7e756f6ced9f25546` |

Through the app (seat `7WAC…JSt5`): Deposit 20 from the Portfolio's Private panel; "Buy UP privately for …" on the ticket placed a call ("Private bet placed: UP on BTC 5m"); after settlement the private list showed "+6.16 · On the ledger · Cash out", and Cash out answered "Cashed out: 11.00 credits credited to your private balance" (`15-ticket-private`, `16-portfolio-private`, `09-dev-private`).

## 7. Earn: be the house for every reserve (A-2b), and the idle-yield note (A-2a)

Seat H supplied 10 credits to each reserve through the Earn route: maker `1220314114d27c703a4fb4a073cdd03c121e5a7b4c7076d10d428d238f86bc4fb4ea`, range `1220c5587ec081ba7ecce93a97c00062a29da37810f9c33c49f6d2dfa46049340a71`, parlay `12205144009c83c90d39f936527aa3376ecfc1d7b5b0dc2e9c48c3ac40e9bed6963e`, boost `12209a75b47be5cae214fab466035b75d8700241c5f34641d769f92880f21f2129f4`; then withdrew its range shares at the live NAV (`1220f169263106fa28ed331103a1984265235166c50415aac1492b61483ba73281e4`). `/earn` shows the four tabs (`14-earn`). The idle-yield note now says demo credits earn nothing on this Canton venue (K-268).

## 8. The desk watcher and the judges' shared desk (C-S21d)

- A seat built a practice desk in `/desk/new` (AI Labs, then Prediction Markets) and turned Share on; `NEXT_PUBLIC_SHARED_DESK_ID` names it.
- **Found:** `/desk` threw "data must be asc ordered by time": two checks recorded in the same second (fixed, C8d.14).
- **Found:** DeskWatcher never rang for a decision: the feed parsed the stored outcome (`WOULD_HAVE_ACTED`) against the wire columns (`would_have_acted`), so every item went out with a null outcome; the reference has the same bug (fixed, C8d.16). After the fix two WOULD_HAVE_ACTED records rang "Your desk: Would have acted" on `/baskets` (`06-desk-watcher-toast`).
- A visitor with no seat sees the shared desk on `/desk` ("A SHARED DESK · Prediction Markets · LATEST CHECK … WOULD HAVE ACTED") and its read-only page (`07-shared-desk-entry`, `08-shared-desk-visitor`).

## 9. Dark-mode balance controls and compact /short (C-S24a); the runner rests (C-S24b)

- The balance controls (accent Max, filled Deposit, outlined Withdraw, dashed disabled) render in dark mode on the Portfolio plate (`16-portfolio-private-1440-dark`); `/short` is the compact picker (`10-short`). Both are byte-identical to the reference (`vault.css`, `short-picker.css`).
- **The runner rests (C-S24b).** Drive part `rest`: the operator paused the venue at 08:41Z ("C8d runner rest"); the roller held every new Window (`paused: venue paused`); when the last trading Window locked, the runner wrote "resting: no Window is trading on any lane; checking every 5 minutes" for its 3 strategies (08:57:41Z, `runner_heartbeats`), with no price read and no model call; the drive then opened the venue (`venue_mode_log`: paused → open at 08:57:59Z) and the 09:00 Windows opened. `isStalledOpening` (a Window whose opening print is over 2 min late leaves the boards) is core's, unchanged from the reference and covered by `phase.test.ts`; it was not provoked on the sandbox.

## Found and fixed

| Commit | Found | Fix |
|---|---|---|
| C8d.3 `7db090f` | Copy-a-trader read lease-scoped `wallet/*` fills, refused 403 | reads the trader's published calls (`listPublishedFills`) |
| C8d.4 `7d13b7a` | Phone agents board linked the house runner to a dead `/u/` route | follows web's `runnerHref` |
| C8d.8 `6588d8b` | `leverage-keeper` was the Solana keeper (empty seat-scoped list, refused writes) | watches the Boost book against the quorum; the ticket keeper writes |
| C8d.14 `0246d1a` | `/desk` crashed on two checks in one second | one chart point per second |
| C8d.16 `747d613` | DeskWatcher never rang for a decision (outcome null on the wire) | `feedOutcome` maps stored → column |
| C8d.13 | `/api/private/*` answered 503 / not-live (Solana desk-signed slots) | Canton private bucket (K-266) |

## Gates

On `8df6595` (the tree before this note):

- `pnpm typecheck`: clean for every project, mobile included. `pnpm invariants`: 0 errors, 0 warnings.
- `pnpm vitest run`: **331 files passed, 13 skipped; 2,539 tests passed, 61 skipped.** New: `index-state.test.ts`, `next-window.test.ts` (C8d case), `mirror-scan.test.ts`, `venue-mode.test.ts`, `decode-dependents.test.ts`, `leverage-keeper/book.test.ts`, `private-bucket.test.ts`, `feed-outcome.test.ts`.
- Against real Postgres (`SEAT_PG_URL`, lane database `pm_c8d_web`): `packages/db/src/idx/*`, `desk.test.ts`, `desk-lease.test.ts`: 6 files, 27 tests passed.
- Drive `c8d-markets.ts` on the sandbox: basket 3/3, valuation 2/2, venue-mode 6/6, products 4/4, knockout 1/1 (second run), strategies 4/5 then mirror 2/2, private 6/6, earn 5/5, rest 1/1.
- Phone: `pnpm --filter @agari/mobile typecheck` clean; `expo export --platform ios` (nvm 25.9.0) exported one iOS bundle (14 MB Hermes) after the phone changes. Native routes typechecked and exported: `/agents`, `/earn`, `/parlay`, `/short`, `/strategies`, `/games/range`, `/games/moonshot`, `/desk`, `/desk/new`, `/desk/[id]`, `/desk/[id]/record`, `/desk/[id]/decision/[seq]`, `/baskets`, `/tickers/[symbol]`. Not run on a simulator.
- `21st review` on the changed UI files: 0 errors, 0 warnings; 3 informational "hardcoded colour" notes, one a false positive on a component id in a comment (`#29532`) and two on lines this lane did not touch. Nothing to fix.
- UX: the new states reuse the reference kit (the shell's `capability-pending` block, the profile bar's `prf-stats`, the private list's `pc-*` rows, the vault controls), so no 21st component was pulled. Fixtures: `/dev/pyth-index` (both valuation states), `/dev/private` (Canton list and route states), `/dev/states` (the venue-mode paused card).
- No Daml changed; no DAR built.

## Gaps (named, not hidden)

1. **Valuation lanes are not listed**: no Pyth key entitled to `pyth-indices` exists (403 on 30 Sep and 6 Oct). The lanes, their hub and their preview say so; they list on their own once a key answers 200 and `bootstrap … --lanes valuation` registers them.
2. **A settled private call's payout sits in the seat's balance until Cash out**: the released engine settles every user leg into the `payout` bucket. Cash out moves it home once; an automatic cash-out by ops is possible on the same route but is not wired.
3. **The ledger twins wait for a later DAR**: the dependents count is the projection's (K-263) and the venue mode's record is the audit log (K-264).
4. **The phone** was typechecked and exported for iOS, not run (`/baskets`, the ticker hub's valuation state, the private panel and list, the agents board).

## Decisions

### K-260 — A valuation lane that is not entitled is unlisted, and every surface says why (C8d)
- **Date / owner:** 2026-10-06 · Claude (lane C8d).
- **Evidence:** §2; ops' probe `OPENAI denied (403 pyth-indices)`; `web/src/features/ticker-hub/index-state.ts`, `ValuationHub.tsx`, `next-window.ts` (`pausedInLane`); tests `index-state.test.ts`, `next-window.test.ts`.
- **Rule:** D-125 ("no dead lane is ever shown") holds and its absence is explained: the valuation hub renders the D-015 block naming the gate (a Pyth key entitled to `pyth-indices`) and the probe's own answer; the pre-IPO bar says in one caption why the Pyth rows are absent; a valuation lane paused for its entitlement is never drawn as a paused card.
- **User-visible:** `/tickers/OPENAIV|ANTHROPICV` "… is not listed" with the reason and a link to the token; one caption on `/tickers/OPENAI|ANTHROPIC`.
- **Approval:** default; overrulable.

### K-261 — A 24/7 name's link preview shows its live print, a basket in points (C8d)
- **Date / owner:** 2026-10-06 · Claude (lane C8d).
- **Evidence:** `web/src/features/landing/og/ticker-live.ts`; `ux/c8d/og-*.png`.
- **Rule:** crypto, pre-IPO, basket and valuation tickers have no NYSE close, so their OG card reads ops' `/prices/latest` (a basket in points, D-124) and a valuation lane reads the entitlement probe first ("Not listed" with why). Stock captions say "attested by three oracle parties", never "signed by Agari".
- **User-visible:** shared `/tickers/<SYM>` links.
- **Approval:** default; overrulable.

### K-262 — The leverage keeper watches; the ticket desk's keeper writes (C8d)
- **Date / owner:** 2026-10-06 · Claude (lane C8d).
- **Evidence:** §4; `services/ops/src/actors/leverage-keeper/{index,book}.ts`, `book.test.ts`; knock-out update `1220054965…686f`.
- **Rule:** `Boost_KnockOut` and `Boost_Settle` are venue-controlled and lease from the venue's shard pool, so one writer posts them: the ticket desk's keeper (`ticket-desk/keeper.ts`). `leverage-keeper` (C-OPS-09) reads the Boost book as the venue each 20 s, marks every position against the newest quorum print with the ledger's own rule and reports; it sends nothing. The Solana keeper (its own key over the adapter) is removed.
- **User-visible:** nothing directly; `/health` carries the book line.
- **Approval:** default; overrulable.

### K-263 — Product dependents are counted in the projection; the ledger counter waits for a later DAR (C8d)
- **Date / owner:** 2026-10-06 · Claude (lane C8d).
- **Evidence:** §4; `idx_dependents`, `decode-dependents.ts` (+ test), `read-dependents.ts`, `oracle-feeder.ts` (retire), `settler/index.ts`.
- **Rule:** per the plan ("Settlement checks a dependents count in the projection, not on the ledger"): RangeRound, each undecided ParlayTicket leg and BoostPosition pin their Window's terms in `idx_dependents`; `MarketTerms` are never archived; the oracle feeders keep every quote inside the life of a Window an open product depends on (a projection they cannot read retires nothing that pass); the settler names Windows still pinned. A ledger-side counter on `MarketTerms` is not part of R1 and would change `abu-pm-main`; it is left to a later DAR release if wanted.
- **User-visible:** none.
- **Approval:** default; overrulable.

### K-264 — The venue mode is issuer policy in ops with an audit log; the venue-signed contract waits (C8d)
- **Date / owner:** 2026-10-06 · Claude (lane C8d).
- **Evidence:** §3; `packages/core/src/market/venue-mode.ts` (+ test), `services/ops/src/runtime/venue-mode.ts`, `venue/mode-route.ts`, `venue_mode_log`.
- **Rule:** `open | reduce-only | paused`, set only through `POST /internal/admin/venue-mode` (`OPS_ADMIN_SECRET`), recorded in `venue_mode_log` before it applies, read back at boot. New positions (quotes, resting offers, range/parlay/boost issue, a duel's open), new supply and new Windows ask it; exits, claims, stale refunds, withdrawals and settlement never do. The plan's optional venue-signed `VenueMode` contract is not in R1 (abu-pm-governance's `VenueMode` is governance-signed and LocalNet-only), so the audit log is the record until a later DAR.
- **User-visible:** the refusal's words on a ticket; "Paused: venue reduce-only" cards; a `/status` row.
- **Approval:** default; overrulable.

### K-265 — A copier follows only what the trader published (C8d)
- **Date / owner:** 2026-10-06 · Claude (lane C8d).
- **Evidence:** §5; `mirror-scan.ts`, `listPublishedFills`, `mirror-scan.test.ts`.
- **Rule:** A-3b reads the trader's opt-in publications (`published/<address>/fills`); a seat's own fills are private to its lease. A trader who publishes nothing cannot be copied, and the runner says so ("has published no side").
- **User-visible:** the studio's existing words ("their published calls are public") are now what happens.
- **Approval:** default; overrulable.

### K-266 — Private mode on Canton is the seat's private bucket, moved by the seat and the venue together (C8d)
- **Date / owner:** 2026-10-06 · Claude (lane C8d).
- **Evidence:** §6; `packages/core/src/private/canton.ts`, `services/ops/src/actors/venue/private-route.ts`, `web/src/features/private/canton.server.ts`, `private-bucket.test.ts`; drive `--only private` 6/6.
- **Rule:** private balance = `VenueCash` with `bucket = private`, never spendable by a public call, ticket, grant or desk, swept with the rest when a seat is recycled. Moving in or out is one transaction signed by the seat and the venue (`VenueCash_Withdraw` of exactly the amount + `VenueAccount_Credit` into the other bucket), so the released engine needs no change. A private call is the seat's own firm quote accepted with exactly-split private cash and `beneficiaryRef = "private"`: out of public positions, exits and publications (its receipt too), still claimable and refundable by its owner. Cash out moves the payout home and dismisses the receipt in one transaction, once. 1–50 credits a call. The reference's desk key, allowance, claim signatures and backup file have no Canton meaning and are removed; the ticket keeps the owner's signed authorisation, whose hash is the command id.
- **User-visible:** the Portfolio Private panel (Deposit, Withdraw, the private list with Cash out) and the ticket's Private route, web and phone.
- **Approval:** default; overrulable.

### K-267 — The judges' shared desk is a practice desk named by `NEXT_PUBLIC_SHARED_DESK_ID` (C8d)
- **Date / owner:** 2026-10-06 · Claude (lane C8d).
- **Evidence:** §8; `DeskEntry.tsx`.
- **Rule:** the hosted deploy creates one practice desk from a seat, turns Share on and sets `NEXT_PUBLIC_SHARED_DESK_ID` to its id; visitors with no seat see it on `/desk` and its read-only page, never its notes.
- **User-visible:** "A SHARED DESK" on `/desk`.
- **Approval:** default; overrulable.

### K-268 — The idle-yield note says demo credits earn nothing (C8d)
- **Date / owner:** 2026-10-06 · Claude (lane C8d).
- **Evidence:** `web/src/features/vault/copy.ts`.
- **Rule:** A-2a's note names demo credits and this Canton venue: nothing pays interest on idle demo credits; what pays is supplying a reserve, shown as its realised share price.
- **User-visible:** the Trading Balance's idle note, web and phone.
- **Approval:** default; overrulable.
