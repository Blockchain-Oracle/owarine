# C8e tickets through the screens, 2026-09-29 (local sandbox)

## Setup

**Sandbox.** A Canton sandbox 3.5.17 (dpm 3.5.10 assembly), with the JSON API on :7555. It loaded:
- `abu-pm-main-0.4.0.dar`;
- **`abu-pm-tickets-0.1.2.dar`** (this lane, K-093);
- `abu-pm-games-0.1.0.dar` (after the main merge).

**Database.** Postgres `pm_c8e`, dropped after the run.

**Bootstrap.** `scripts/bootstrap-local.ts --seats 6 --users alice,bob,outsider`, with a lane-local parties file in the scratchpad (never the shared `~/.config` one). It created:
- 73 Series and 16 venue shards;
- the Earn desk;
- three ticket reserves, each seeded by the LP with 10,000 credits.

**Ops.** The real `services/ops/src/main.ts`, with default actors, `DRY_RUN=0`, HTTP on :8757. It was restarted with each ops fix below.

**Web.** `next build --webpack` plus `next start` on :3150. `next dev` could not serve this pass. With the host's load between 25 and 118 on 10 cores, it compiled each route in 1.5–5 minutes and evicted idle routes.

The first builds after main's C8f merge failed on a desk import (`node:crypto` in a client bundle). Until main's fix (96caadf) landed, one build ran with a local, uncommitted webpack fallback. The final build is the lane tree unmodified and is green.

**Browser.** Headless Chrome with its own profile on :9334, driven over the DevTools protocol (puppeteer-core). The chrome-devtools MCP could not be used because another session held its profile.

**Keys.** None set: no Alpaca, Pyth or Finnhub.

**Seat.** Taken through the UI: "Take a seat" → "Guest Seat" leased `4Efb…xjvg`, and the "You're funded" card showed 1,000.00 credits.

## Tickets placed through the screens

Every write below is the seat's own accept, journaled in `seat_commands` and landed:

| screen | ticket | update |
|---|---|---|
| `/games/range` | BTC 15m, inside $82,925–$83,035, 4.95 → 22.30 | `1220ccf83f44fed22f5bd2864b6a9de144a159c43e3d4272678dd49838d65a59ae8b` |
| `/games/moonshot` | BTC 1h, long ×5 above $83,290, 4.97 → 25.00 | `1220039181ed2ff41d10483176b2c66d1a799fdce60d30cce8b27d52d068b2d0f9c3` |
| `/parlay` | BTC 15m Up + ETH 15m Up, 0.88 → 8.56 (9.7×) | `12206e4196b4f4de0302bfdecb6328958b8403226b842f9469c67b007b37a26ea097` |
| `/markets` ticket | BTC 15m Up 2× boost, stake 39.67 | `122098ff93d497c61210b2a60d5d69aa8c8c1d2a24dc8cb4503be597de788f714813` |
| `/short` | ETH 15m 2× short, 9.94 | `1220423d6f51d79afb9d12b405b9794b308b44d972e98ffd0841af313b6106a6c835` |
| `/short` | ETH 15m 2× short, 9.88 | `12209cf834bc267b576acf5d4d7921698e817b2e685708d704565da283e67cca0af2` |
| `/short` **Close** | cash-out of the second short: 7.50 back (a `BoostExit_Accept`, receipt `sold`) | `12206d241515cc1b9469b2a50b17915d9c042861697327a2c9d5a4e3732280f120fc` |
| `/earn` range tab | supply 50: 49.95 shares at 1.0009 | `12209a24399dc2755008717ad3e82d919b4631de4f53a936cf914fb1bba41890fd7b` |
| `/earn` range tab | withdraw all: 49.95 shares → 49.999999 | `12205cd3943898e563d838443623e35e3ac8311708623f49d350765b7acfe5d33b5a` |

## Settlement, and history from receipts

The keeper settled every ticket against its Window's Resolution. The owner claims nothing: the payout lands on settle. Each ticket's contract was then archived, and each one stayed on its screen through its `SettlementReceipt` (K-093):

- **Range:** "Missed · closed at $83,156.50 · outside the band".
- **Moonshot:** "Missed · closed at $83,048.04 · short of the target".
- **Parlay:** "Dead", with BTC's leg missed.
- **Short list:** the boost reads "Won 47.32 back", the first short "Lost", and the cashed-out short "Closed 7.50 back". The last comes from the 0.1.2 `sold` receipt, live.

In the portfolio, History counts 6:
- the range, moonshot and parlay receipts, as C6d's rounds;
- the three boosts once each, under "Boosts, settled" (C8e.4 removes the double count).

A knock-out and the stale refunds were not triggered live. Their receipts are proven by `Test.Tickets.ExitReceipts`.

## Bugs found through the screens, and fixed

- **C8e.5, moonshot.** Every long rung answered "Something went sideways" when the venue's price sat near an end. `solveStrike` nudged an E8 strike one unit at a time. It now widens outward, then bisects. The reference has the same core.
- **C8e.6, ops and seat.** Canton 3.5's `UNKNOWN_CONTRACT_SYNCHRONIZERS` ("have been archived") was not read as an inactive contract. As a result:
  - dead shards went back to their pools;
  - the ticket desk's stale-id retry never ran (its check also read a log line cut at 240 characters);
  - an expired quote's accept read `contract-revert`.

  Seen placing a parlay.
- **C8e.8, boost and short.** "Cash out" / "Close" could never fill. The mark was the ladder's fair mid, and the row's 97% floor sat above the venue's bid, which is 30 ticks under fair. The ticket now marks at the venue's bids, as the reference marks over the exit side. The close above filled on the first tap.
- **C8e.7 and C8e.9, copy:**
  - the boost ticket said "the rest stays in your wallet";
  - Earn said "refused by the program";
  - the maker plate waited on "the maker vault program (planned after the hackathon deadline)".
- **C8e.4, portfolio.** The C6d merge would have listed each boost twice in History.

## Seen, not changed

- **Refusals near a Window's close.** Range refused "The book is too thin" 4 minutes before close with the venue at 2%. The reserve prices centres from 3% to 97%, as the reference does.
- **Requotes on fast books.** Parlay and boost answered "The book moved" once each on a moving book. That is the reference's requote.
- **The 10 s web → ops timeout under load.** Twice (a parlay and an Earn withdraw) ops took longer than 10 s at a load of about 110. The web gave up while ops issued, and the orphaned quote was expired by the keeper. The retry succeeded. This is load, not logic.
- **Parlay leg display.** A dead parlay's undecided leg reads "Settling…" after its expiry, as the reference's card does for a pending leg.
- **Portfolio figure.** The "Open positions" figure does not count boosts, as in the reference.

## Screenshots (`ux/c8e/`, 390 and 1440, dark and light)

**Ours:**
- `01-range-in-play`, `02-range-settled-receipt`;
- `03-moonshot-in-play`, `11-moonshot-missed-receipt`;
- `04-parlay-in-play`, `10-parlay-dead-receipt`;
- `05-boost-placed-1440-dark` (the placed call card is transient, so one frame);
- `06-portfolio-open-boost`, `13-portfolio-history-receipts`;
- `07-short-open`, `12-short-closed-receipt`;
- `08-earn-supplied`, `09-earn-withdrawn-1440-dark`.

**Reference.** Its own production build (27 Sep, at `661a24ee`) ran unmodified from a scratchpad copy of its `.next` via `next start` on :3160, and its tree stayed clean.
- Its live screens need a Solana wallet to price anything, so they show the connect state (and "The indexer isn't answering"). Files: `ref/ref-{range,moonshot,parlay,short,earn,portfolio}-*`.
- Its fixture pages show the filled ticket states. Files: `ref/ref-dev-{range,parlay,leverage,earn}-*`.

The ticket screens' components are the reference's own (the diff is the seat wording). The screens match it in layout and states.

## Maker vault

It is not wired. K-092 records what `abu-pm-main` lacks and the 0.5.0 design. The tab shows the reference's not-deployed plate, now naming the maker reserve.

## Gates (final tree)

- **Daml:** `dpm test` passes 175 scripts; one random-sequence script hit the script service's deadline under load and passed on rerun.
- **Upgrade check:** `dpm upgrade-check --both` 0.1.1 → 0.1.2 passes, with no warnings.
- **TypeScript:** `pnpm typecheck` is green; `pnpm invariants` has 0 errors (1 warning, in C8f's `desk/canton.ts`).
- **Tests:** `pnpm test` ran 2,012 passed and 5 failed. The five were load timeouts in `x-relay/reply-card.test.ts` and `api/venue/routes.test.ts`, and both files pass alone (16/16).
- **Web build:** `pnpm --filter web build` (`next build --webpack`) is green.
