# C7c pre-open resting call, 2026-09-30 (local sandbox)

K-235 to K-237: a call rests on a listed Window at the seat's own price, the stake is held inside a bilateral `RestingCall`, the venue fills it at exactly that price after the bell when its own price reaches it, and an unfilled or cancelled call returns the stake as venue credit. The reference's "Schedule a call", on web and phone. Nothing here ran on a hosted network.

## What was built

| Layer | What | Where |
|---|---|---|
| Daml | `RestingDesk` → `RestingOffer` → `RestingCall` with `Rest_Cancel`, `Rest_Expire`, `Rest_Fill`; `abu-pm-main` 0.5.1, new templates and choices only | `daml/abu-pm-main/daml/PM/Resting.daml` |
| Ops | the `resting` actor: `POST /internal/resting-offers` (post-only check, sizing, 16 a seat), the fill rule, the sweeper | `services/ops/src/actors/resting-desk/` |
| Seat | `POST /api/ledger/resting`, `…/<cid>/place`, `…/cancel`; the submitter's `entry: "rest"` and `cancel-orders`; the phone's write proof | `web/src/app/api/ledger/resting/`, `packages/markets/src/submitter/rest-lane.ts`, `packages/markets/src/server/rest-writes.ts` |
| Projection | `idx_resting` (a row per call, kept when it ends), `idx_fills.resting`, `GET /api/index/wallet/<addr>/resting` | `packages/db/src/idx/apply-rest.ts`, `schema-index-0-5.ts` |
| App | the schedule ticket, receipt, cancel, portfolio rows and their ended states, on web and phone | `web/src/features/markets/ticket/`, `…/portfolio/RestingRows.tsx`, `mobile/src/features/portfolio/bets/RestingRow.tsx` |

## Gates

| Gate | Result |
|---|---|
| `dpm build --all` and `dpm test` in `daml/pm-tests` | 227 scripts ok, 0 failed (the 186 of R1 plus `Test.Resting`'s 22 and their helpers), 30 Sep 10:20 UTC. The four DARs it rebuilt are byte-identical to `daml/released/` |
| `Test.Resting` | 22 scripts: escrow held; cancel refunds at any time; fill at the call's price makes the same `Leg` pair as a normal accept (fee 0); partial fill keeps the remainder and re-fills; expiry refund; exactly once (filled, cancelled, expired); the venue cannot fill before the bell, past the expiry, for more lots than remain, from a shard that is not its own, or take the escrow; other seats and outsiders see nothing; conservation across endings |
| `dpm upgrade-check --both` | exit 0, 0 WARN or ERROR: main 0.4.0 → 0.5.1 with tickets, agents and games (33 succeeded lines), and main 0.5.0 → 0.5.1 (30). The output is in `daml/released/MANIFEST.md` |
| Unit tests | ops: the rule, the request parser, every offer refusal and the happy path, the pass (fill, partial fill, DOWN, sweeps, fill off, cancelled first: 25); the projector's decode of a place, a full and a partial fill, a cancel, an expiry (6); the seat writer (10); the client lane (8); the order view and the schedule button's ladder (6) |
| Postgres | `packages/db/src/idx/resting.test.ts`, 9 scripts (`SEAT_PG_URL=postgres://localhost/pm_c7c`) |
| Repo gates, on the tree merged with main (`ec7c271`) | `pnpm typecheck` 0 errors (10 workspace projects); `pnpm invariants` 0 errors, 0 warnings; `pnpm test` 309 files and 2,391 tests passed (13 files and 61 tests skipped: the Postgres ones without `SEAT_PG_URL`, run separately above); `pnpm --filter @agari/mobile typecheck` 0 errors. On the first run, before merging main, one test failed, `scripts/bootstrap/dar.test.ts`: it expected three packages after main and found `abu-pm-governance` too. It is not this lane's; main's fix came with the merge |

## The run

- **Sandbox.** Canton sandbox 3.5.17 (`dpm sandbox`), ports 7531–7536 (ledger API :7531, admin :7532, sequencer :7533/:7534, **JSON API :7535**, mediator :7536), started fresh.
- **DARs.** `abu-pm-main-0.5.1`, `abu-pm-tickets-0.1.3`, `abu-pm-agents-0.2.1`, `abu-pm-games-0.1.1` (the rebuilt R1 files), uploaded by `bootstrap-local.ts --seats 8 --users alice,bob --lanes crypto --no-maker`, with its own parties file.
- **Ops.** `scripts/drive/ops-local.ts`, `DRY_RUN=0`, HTTP :8737, the projector on Postgres `pm_c7c`. `MM_LEVEL_LOTS=3 MM_LADDER_LEVELS=1`: the venue's ladder is three lots deep, so a five-lot call has to fill in two steps. No Alpaca keys, so only the crypto lanes have a price.
- **Web.** `next build --webpack` and `next start -p 3130`.
- **Host.** Load average 20 to 170 on 10 cores throughout.

### `scripts/drive/resting-it.ts`, run 2: 24 of 24 checks

Two seats lease through `/api/seat`. On a listed BTC-1m Window (a 24/7 Window is listed 120 s ahead) alice rests **A**, UP at 60¢ for 5 lots, and **B**, UP at 1¢ for 4 lots; bob rests **C**, DOWN at 40¢ for 4 lots, and cancels it.

| Step | What the ledger and the web showed | Update |
|---|---|---|
| A placed | call `rc-f8e47a97…`, escrow 3.00 = 5 × 600 × cash unit 1,000, held in the call | `1220bde6221f887fcafcdd8c9c74071ff1ca730137e6b34fea14e24f6edec57d6535` |
| B placed | escrow 0.04 | `1220cc16508e55c15004fda1260676b761ce3ffd2746746d02262b12659cfefee83f` |
| C placed | escrow 1.60 | `122068ce37259e037d03c077dbbf5d24c9e91c4a147a486215c9ef68e64fd7295fbc` |
| Escrow is in the calls | alice's cash 1,000 → 996.96 (A 3.00 and B 0.04 held); the venue's ACS holds three `RestingCall` contracts | — |
| Other seats | bob's cancel of alice's call answers `gone`; bob reading alice's `/resting` rows answers 403; bob reads only his own row | — |
| C cancelled | 1.60 back, bob's cash 1,000 of 1,000 | `1220620d70a7bc8fbcc25544f7768ff48c786370b2aa7dccd6bb1b9c0e31b8f3ba0d` |
| After the bell | a new call on the started Window is refused: `market-not-trading`, "the Window has started: a call can only rest before the bell" | — |
| A filled | **3 lots at 600 ticks, then 2 lots at 600 ticks**, fee 0, both `resting = true` in the projection. Ops logged "3 of 5 lots cross at 600", then "2 of 2" | `12207bb6bcf65897cc7c8fe3df2fa71ca9a32727523a9f21cccbf7a30d6708bf362e`, `1220064431d30f64ed6201299b8d7be75e7161f7e8d772f79d7a451c5b2fcdb17b70` |
| The legs | alice holds 2 legs, 5 lots, backing 3.00 = 5 × 600 × 1,000, fee 0, Up. The venue holds the opposite side: 5 Down lots locked from its own shard | — |
| B unfilled | swept at its expiry (`Rest_Expire`, the Window's lock): status `expired`, **0.04 back as venue credit**, alice's cash 997.00 = 1,000 − A's 3.00 | `12205c769dccd74e072062daf7d22c655f37215ce56ac41493b3bda59e5287746635` |
| The rows | A `filled` with 0 remaining, B `expired` (refunded 0.04), C `cancelled` (refunded 1.60), read by alice over the web under her lease | — |
| Inbox | alice's `/api/activity` lists `resting-filled` once per fill | — |
| Settlement | the Window resolved, A's two legs settled Lost (payout 0): alice's cash 997.00 → 997.00 | `12202a9f3afc1f6b703d71e9dcd57b3b90d4cf9db6346fc70d3fcc06c46fb6f7ec7f` |
| Conservation | 1,000 − 3.00 + 0 = 997.00 = end | — |

The full output is `docs/evidence/probes/c7c-resting-it-run2.log`.

### Run 1: 20 of 24, and why

Run 1 (`docs/evidence/probes/c7c-resting-it-run1.log`) rested B at **20¢**. It failed four checks, and the cause was the drive's assumption, not the contract: BTC fell after the open, the venue's UP price fell to 20¢, and the venue filled B at 20¢ (3 lots, then 1) exactly as the fill rule says (the ops log reads "rest fill … up 3 of 4 lots @ 200 … 3 of 4 lots cross at 200"). B was then a filled call, so "B expires and refunds" could not hold, alice's legs and payout (`won`, 9 credits) covered B too, and the conservation line was computed without it. The projection's `filled` row for B, and the inbox's four `resting-filled` items (two calls, two fills each), agree with the ledger. Run 2 moved B to 1¢ (10 ticks, under any price the ladder can reach). Run 1 also settled `won`, so both outcomes of a resting call's leg were seen.

## The app

A guest seat took a call on a Regular Window listed before its bell, the way the reference does. The roller lists stock Windows only with a market calendar (Alpaca keys), so `scripts/drive/open-listed-window.ts` opened one, TSLA-5m, with `Series_OpenWindowSpan` as the venue. Screenshots are in `docs/evidence/ux/c7c/`, at 1440 and 390, dark and light.

| Shot | Real or fixture | Shows |
|---|---|---|
| `1440-1-composer`, `390-1-composer` | real | the schedule ticket on the listed Window: side, amount, **your price** (stepper, 50/55/60/70¢ chips), the strip (cost 5.50, return 10.00, "Rests at 55¢ · fills in the first minute after the bell if the venue's price comes to you"), the until-lock switch and note, the footnote. No seat bond is mentioned |
| `1440-2-receipt`, `390-2-receipt` | real | the receipt: held 5.50, 10 contracts, 55¢, "Fills within the first minute after the bell, or the stake comes back", the transaction, **Cancel the call**. The seat's balance read 994.50 |
| `1440-3-portfolio-open`, `390-3-portfolio-open` | real | the Open tab leads with "Resting for the open · TSLA UP · UP at 55¢ · 10 contracts · Held 5.50 · fills by 14:11:32 (09:11:32 ET) · Cancel". The time carries its zone once (the reference printed "ET ET") |
| `1440-4-portfolio-cancelled` | real | after Cancel: the balance is 1,000.00 again and the row reads "Cancelled · Back in venue credit 5.50 credits" |
| `1440-5-portfolio-history`, `390-4-portfolio-history` | real | History keeps the ended call under "Scheduled calls" |
| `1440-6-ended-states`, `390-6-ended-states` | fixture (`/dev/states`, real components and the real order view) | every state: Resting for the open, Resting, **Didn't fill** (swept, with what came back), **Filled**, **Partly filled**, Cancelled |

The 24/7 lanes keep the taker's ticket while they list (the reference's rule: "the token lane lists two minutes ahead and keeps the taker's words"), so a call is scheduled from a stock or Gap Window's card. The phone shots are the same React code in a 390 px browser (the drawer), not the native screens.

## Fixed from the reference

- The row said "fills by … ET ET". The time already carries its zone.
- A call the sweep returned was labelled "Cancelled". It reads "Didn't fill", and "Partly filled" when part of it filled.
- The portfolio never showed a filled or returned call. Ended calls stay in the Open tab for half an hour and in History for good.
- The amount line named the taker's minimum stake while the button named the call's own. Both name one lot at the call's price.
- The phone's price stepper chips ("−", "+") had no accessibility label. They read "1¢ less" and "1¢ more".
- `REST_LIVE` and the `rest-not-live` blocker are deleted, not flipped: a constant `true` would leave dead code.

## Gaps

- **No fill through the app.** Stocks have no price in this sandbox (no Alpaca keys), so a stock call cannot fill; the fill was proven with the same routes, ops and ledger on a BTC-1m Window, which the app does not offer for scheduling. The app's screens were driven for place, cancel and the rows.
- **No native screens.** The phone's screens and copy typecheck and share the web's hooks; no iOS simulator ran.
- **Not on a hosted network.** Nothing is on Noders DevNet. R1 is not uploaded.
- **Push** was not delivered. The seat's inbox item, which the drain turns into a push, was read.
- **Not run in the sandbox:** the 16-call cap (unit-tested), a cancel of the remainder after a partial fill (Daml and unit tests), the maker vault taking a fill (the desk's shard was used), the seat drain under a live call (the busy clock is unit-tested), Grofty's single-controller place.
- Rebuilt `daml/released/` files change the package ids of tickets, agents and games: a sandbox that loaded the old 0.5.0-based set must be started fresh.
