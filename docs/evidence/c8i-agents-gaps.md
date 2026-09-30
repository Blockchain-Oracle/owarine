# C8i — agents and desk gaps from the C8g screen pass, closed (evidence)

Date: 2026-09-30 · lane C8i (`slice/C8i-agents-gaps`, from main `4831a49`) · decisions K-220 – K-224 · follows `c8g-agents-ux.md`.

## Setup

- **Sandbox.** `dpm sandbox` (Canton 3.5.17), ports 7561–7566, JSON API :7565. DARs built with `dpm build --all` on this branch; no Daml changed.
- **Bootstrap.** `bootstrap-local.ts --seats 4 --lanes crypto,preipo --no-tickets --no-games`, parties file in the lane's scratch directory. The tickets (0.1.3) and games (0.1.1) DARs were then uploaded by hand: ops' venue now reads `abu-pm-tickets` and exited 78 (`PACKAGE_NAMES_NOT_FOUND`) without it.
- **Ops.** `services/ops/src/main.ts`, `OPS_ACTORS=all,desk-runner`, `DRY_RUN=0`, :8767, Postgres `pm_c8i`, `NEXT_PUBLIC_CANTON_NETWORK=localnet`. The ops env file (`services/ops/.env.local`, gitignored, linked from the main checkout) supplied `OPENAI_API_KEY` and `AI_MODEL=openai/gpt-5.4`; no key was printed. `DESK_MODEL_STUB=ACT_NOW` for the practice phase, then no stub; `DESK_MAX_MODEL_CALLS_PER_HOUR` 1, later 2.
- **Web.** `next build` + `next start` on :3160 (rebuilt once, after C8i.10). **Browser:** one headless Chrome, one open page at a time; seats A, B and C are separate browser contexts.
- **Host.** Load average 50–150 throughout. PreStocks' catalogue answered 429 or timed out at times (shared host).

## 1. Creator fees are claimed from the creator's strategy card (C8i.1, K-221)

Seat A (`2jhd…hvHU`, ledger `seat-1`) published "Iris Calder" (Momentum, fee 0.50) from the studio. Seat B (`E5XB…z4Cg`, `seat-2`) copied it with a 5-credit budget: the permission was 1.00 per trade, 5.00 a day, 1 open position, entry price ≤ 0.85. B's seat went 1,000 → 994.50.

| Step (screen) | What happened | Update |
|---|---|---|
| A publishes "Iris Calder" | `License_Publish` | `1220d3a20a6856ebd779288f9cb098a6018df42ba3ebe2fb976259e928e38bca730d` |
| B: "Fund permission and copy" | grant opened, then subscribed (fee 0.50 held by the venue) | `122078b13d6306f4aff468e2ae6e8d7871847754b00d07d4f8201c0db7c952713185` · `1220c945fd132e9d7c1dd687111e16fbf11ea734469af7adfdbb3f42543d0604ae6b` |
| The `agents` keeper | `period 497429: 1 payout(s) to 1 creator(s) with held fees`: one `CreatorPayout` of 500,000 (fee count 1) for A | — |
| A: Your strategies → Iris Calder | The desk's numbers row reads **YOUR FEES · 0.50 credits waiting · from 1 subscriber fee, pooled by the venue each hour · Who paid stays between each subscriber and the venue**, with "Claim to your seat →" (`01-creator-fees-waiting`) | — |
| A: "Claim to your seat" (after the web rebuild, so with C8i.6's lease scoping) | `Payout_Claim`, one seat command. The card reads "0.00 credits waiting · Claimed 0.50 credits into your seat. Receipt ↗"; the header went 1,000.00 → **1,000.50** (`04-creator-fees-claimed`) | `12203b4199bad66750b5d69178c5b3f5cef45c332a8d10a9657440d4a48e409322b4` |

**On the ledger after the claim** (JSON API, as seat-1): `VenueCash demo 1,000,000,000` and `VenueCash creator-fee 500,000`; no `CreatorPayout` is left. The phone renders the same card from the same hooks (`useCreatorFees`, `useDeskWrites().claimFees`); it was typechecked, not run.

## 2. A Canton desk is on this deployment's network; the stub reaches it; the real model decides (C8i.2, C8i.9, C8i.10, K-220)

Seat C (`EssC…P9sE`) built an AI Labs desk (OpenAI 40 %, Anthropic 40 %, cash 20 %) in `/desk/new` with the Loose limits and the premium ceiling raised to 50 %.

**Network and stub (C8i.2).** Ops logged `desk runner on localnet over the ledger` and `desk brain: openai/gpt-5.4 via direct`. The desk row is `cluster = localnet` (C8g's was `mainnet`). With `DESK_MODEL_STUB=ACT_NOW`, the practice desk's first record is `WOULD_HAVE_ACTED · I would have bought $50 of OpenAI. Rehearsal stub: act now (DESK_MODEL_STUB on localnet, not a model's answer).`, model `stub/DESK_MODEL_STUB`: the stub now reaches a local desk. `env.test.ts` pins the rule (never on devnet, testnet or mainnet).

**Go live.** `practice_checks` was set to 6 by SQL, the one step not done through a screen (as in C8g; six hours of practice do not fit the lane). Then, through the page: Read the record → Go live (On its own) → Open the desk on Canton → Allow the companies → Sign the link → Put money in, 50 credits (`1220758baf101af6db13c5f58228a6add042e59674923bae5d3bbdc8a0d768a03656`). Go live's money step opened on the link step's "Done." with no confirm button; the deposit went through "Add money" after a reload, and C8i.7 fixes the step.

**The live checks** (ops restarted without the stub; hourly budget 1, then 2, then 3 with 2 already spent; **2 real model calls in the lane**):

| Record | When (UTC) | What the desk did | Why |
|---|---|---|---|
| 5, 6 | 06:00, 06:01 | NOTHING_TO_DO | "could not price OpenAI and Anthropic": the hour's pre-IPO Windows open a few seconds after the top of the hour, and both checks ran first (a gap below) |
| 7 | 06:11 | NOTHING_TO_DO | "The desk would already have bought OpenAI at 05:48 UTC": the **practice** stub's "would have" deferral bound the live desk. Fixed in C8i.9 |
| 9 | 06:21 | **gpt-5.4: ACT_NOW (84 %)** for "BUY 20 credits of OpenAI" → BLOCKED_BY_LIMIT | "would cost more than 2.5 % against the price": the live leg measured cost against the fair price, counting the venue's half-spread (fair 562, ask 592). Fixed in C8i.10 |
| 13 | 06:42 | gpt-5.4 answered for "BUY 20 credits of Anthropic"; the answer was rejected → FAILED_NO_DECISION | "quotes the owner's private notes": the model echoed the owner note written in the studio, and the brain's privacy check refused it (working as designed). The owner then signed mandate v2 without a note |
| 10, 11, 12, 15 | 06:21–07:03 | DECLINED | "The price of … is 1.0–3.3 % away from its own average of the last half hour" (the reference's 0.5 % in-line rule on the PreStocks feed) |
| 16 | 07:03 | DECLINED | "Anthropic is 150.0 % above its mark. Your ceiling is 50.0 %" (fair 20, ask 50) |
| 17, 18 | 07:13 | DECLINED | "The quote for … is more than 8 % from the venue's price" (the reference's oracle band; OpenAI fair 160, ask 190) |

**Not reached: a live `Mandate_Trade` from the real model.** The real model decided on the live desk, and its one ACT_NOW was blocked by a gate this lane then fixed (C8i.10). After that, every check until the time box ran out was stopped by the desk's own arithmetic before the model was asked: the 0.5 % in-line rule, the owner's 50 % premium ceiling, or the 8 % oracle band. On the sandbox the venue quotes each Window at fair ± 30 ticks, so the band only admits Windows whose fair price is above about 0.40, and this hour's pre-IPO Windows sat at 0.02–0.34 or 0.98. The model was asked twice in the lane (records 9 and 13), under the three-call cap. `Mandate_Trade` and `Mandate_Sell` stay covered by `Test.Agents.Desk` (C8f).

## 3. Live figures start at go-live and speak credits (C8i.3, K-222)

After going live with 50 credits the plate reads **50.00 credits · 0.00 credits since your money went in · 0.0% since the first check**, the chart starts at 06:00 (going live), and the valuation line reads "Valued … at each Window's attested fair price" (`03-live-desk-plate`). C8g's plate read "+$47.50 since your money went in" and "−95.0% since the first check".

In the database (`pm_c8i`): after "Sign the link" the row is `mode on_its_own, live, drawdown_baseline_e6 NULL, cluster localnet`, `desk_events` has `went_live` at 1790747533 after the two practice snapshots (1,000,000,000 and 999,685,412), and the live reads skip both. `packages/db/src/desk-golive.test.ts` runs the same against real Postgres (4 tests).

## 4. The runner respects the grant's caps before it sends (C8i.4, C8i.8, K-223)

B's permission allows 1 open position and an entry price ≤ 0.85. The house runner filled one Window for B and then held every other:

- Filled: `filled up on POLYMARKET/3600s` for seat-2 — `12209cd29b3d6e75c61cb2b0714740561a79387aee79c5b1ec8ca952c018e347725a`.
- Then, every 30 s: "skipped — the grant is at its open-position cap (1 open); holding until one closes" (82 lines over the run) and "skipped — the price 980000 is over the grant's price cap 850000; holding" (216 lines).
- `abu-pm/over-position-cap` from the ledger: **0** across every ops log of the lane (C8g saw it and marked those Windows "refused, not resending").
- One Window was still marked refused before C8i.8: the executor refused on price against the displayed quote's cushioned limit after the runner's check passed at the quote's price (`strategy_attempts`: `down · refused · the grant refuses this call before it is sent: price`, 05:48Z). After C8i.8 both ask core `capsAtQuotePrice`; no attempt was refused after the ops restart at 06:14Z.
- Tests: `reliability.test.ts` holds at the position cap and the price cap without reserving or sending, and runs the runner's check over the reference's caps vectors (9 rows; the venue's empty-IOC row is the book's, not a cap); `caps.test.ts` covers `capsAtQuotePrice`.

## 5. X card cold load (C8i.5)

A cold load of `/trade-from-x` as seat A, sampled every 100 ms: "Checking X trading…" at 165 ms, then the funding step at 267 ms. "X trading status unavailable" never shows (`02-x-card`). The 401 race itself is timing-dependent, so `web/src/features/x/permission-state.test.ts` pins it: before the seat has been read once, a `signer-required` answer is "checking"; a real outage, or a 401 after a good read, is "unavailable". Web and phone share `useXGrant`.

## Security review H1 and L5 (C8i.6, K-224)

Raised by the coordinator's security review during this lane and fixed here by a forked copy of this lane (`65bda6f`), K-224:

- A seat's agents reads and writes count only contracts created at or after its lease's `seat_pool.start_offset`: a recycled seat sees none of the earlier visitor's grants, consents, strategies or fee payouts, and claim, update, runner change and deactivate refuse them.
- A strategy is labelled with its lessee's address only when it was created in that lease, so the playbook route no longer accepts the next visitor.
- A live strategy or a waiting payout blocks recycling; the drain has the venue pay out held fees, deactivates the seat's strategies and claims its payouts into its cash before the sweep.
- L5: publish and runner changes accept only the house runner or the creator's own seat.
- Tests: `agents-payouts.test.ts`, `seat-holdings.test.ts`, `drain.test.ts`. The claim above ran on the rebuilt web with this in place. The recycle path itself was not driven on the sandbox.

**Merging main (C4c + C4d at `b22b1b0`, then C4e at `a4d2e2d`) without reopening H1.** C4c labels creators through `seatHolders`, which carries no lease start, and relabels the caller's party by the key it proves. `seatHolderLeases` (a sibling in `@agari/db`) returns each live lease's `start_offset`; `leasedAddresses` returns lease-scoped labels; and the caller's own label counts from `lease.startOffset`, never from 0. A recycled seat proving its own key is therefore still not the creator of the previous visitor's strategy, and the playbook route (which resolves the creator through the same labels) refuses it. Tests: "a recycled seat proving its own key is never shown as creator of the previous visitor's strategy" (`agents-payouts.test.ts`), and the seat link store's Postgres test with lease-scoped labels.

**Finding 5 (re-review).** `openGrant` took the grant's agent from the request body. A grant now names only the house agent-runner party, which is the strategy runner and the X executor (K-087). `runnerOf` accepts only the house runner: a pooled seat party is refused as a strategy's runner, because subscribers' grants naming it would survive into the next lease. The studio's "Run your own bot" option stays on screen and is answered with that reason (gap 8). Tests: `agents-payouts.test.ts` refuses B, the seat itself and the venue as a grant's agent, and the seat itself as a runner, with nothing sent.

## Found and fixed while driving

| Commit | Found | Fix |
|---|---|---|
| C8i.7 `312721d` | Go live's "Open the money sheet" showed the link step's "Done." and no confirm | The step resets the shared write phase before it opens the sheet (web and phone) |
| C8i.8 `ab41252` | The grant executor refused a Window on price against the displayed quote's cushioned limit after the runner's check passed | One check, core `capsAtQuotePrice`, for both (K-223) |
| C8i.9 `ff8072c` | The practice stub's "would have" deferral stopped the live desk's first buy; the network CHECK swap locked `desks` on every boot (the desk DB tests deadlocked against the running runner) | Deferrals and the repeat check count the current life only (K-222); the CHECK is replaced only while it lacks `testnet` |
| C8i.10 `ea741d1` | The model's ACT_NOW was blocked as "more than 2.5 % against the price": live cost counted the venue's half-spread | Live cost is measured against the best ask or bid (K-225) |

## Commits

| Commit | Step |
|---|---|
| `d2e02f6` | C8i.1 creator fee claim (web, phone, route, intent, test) |
| `941a442` | C8i.2 the desk's network; the stub reaches a local desk |
| `5e52e19` | C8i.3 live figures from going live; credits |
| `d3144c2` | C8i.4 runner pre-checks the grant's caps |
| `f622de6` | C8i.5 X card cold load |
| `65bda6f` | C8i.6 security H1 and L5 (forked copy of this lane) |
| `312721d`, `ab41252`, `ff8072c`, `ea741d1` | C8i.7–C8i.10, found while driving (above) |
| `15c91d1` | C8i.11 decisions K-220 – K-225 and this evidence |
| `f2781c3` | merge of main `b22b1b0` (C4c, C4d): H1 kept closed through `seatHolderLeases`; finding 5 |
| the next merge | main `a4d2e2d` (C4e); decisions beside K-215 |

Decision numbers: K-202 is C2z's, K-204 is C4c's and K-210 – K-215 are C4d's and C4e's, so this lane uses K-220 – K-225.

## Gates

On the tree after merging main `a4d2e2d`:

- `pnpm typecheck`: clean for every package. Mobile `tsc`: clean.
- `pnpm invariants`: 0 errors, 0 warnings.
- `pnpm test`: **292 files passed, 12 skipped; 2,268 tests passed, 52 skipped.** (Before the merges, at `ea741d1`: 260 files, 2,150 tests.)
- Against real Postgres (skipped in `pnpm test` without a URL): `desk.test.ts` and `desk-golive.test.ts`, 7 tests; `seat-link-store.server.test.ts`, 6 tests. All pass.
- No Daml changed. DARs were built locally only, to boot the sandbox.

## Gaps (named, not waived)

1. **No live `Mandate_Trade` from the real model on the sandbox** (above). The next drive should run at a moment when a basket name's Window sits between about 0.40 and 0.90, or on a venue whose half-spread is narrower than the 8 % band.
2. **The live desk's hourly check runs before the hour's Windows open.** At 06:00 and 07:00 the check ran a few seconds before the new pre-IPO Windows opened (their opening print is posted after the hour), so both read "could not price OpenAI and Anthropic". The hourly check of a live desk should wait for the hour's Windows, or run a few minutes after the hour. Not fixed in this lane.
3. **Go live still needs 6 hourly practice checks**; set by SQL here, as in C8g.
4. **The recycle path (H1) was not driven**: a drained, re-leased seat was not exercised on the sandbox. It is covered by `agents-payouts.test.ts`, `seat-holdings.test.ts` and `drain.test.ts`.
5. **The phone was typechecked, not run**: the claim control and the live plate on the native app follow the shared hooks.
6. **The studio's "View publication transaction" link carries no `network=`** (`CreatorStudio` calls `txUrl` without the cluster). It was noticed, not fixed.
7. **Inherited identifiers** (`DeskMainnetSession`, `USDC_MAINNET`, `MAINNET_RPC_PATH`) keep their reference names (K-220); nothing a desk stores, signs or shows says mainnet.
8. **Self-hosting a strategy from a seat is refused** (finding 5): a pooled seat party is recycled, so it cannot be a strategy's runner. The studio still offers "Run your own bot" and the publish is refused with the reason. A self-hosted runner needs a party that is not a pooled seat, which does not exist on this deployment.

## Screenshots (`docs/evidence/ux/c8i/`, 390 and 1440, dark and light)

- `01-creator-fees-waiting` — A's own strategy: "YOUR FEES · 0.50 credits waiting" and "Claim to your seat".
- `02-x-card` — `/trade-from-x` after a cold load (checking, then the funding step; never "unavailable").
- `03-live-desk-plate` — the live plate: 50.00 credits, +0.00 credits since the money went in, the chart from going live.
- `04-creator-fees-claimed` — after the claim: 0.00 waiting, "Claimed 0.50 credits into your seat. Receipt ↗" (1440; at 390 the page reloads for mobile emulation, so the one-shot confirmation line is not in those two).
- 390 is the web at phone width; the native app follows the same hooks and was typechecked, not run.
