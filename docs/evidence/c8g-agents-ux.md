# C8g — agents, strategies and desks through the real screens (evidence)

Date: 2026-09-30 · lane C8g (`slice/C8g-agents-ux`), finished by lane C8h · decision K-203 · follows `c8f-agents.md`.

C8g ran for 11 hours and was stopped after C8g.8. C8h restarted it on the same branch: it merged main (`f6ac105`), kept
and committed C8g's uncommitted runner change (C8g.9), and drove every remaining flow through the browser.

## Setup

- **Sandbox.** `dpm sandbox` (Canton 3.5.17) with JSON API :7565 and ports 7561–7566. DARs were rebuilt with `dpm build --all`, because main's `abu-pm-tickets` 0.1.2 had no DAR.
- **Bootstrap.** `bootstrap-local.ts --seats 3 --lanes crypto,preipo`, with its own parties file in the lane's scratch directory.
- **Ops.** The real `services/ops/src/main.ts` with `OPS_ACTORS=all,desk-runner`, `DRY_RUN=0` and HTTP :8767. Postgres was `pm_c8h`. No provider keys were set: no model key, no X keys, no Alpaca.
- **Web.** `next build` + `next start` on :3160.
- **Browser.** One headless Chrome with its own profile. Two browser contexts served as two seats: seat A (`CJp1…goqA`, ledger `seat-1`) and seat B (`73HK…wjL7`, ledger `seat-3`). A seat's signing key lives in its browser storage, so each seat keeps its own context.
- **Host.** Load average stayed between 95 and 120 throughout.
- **Ops exit.** The ops process ended at 04:48Z with no exit line in its log. The cause is unknown; an outside kill is possible, since other lanes were running on the host. Every write recorded below landed before then (the last one, the fade fill, at 04:21Z). The web and the ledger stayed up.

## Strategies: publish → copy → runner places → top-up → settle → revoke → fade

Everything below was clicked through `/strategies`. Every seat write is journaled in `seat_commands` and landed.

| Step (screen) | What happened | Update |
|---|---|---|
| A publishes "Mika Vance": Momentum, 0.1 %, "Let Agari run it", fee 0.5 (`03b-publish-ready`, `04-published`) | `License_Publish` | `1220dcc4b46a73b5c34583b515a098d37209516b84a2a5949806f1615b0d9c616683` |
| B chooses COPY IT with a 5-credit budget, then "Fund permission and copy" (`06-copy-setup`, `07-copying`) | Grant opened, then subscribed. Seat 1,000 → 994.50 (5 budget + 0.50 fee). | `12201b5e824afa02d822f8a043bc6cd53b540bb931a9f4f82139a30241e08b8df773` · `12208af1d101433d283707e5714efb79d629c560d2880e17f028ac09132dcba86a45` |
| The house runner places for B (ops log) | `filled up on ANDURIL/3600s`. The grant was charged 0.604396. The drawer's recent copy-trades shows 0.60 credits with its proof link. | `12202c65936b500b0ee9096239fe64909714a57d85641f4fd5f7a6a6885d97865cf5` |
| B: "Add budget without changing limits", 2 (`08-grant-topup`) | Budget 4.395604 → 6.395604. `spentToday` kept 604396; caps unchanged. Seat 994.50 → 992.50. | `12205a44bb32405f6f7bc96c9e918a095b31d25917d890a4b3d9b2505f2e8fc3889d` |
| Settle | The settler: `settled ANDURIL-60m:1 (Up): 2 legs in 1 batches`. B's leg won. B holds a `payout` VenueCash of 1,000,000. The card reads 1 trade, 100 % won, net +0.39. | — |
| B: "Pause future copies", which revokes and unsubscribes | The grant's whole remaining budget came back as a `grant-return` VenueCash of 6,395,604, and the Subscription was archived. | `12207859782a190c3131baf15ead0b55e3505637f6b053f48fa1450de451a094f938` · `122083ebaacda7b5edff36de9a3aff8d654354305a4cfabb6c8eb1130ea5af8c04b4` |
| B chooses FADE IT with a 5-credit budget, then "Fund permission and fade" (`09-fade-setup`, `09b-fading`) | Subscription `kind: SubFade`. The drawer reads "You are fading this strategy: the runner places the opposite of its calls." | `1220c60051ce09f535e4154cde821d15c06348ccb3e7eb76af33df3e86c41b24aefa` · `1220ef71dfd9844a63c4cc3331bc56caee9453436c42e1be11af60ee7e57a669e331` |
| The runner fades for B | Filled ETH-60m:2 **Down**. The grant budget went 5 → 4.207224 (0.792776 charged). | `1220f534378e329972a67da85a053b166e9c3fa19b8f22df7bfad2dcd3bd68eea167` |
| Creator fee | The `agents` keeper: `period 497428: 1 payout(s) to 1 creator(s)`. A `CreatorPayout` of 500,000 (fee count 1) waits for A. See the gaps below. | — |

**B's cash reconciles to the unit** (after revoke, before fade):
1,000 − 5.5 (budget and fee) − 2 (top-up) + 6.395604 (returned) + 1.0 (payout) = **999.895604**.
The ledger holds 992.5 change + 1.0 payout + 6.395604 grant-return, and the header reads 999.89.

## Desk: practice → live → pause/unpause → checkpoint → shared

| Step | What happened | Update |
|---|---|---|
| A runs studio `/desk/new`: AI Labs basket, default limits, test read | A practice desk (`3b6438e2…`). Practice checks record `DECIDED NOT TO` from arithmetic, e.g. "OpenAI is 39.0% above its mark". The model step records `COULD NOT DECIDE … not configured: set ANTHROPIC_API_KEY`. That is the honest state with no key. (`10-desk-practice`) | — |
| Check now (twice, 10 min apart) | `check_now: completed`. The card says "Once every ten minutes". | — |
| **Time compression.** Go live needs 6 hourly practice checks; only the `hour` trigger counts, so this is 6 hours of wall time. | `UPDATE desks SET practice_checks = 6` in `pm_c8h`, by hand. Go live was then run through the UI after opening the record. **This is the only step not done through a screen.** | — |
| Go live: open, allow, sign the link, then Add money 50 | `DeskMandate` opened, names allowed, record linked, 50 credits deposited. | open `1220c6b25ff4a59d14c2d2c84651e62d4854bd1efd0911248a2773d9fa46891c4881` · allow `1220ee401fb01e175019d57140d8c9b1b01dc870720170d43ef3dc248ea70425dfbb` · deposit `12202e3743e66582016503e488bd755b1ca2d814cbdea0f71dfef94fbf37403b38fd` |
| Pause | It landed on the ledger, but **the page kept offering Pause**. Fixed in C8g.11 (below). | `1220dbc7644f8d59dffc873b390feb1bcbf297141662457a1bf4b9705ba43146b93a` · second press `1220ce08f62f6c28b9d9eb7485550d12f4d222a905bc24692546f7a13a00f9d95919` |
| After C8g.11 | The page reads PAUSED BY YOU and offers **Resume**. The next-check card reads "Paused by you". (`12-desk-paused`, `13-desk-live-paused`) | — |
| Checkpoint (while paused; the rule allows it) | `drive/desk-checkpoint.ts` (C8g.13) ran the runner's own `wakeDesk(trigger: "checkpoint")` outside the 00:05 UTC window. Record 10 `NOTHING_TO_DO`; `desk_actions` checkpoint `confirmed`, chain seq 1. The shared card shows "I sealed the day's record on chain. Nothing was traded." | `1220d0279ae534c2763c3419855315ac8258a58aeecd9e7a7cac98eddc2a7d69a074` |
| Resume | It landed, and the page is back to Pause. The proof link now carries `network=localnet`. | `122009183006b02e2618b0eb197fa0d9731d2f0ff68343d82aa0f7bd96c515731323` |
| Share (More → Share → Sharing is on) | `share_public = t`. With K-203 the entry shows this desk. (`11-desk-entry-shared`, `14-shared-desk`) | message, no update |
| Money sheet after C8g.12 | "Your seat holds 950.00 credits", "You send 25.00 credits", "none on Canton". (`16-desk-money-sheet`, `17-desk-live`) | — |

## X card

`/trade-from-x` shows "X sign-in is not available on this deployment yet." This is honest: `/api/x/status` reports `configured: false, missing: X_API_KEY, X_API_KEY_SECRET, X_SESSION_SECRET`, and ops logs `x-relay not configured`. The funding step, "Fund + authorize the agent", reads the seat's balance (`15-x-card`).

One transient remains. On a cold load the first `/api/ledger/agents/vault` read answers 401, before the seat's signer is ready. For about a second the panel shows "X trading status unavailable", then it settles. This is noted, not fixed.

## Fixes this pass

| Commit | Area | What |
|---|---|---|
| C8g.9 `f869367` | runner | C8g's uncommitted change, reviewed and kept. The strategy runner used to stay idle for the process's whole life if the web was down when ops booted. It now retries every interval (`venue-wait.ts` plus a test). On this run it logged "no venue to scan yet … asking again every 30 s", then traded. |
| C8g.14 `bcbd69f` | runner | The same helper narrows the venue id, so `@agari/ops` typechecks. The C8g change as left did not. |
| C8g.10 `433234e` | desk | The shared desk is this deployment's own (K-203), on web and on the phone. |
| C8g.11 `cb3c4bd` | desk | A paused live desk shows as paused and offers Resume. The view reads `DeskMandate.paused` over an active row, and the runner's row names (`paused`, `stopped_by_loss`) are mapped to the page's names. There is a test. The reference has the same hole (nothing writes a paused state back), so Resume was unreachable there too. |
| C8g.12 `59a03c3` | desk | Live money reads in credits: Go live's limits, the money sheet ("$1,000.00 credits" became "1,000.00 credits"), and the too-small line. The card no longer repeats "Your seat signs one Canton command". Proof links carry the deployment's network, not `mainnet`. |
| C8g.13 `d807cf0` | desk | `scripts/drive/desk-checkpoint.ts`. |

C8g.1–C8g.8 are C8g's own (see `git log`): lot-price ticks, the live money sheet, the runner party placeholder and link, seat wording, the registry fee, Add credits, and the exact top-up.

## Gates (final tree)

- `pnpm typecheck` is clean for every package, **mobile included**.
- `pnpm invariants`: 0 errors, 0 warnings.
- `pnpm test`: **246 files passed, 6 skipped; 2,058 tests passed, 25 skipped**. The known load timeouts did not occur this run.
- No Daml was changed. DARs were rebuilt locally only, to boot the sandbox.

## Gaps (named, not waived)

1. **Creator fees cannot be claimed from a screen.** The keeper aggregates fees into a `CreatorPayout`, and `Payout_Claim` has a route (`/api/ledger/agents/strategies/claim`) and a lane (`claimCreatorPayoutsLane`). Nothing in web or mobile calls it, so A's 0.50 waits on the ledger. The fix is a claim control on the creator's strategy card, reading the seat's `CreatorPayout`s.
2. **The live desk never traded.** No model key was on the host, so each check ends `COULD NOT DECIDE`. `DESK_MODEL_STUB` is honoured only for `DESK_CLUSTER=localnet`, but the web writes desks as `mainnet`, so the stub cannot reach them. The `Mandate_Trade`/`Mandate_Sell` legs stay covered by `Test.Agents.Desk` (C8f).
3. **The live desk's figures mix in the practice record.** After going live with 50, the plate read "+$47.50 since your money went in" and "−95.0% since the first check". The drawdown baseline came out as 2.5 after the deposit (`scaledBaseline` over the practice paper value), and the chart spans the $1,000 practice series. The plate's `$` sign on a live desk is the same kind of drift C8g.12 fixed for the sheet. Needs a runner fix: reset the baseline and series at go-live.
4. **The runner can exceed a grant's open-position cap.** It sometimes sends while the grant is at its cap, and the ledger refuses with `abu-pm/over-position-cap`. Money is safe; the ledger is the guard. It is noise in the runner report, and those Windows are then marked "refused, not resending".
5. **Go live needs 6 hourly checks.** On this run the count was set by SQL, as disclosed above. A real run needs 6 hours of practice.
6. **Duplicated "Done. Done." on control cards.** The reference has it too; left as the reference's.

## Screenshots (`docs/evidence/ux/c8g/`, 390 and 1440, dark and light)

- From C8g: `01`–`05`.
- From this pass: `03b-publish-ready`, `06-copy-setup`, `07-copying`, `08-grant-topup`, `09-fade-setup`, `09b-fading`, `10-desk-practice`, `11-desk-entry-shared`, `12-desk-paused`, `14-shared-desk`, `15-x-card`, `16-desk-money-sheet`, `17-desk-live`.
- 1440 dark only: `12-desk-paused-card` and `13-desk-live-paused`.
- Some 1440 shots of drawers and sheets were taken after a viewport change. The sheet stays open, but a typed amount can reset.
