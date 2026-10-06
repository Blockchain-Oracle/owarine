# C9e and C13b: games and the social surfaces, end to end on a local sandbox (evidence)

Date: 2026-10-06 · lanes C9e (games) and C13b (social and assistant) · branch `slice/C9e-games-social` from main `04bb930` · decisions K-290 to K-297

## Local stack

- **Sandbox.** `dpm sandbox` (Canton 3.5.17), `JAVA_OPTS=-Xmx1536m`, ledger :7700, admin :7701, sequencer :7702/:7703, **JSON API :7704**, mediator :7705.
- **Bootstrap.** `bootstrap-local.ts --seats 6 --lanes crypto --join-sec 120 --reveal-sec 60 --pick-sec 480 --season-days 0.1`, with the R1 DARs from `daml/released/` (`--dar`, `--tickets-dar`, `--agents-dar`, `--games-dar`). Every write landed: 12 BTC/ETH Series, the reserves, the maker vault, `ArenaTerms arena-1` (policy 6) and `SeasonPool s1` funded with 500 credits, ending 10:13:39Z. No Daml was changed.
- **Ops.** The real `services/ops/src/main.ts` with `OPS_ACTORS=all` (the x-relay and strategy runner included), `ROLLER_SERIES=BTC-1m,ETH-1m,BTC-15m,ETH-15m`, :8770, room :8777, projector on Postgres `pm_c9e`. Alpaca, Finnhub, Pyth and OpenAI keys were read from the main checkout's `services/ops/.env.local` into the process environment only; nothing was copied.
- **Web.** `next build` + `next start -p 3170`, Postgres `pm_c9e`, `SEASON_ID=s1` to match the pool. It was rebuilt once (after C9e.4) so every fix below ran live.
- **Browser.** Headless Chrome over playwright-core from the scratchpad, plus the app's own Browser pane for the first seat.

## 1. Money shown to users (C9e.1, C9e.4, C9e.5, C13b.3)

**The rule.** `PM.Leg.legPayout` decides the payout:
- a win pays the quantity;
- a loss pays nothing;
- a void returns `backingShare + feePaid`.

The fee is charged with the stake at the fill and held in the leg. The venue keeps it only at a non-void settle, so nothing is taken at settlement.

**What the web and phone did.** They carried the reference engine's rule, under which a void paid half a contract per leg, and copy that described a settlement fee.

**What the local ledger paid, read from the projection (`idx_legs`, `idx_receipts`):**

| Seat | Window | Call | Backing + fee | Result | Paid | Fee kept | Update |
|---|---|---|---|---|---|---|---|
| seat-1 (`JDac…mmct`) | ETH-15m:1 | UP | 691000 + 2136 | won | 1000000 | 2136 | accept `12200b6c…2f21`, settle `1220932e…8c38` |
| seat-4 (`FmskH6…YWzr`) | ETH-15m:2 | UP | 708000 + 2068 | **void** (`MissingPrint(CloseSlot)`) | **710068** | 0 | accept `1220a417…d997`, settle `122022b4…3c30` |
| seat-4 | BTC-1m | UP | 859000 + 1212 | won | 1000000 | 1212 | accept `1220911d…4863`, settle `122062e8…3629` |
| seat-4 | ETH-15m:3 | DOWN, published | 538000 + 2486 | lost | 0 | 2486 | accept `12209c67…770a` |

**How the void was made.** Ops (pid 11653) was frozen with SIGSTOP from 08:29:50 to 08:31:05Z, across the 08:30 close, the way the C2z rehearsal froze it. On waking, the feeders gave up and the resolver voided the Window. Under the old rule the screen would have shown 500000 for the void.

**What the screens show now:**
- **Void verdict** (`ux/c9e/verdict-void-*`):
  - payout 0.71, P&L 0.00, "Stake 0.71 · Returned 0.71";
  - paid automatically by `122022…3c30`;
  - the live region announces "Returned 0.71 credits".
- **Win verdict** (`verdict-win-*`): stake 0.86, payout 1.00, profit +0.13 (+16%).
- **The Call** (placed live): "0.69 → 1.00 · credits · paid in full · fee included in the stake".
- **Activity** (`activity-*`):
  - "BTC 1m · Up filled · 0.86" (fee included);
  - "Won +0.13";
  - "ETH 15m · Voided · 0.71 credits back".
- **Trader Edge** (`edge-*`):
  - net +0.13;
  - settled stake 1.57 (0.860212 + 0.710068);
  - +8.9% on settled stake;
  - a fee row "Fees kept by the venue".
- **History** and **profile record** (`portfolio-*`, `profile-own-*`): +0.13 over 2 settled.

**Found broken and fixed during the drive (C9e.4).** The first live verdicts read:
- the win as "Stake 0.14, P&L +0.85, +609%";
- the void as "payout 0.00, P&L −0.29".

`walletFills` labelled each own fill's taker `COALESCE(owner_address, owner_party)`. The projector writes no `owner_address` for a leased party, so the replay booked every guest seat's buy as the venue's complement (1 − price). This had affected every guest seat's history, Edge, CSV, badges and verdict cost basis since the C13a lease scoping. The fix: own rows name the wallet as taker. `read-lease.test.ts` (Postgres) fails without the change.

**Tests:**
- `packages/core/src/claims/payout.test.ts` and `verdict.test.ts`;
- `projection/settle-canton.test.ts` (fee paid in, void returns backing plus fee, a sale split by `BuyQuote_Accept`'s ceilings);
- `receipts.test.ts` (receipts covering every held leg win);
- `web/src/features/activity/items.test.ts`;
- `markets/verdict/void-paid.test.ts`;
- `vault/history.test.ts`.

## 2. Games (C9e)

- **Duel through the real stack** (`drive/games-duel-it.ts`, tier t1). Match `0xc1c5c865…08a9b0fd`, dealt ETH-15m:1 and BTC-15m:1. Every duel check passed, and the duel was decisive:
  - **PnL.** Creator +0.644621, challenger −1.461226, with both pots to the creator.
  - **Cash.** 1001644621 / 997538774.
  - **Ladder.** 1024 / 976.
  - **Update ids.** `Arena_OpenDuel` `122011d3…d5b0`, `Open_Join` `12205848…5d38`, `Duel_Reveal` `12200bec…b8b2`, four `Duel_RecordPick`, `Duel_Score` `12200310…e222`, `Duel_Finalize` `12203acd…d07e`.
- **Season step (found broken, fixed in C9e.3).** The drive signed the admin's acts with `OPS_INTERNAL_SECRET`, which ops has refused since C4d L4. Its "second payout refused" check passed on that unrelated refusal. The same acts through `scripts/season-admin.ts` on the drive's funded pool:
  - paid 2 winners: `12206546…09efb`;
  - a second payout was refused `abu-pm/already-distributed`;
  - the remainder was withdrawn: `1220f767…2fbd65`;
  - a second withdraw was refused (no live pool);
  - the headless seat's balance rose by its 30-credit prize.
- **Rank** (`games-rank-*`):
  - the drive's winner is #1 (1024, 40-credit prize) and the loser #2 (976);
  - the pool row reads "escrowed on the ledger: 500 credits";
  - the countdown follows the pool's own end (C9e.6).
- **Found broken and fixed (C9e.2).** While the season read was loading, and on a failed read, the ladder and the hub said "There is no season and no prize here". `useSeasonRead` now separates loading, unread (retried), none, escrowed and not-escrowed (`season-intro.test.ts`).
- **Practice** (`games-practice-*`, `games-practice-result-1440-dark`):
  - it dealt BTC and ETH 15m cards;
  - a full round was swiped and scored on the live feed: ETH flat, BTC +0.007%, "Level";
  - its closed-market plate now names every 24/7 lane.
- **Line Rider and Candle Hop** (`games-line-rider-*`, `games-candle-hop-*`). A seated run of each was replayed by the server and recorded: Line Rider 347 for `JDac…mmct`, then Candle Hop.
- **Achievements** (`/api/games/achievements?wallet=`, from the projection):
  - the winner earned 5: first duel, win, staked win, rated, climber;
  - the loser earned 2;
  - the arcade seat earned 2: arcade debut, both games.
- **Games history** (`games-history-*`). It is seat-only (`/api/games/history` answers 403 for anyone else). The headless seat has no duels and no spins, and the page says so.
- **Settings.** These are per device, as the reference keeps them.
- **Lucky and duel UX.** Not redone (C9b, C9c, C9d).

## 3. Social and assistant (C13b)

- **News** (`news-*`, `dev-news-*`).
  - Live: 8 Finnhub headlines, TSLA company news, and BTC headlines tagged $BTC.
  - Found broken and fixed (C13b.1): a missing key, and a Finnhub failure, both read "The wire is quiet". They now say what they are.
- **Ticker rooms and cashtag takes** (`ticker-btc-*`, `ticker-eth-*`).
  - A seat-signed take posted (200, tag `ETH`, `backed: false` as of posting, the reference's rule), and the $ETH room's feed carries it.
  - The seat then published a DOWN call (`Leg_Publish`). The room's feed shows the fill at 0.540486, fee included.
  - Found broken and fixed (C13b.5): BTC's room read "STOCK", promised a report date and read Finnhub earnings for a coin.
- **Sentiment.** One publisher, below k = 5: withheld (`upBps: null`).
- **Price alerts.** Found broken and fixed (C13b.4): a BTC or ETH alert was saved as a Regular (NYSE) rule and evaluated only in session. It now uses the 24/7 basis around the clock (`basis.test.ts`). Firing itself was not observed: it needs a crossing while a tab is open.
- **Sensei.** The web route answers with the honest state: "Sensei's openai credential was rejected. That's a configuration problem, not you." The key in ops' env answers 401 at OpenAI (status only checked; the key was not printed). The Brake is prompt-based and covered by `brake.test.ts`.
- **Trade from X, claim, relay** (`trade-from-x-*`, `claim-*`, `dev-x-*`). This deployment has no X app keys and no `X_RETTIWT_API_KEY` or `X_HANDLE`. Found and fixed (C13b.2):
  - the pages read "X sign-in is not switched on here: it waits on the server's X app keys", and a failed status read is no longer called "not configured";
  - `/api/x/status` and `/api/x/start` no longer throw bodiless 500s;
  - the builder offers BTC and ETH;
  - the proof line names `Test.Grant.testGrantAuthority`;
  - the relay's three stages read "Disabled" (ops log: "not configured — set X_RETTIWT_API_KEY, X_HANDLE").
  - Placement through `AgentGrant` was proven by C8f.
- **Activity** (`activity-*`). Fills, verdicts and automatic payouts for the seat, read by lease.
- **Reels** (`reels-*`). Live 1m and 15m rounds. The take composer posted from it.

## 4. C5 surfaces on the same data

- **`/api/proof/pyth` (re-verify).** The win's Window passes 23/23 checks: medians, spreads, each oracle's payload hash, outcome. The void's passes 12/12: "void: MissingPrint (close)". `proof-void-*`.
- **Share cards** (`dev-share-*`). The Call shows "paid in full · fee included in the stake".
- **Trader Edge, reputation, badges, CSV, leaderboard, profile** (`edge-*`, `portfolio-*`, `leaderboard-*`, `profile-own-*`). The figures are as in §1. The tier and badges come from the corrected rounds.

## Captures and gates

- **Captures.** `docs/evidence/ux/c9e/` holds 97 JPEGs: the Practice result at 1440 dark, and 96 showing every changed web route at 390 and 1440 in light and dark, full page:
  - games: hub, rank, history, practice, line rider, candle hop;
  - social: news, both ticker rooms, activity, trade-from-x, claim, reels, leaderboard;
  - money: edge, portfolio, own profile, both live verdicts, the void's proof page;
  - fixtures: `/dev/news`, `/dev/x`, `/dev/claims`, `/dev/share`.

  All 96 have `scrollWidth − innerWidth = 0` and no console errors.
- **Fast gate.** `pnpm typecheck` (all projects) green; `pnpm invariants` 0 errors, 0 warnings.
- **Vitest.**
  - Whole suite with `SEAT_PG_URL`: 336 files passed and 2 failed. The 11 failed tests are all in the Postgres `seat-store` and `seat-link-store` suites, which share one scratch database in parallel. Both pass alone on a fresh database (17/17). This lane did not touch them.
  - `read-lease.test.ts` on Postgres: 8/8.
- **Phone.** `pnpm --filter @agari/mobile typecheck` green. `expo export --platform ios` (Node 25.9.0) bundled 5,575 modules into a 14 MB Hermes bundle. The phone was not run on a simulator.

## Decisions

### K-290 — Every displayed payout follows `PM.Leg.legPayout`
- **Date/owner:** 2026-10-06, C9e.
- **Evidence:** `daml/abu-pm-main/daml/PM/Leg.daml` (`legPayout`, `Leg_RefundStale`), `PM/Quote.daml` (`BuyQuote_Accept`). The local run is in §1: a void of 710068 = 708000 + 2068, and wins of 1000000 with the fee kept.
- **Rule:**
  - a win pays the quantity, a loss nothing, and a void the leg's backing plus fee;
  - the fee is part of what was paid in at the fill and is never described as a settlement fee;
  - core's half-contract void is removed: `legPayoutBase`, `winPayoutBase`, and per-side cost tracked in the replay ledger, split on a sale as the ledger splits it.
- **User-visible:** a void returns "stake and fee", with P&L 0; a win is "paid in full · fee included in the stake"; Edge shows "Fees kept by the venue".
- **Approval:** default; overrulable.

### K-291 — A void verdict is priced from the ledger's own legs, and the first verdict is final
- **Date/owner:** 2026-10-06, C9e.
- **Evidence:** the live run in §1; the announce-once live region.
- **Rule:** a void's per-side refund comes from the seat's claimable legs, then from the settled round. With neither, the verdict waits rather than guessing. The verdict is derived only after the positions and, once the legs are gone, the history have answered.
- **User-visible:** the void verdict and its announcement name the refund; the win is never announced as "+payout".
- **Approval:** default; overrulable.

### K-292 — A seat's own fills name the wallet as their taker
- **Date/owner:** 2026-10-06, C9e.
- **Evidence:** §1, "Found broken".
- **Rule:** `walletFills` returns only the seat's rows (by address, or its leased party from the lease's start), so `taker` is the wallet asked for.
- **User-visible:** a guest seat's history, Edge, CSV, badges and verdict read the side it bought.
- **Approval:** default; overrulable.

### K-293 — A missing key is named in words, and a failed read is not "not configured"
- **Date/owner:** 2026-10-06, C13b.
- **Evidence:** `LinkStep.test.ts` (the reference forbids variable names on screen); working-rules "Honest state" (name the gate).
- **Rule:** X sign-in and the news wire name their gate in words ("the server's X app keys", "a Finnhub key"), never a variable name. A status read that failed says it could not be read, and is retried.
- **User-visible:** `/trade-from-x`, `/claim`, `/news`, ticker headlines.
- **Approval:** default; overrulable.

### K-294 — A 24/7-only name's alert watches the 24/7 price at any hour
- **Date/owner:** 2026-10-06, C13b.
- **Evidence:** BTC and ETH list only on the 24/7 lane (C6). The watcher's Regular gate kept their alerts asleep outside NYSE hours.
- **Rule:** crypto, pre-IPO and basket names save on the 24/7 basis and are evaluated on a fresh tick (60 s) at any hour. A stock's 24/7 token basis stays as it was ("Arrives with the 24/7 token lane").
- **User-visible:** the alert popover shows 24/7 selected for BTC and ETH and never says it waits for the open.
- **Approval:** default; overrulable.

### K-295 — The X builder offers BTC and ETH, and an unconfigured relay reads Disabled
- **Date/owner:** 2026-10-06, C13b.
- **Evidence:** `packages/core/src/x/parse.ts` accepts BTC and ETH (C13a). The relay wrote no health without its keys.
- **Rule:** `X_BUILDER_ASSETS` is the launch stocks plus BTC and ETH. With a store, the unconfigured relay marks all three stages "disabled" each heartbeat.
- **User-visible:** `/trade-from-x` builder and relay status line.
- **Approval:** default; overrulable.

### K-296 — Season prizes reach a winner's live seat only; a claimable prize waits for a DAR release
- **Date/owner:** 2026-10-06, C9e.
- **Evidence:** `services/ops/src/actors/arena-desk/seats.ts` (`partyOf` answers the live lease only). The duel drive's winners, whose seats it released, could not be paid. R1 is frozen (no Daml change in this lane).
- **Rule:** for R1 the admin distributes while the ranked winners hold seats, and a winner without one is refused by ops (never paid to a recycled party). A later DAR release adds a claimable prize: for example `Season_Distribute` into per-winner prize contracts that the winner's next seat, proved by a signed key, claims.
- **User-visible:** the prize note says "to the seat you hold at that moment" (C9e.7).
- **Approval:** default; overrulable.

### K-297 — The season countdown follows the pool on the ledger
- **Date/owner:** 2026-10-06, C9e.
- **Evidence:** `SeasonPool.endsAtSec`; `Season_Distribute` refuses before it.
- **Rule:** when the pool is read, its end is shown; `SEASON_ENDS_AT` is the fallback.
- **User-visible:** the ladder's and hub's countdown.
- **Approval:** default; overrulable.

## What still does not work here, and why

- **Sensei answers nothing locally.** The configured OpenAI key is rejected (401). The route says so honestly. It needs a valid model key.
- **X sign-in, trade from X and the relay's mention loop are not driven.** There are no X app keys and no `X_RETTIWT_API_KEY` or `X_HANDLE` on this host. The pages and the relay state that.
- **A price alert firing was not observed.** That needs a crossing while a tab is open; the rule change is unit-tested.
- **A winner who has left their seat cannot be paid** (K-296, a DAR release item).
- **Found outside this lane.** On `/markets` the ETH hero chart kept BTC's opening print (85,772.70, axis to 100,000) after switching cards. It was flagged as a separate task.

## Commits

| Commit | Step |
|---|---|
| `e186d16` | C9e.1 money: wins, voids and fees as the Daml pays them |
| `ad1c455` | C9e.2 games: honest season read states; Practice names every 24/7 lane |
| `f0be763` | C13b.1 news: no key and a provider failure said as such |
| `746ba91` | C13b.2 X: gate in words, unreadable status, start/status bodies, BTC/ETH in the builder, relay Disabled |
| `0e61695` | C13b.3 activity: fill amount includes the fee; one contract singular |
| `12f91c3` | C9e.3 drive: season acts signed with `OPS_ADMIN_SECRET` |
| `abe0efb` | C9e.4 history: own fills replay on the side bought |
| `3357a7c` | C9e.5 verdict: first figures final; void announces the refund |
| `0d8e29c` | C13b.4 alerts: 24/7 names fire around the clock |
| `18bbb89` | C13b.5 ticker room: a coin is Crypto, with no report date |
| `56a8aec` | C9e.6 season: countdown from the pool's own end |
| `e090f96` | C9e.7 season: the prize goes to the seat held at payout |

No owner-only file was touched.

## Cleanup

Everything this lane started was stopped by pid:
- web (`next start`);
- ops (`main.ts` and its wrappers);
- the duel drive;
- the sandbox (the `dpm` wrapper and its JVM).

`pm_c9e`, `pm_c9e_t` and `pm_c9e_t2` were dropped. `web/.next` was moved to the Trash. The scratchpad keeps the logs, the parties file and the throwaway local secrets, and is deleted with the session.
