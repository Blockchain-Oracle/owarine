# C2e — a private call's payout lands in the private bucket (abu-pm-main 0.5.2)

Date: 2026-10-06 · lane C2e (`slice/C2e-private-payout`, from main `016574c`) · decisions K-315 – K-317 · follows `c8d-markets.md` §6 (K-266 and the gap it named) and `c7c-resting-call.md` (K-235, the R1 rebuild pattern).

**The gap.** Private mode on Canton is the seat's `VenueCash` in the `private` bucket; a private call is accepted with exactly its private cash and its leg is tagged `beneficiaryRef = "private"` (K-266). abu-pm-main 0.5.1 paid every leg's settlement into the public `payout` bucket (a stale refund into `refund`), so a settled private call's money sat in the seat's public balance until the user pressed Cash out.

**Now.** abu-pm-main 0.5.2 pays a private call back into the private bucket on every path that returns money to its owner, and its `SettlementReceipt` says so. R1 is rebuilt on it, the stack reads it, and a fresh sandbox bootstrapped from the new `daml/released/` set shows it end to end: a win, a loss and a void, each landing in the private balance with the public balance untouched.

## 1. The Daml change (`e425f5d`)

| Where | What |
|---|---|
| `PM.Leg` | `legPrivate l = l.owner /= l.venue && l.beneficiaryRef == Some "private"`; `legBucket path l` is `private` for a private call, the book's bucket for a book's leg, else `path`. `payOut` (used by `Leg_Settle` and `Leg_Claim`, won, lost and void) pays into `legBucket "payout"`; `Leg_RefundStale` into `legBucket "refund"`. |
| `PM.Publication` | `SettlementReceipt` gains `paidInto : Optional Text` as its last field: `Some "private"` for a private call, `None` for every other receipt (public legs, grants, tickets). |
| `PM.Tickets.Common` | tickets set `paidInto = None` (a Daml record construction must name every field). |

Unchanged on purpose: a venue-owned leg is never private (its tag is its book's); `Leg_CloseOut` (seat drain) still pays `close-out`, because a drained seat's cash is swept whole anyway (K-266); `BuyQuote_Accept` still pays `sale`, and the web never offers a private call an exit.

**Upgrade rules (SDK 3.5).** Smart Contract Upgrade allows a template to append `Optional` fields at the end of its field list and allows a choice's body to change; it forbids removing, renaming, reordering or retyping a field (`refs/official/cf-docs/docs-main/appdev/deep-dives/smart-contract-upgrade.mdx` §Overview, copied from the Daml 3.4 page `sdlc-howtos/smart-contracts/upgrade/smart-contract-upgrades.rst`; the 3.5 checker is `dpm upgrade-check`, run below). No signatory, observer, key or `ensure` changed, so no contract's stakeholders move under the upgrade, and a 0.5.1 receipt reads as 0.5.2 with `paidInto = None`. The same page says a participant "rejects two packages with the same name and version whose content differs", which decides the dependents' versions (K-316); its §Dependencies lets a new package version carry an upgraded version of a dependency.

## 2. Money gate (`f69f7ef`)

`daml/pm-tests/daml/Test/PrivatePayout.daml`, 7 scripts, each against the real templates:

| Script | Checks |
|---|---|
| `testPrivateWinPaysIntoPrivate` | Up at 620, 3 lots, fee 9 from private cash; Up wins: `private` = 3,000, public = 0; receipt `(payout, paidInto, resolved, cost, fee) = (3000, Some "private", Some Up, 1869, 9)`; venue `fee` = 9 |
| `testPrivateLossPaysNothing` | Down wins: private 0, public 0; receipt payout 0 with `Some "private"`; fee 9 to the venue; the venue's own winning leg pays its `payout` bucket as before |
| `testPrivateVoidRefundsStakeAndFee` | void: private = 1,860 + 9; receipt payout 1,869, resolved None, fee 0; venue fee 0 |
| `testPrivateClaimEqualsSettle` | win, loss, void: Alice's own `Leg_Claim` and the venue's `Leg_Settle` for Bob both land in `private` with equal amounts |
| `testPrivateStaleRefund` | refused one second early; at `refundAfter` stake + fee back into `private` |
| `testPublicLegUnchanged` | beside a private call in the same Window, an untagged leg and a `grant` leg pay `payout` on win and void with `paidInto = None`; a public stale refund pays `refund` |
| `testVenueLegNeverPrivate` | a venue-owned leg tagged `private` pays the venue's `payout` bucket and leaves no receipt |

`cd daml && dpm build --all && (cd pm-tests && dpm test)`: build green; **273 scripts ok, 0 failed** (266 before plus these 7), 86 s.

## 3. R1 rebuilt on main 0.5.2 (`be90ebd`, K-316)

`docs/plan/acceptance.md` on main (`64a80db9` when checked, 09:29 UTC) has no R1 upload row, so 0.5.2 replaces 0.5.1 as R1's main DAR, as in K-235. The four dependents bump their versions: tickets 0.1.4, agents 0.2.2, games 0.1.2, cc 0.1.1.

| File | Main package id | sha256 |
|---|---|---|
| `abu-pm-main-0.5.2.dar` | `f29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a` | `cf3dcc7c…26c85` |
| `abu-pm-tickets-0.1.4.dar` | `6b1d6533919e3674ce50d06785cedd308972d2b485f07be05301df5c15dec7bb` | `4c015ce2…d8543` |
| `abu-pm-agents-0.2.2.dar` | `6787ea8c069df109641f11774d2dcbe283b6ed968366e31521bf0bc455110cf4` | `111127bc…cb7a` |
| `abu-pm-games-0.1.2.dar` | `1afe8bf16a66b2f02af067752fff92f64225b051df9d387695957f0a86e46cc6` | `9cf0f8b2…4f39` |
| `abu-pm-cc-0.1.1.dar` | `f8586e803801c43edee5b1edbe7be0006dedcd7fee1c172d8b61653b575c6745` | `d4249bc8…d648` |

- Built at `e425f5d`; rebuilt from `git archive e425f5d daml` in a clean directory: all five byte for byte the same. Each dependent carries exactly one main, `abu-pm-main-0.5.2-f29dde00…`.
- `dpm upgrade-check --both` of the five against the 0.5.1 set (the files at `016574c`): exit 0, 0 WARN/ERROR, 37 lineages succeeded; each of ours "claims to upgrade" its 0.5.1-set build. Main alone against 0.5.1: exit 0. Verbatim lines in `daml/released/MANIFEST.md`.
- The same check with tickets left at 0.1.3 exits 1: `KNOWN_PACKAGE_VERSION(8,0): Tried to vet two packages with the same name and version`. That is why the dependents bump.
- `devnet-r1.md` step 5 names the new files; `cc-rail.md` names `abu-pm-cc-0.1.1.dar` (`ce511c0`, owner-only file, one line); `bootstrap-local.ts` and `bootstrap-games.ts` default to the new builds; the bootstrap reads the expected ids from the files themselves (`repoDars`).
- `pnpm codegen:daml` (`ff48eec`): the bindings carry `SettlementReceipt.paidInto`; the dependents import `@daml.js/abu-pm-main-0.5.2`, so the alias in `packages/daml-clients/package.json` and its lockfile key moved from 0.5.1 to 0.5.2 (`8a7e502`, owner-only files, one key each). Template ids stay package-name references.

## 4. Ops, projection and web (`d2e4485`, `fcefa88`, `7d8da57`, `7057673`)

- **Projection.** `idx_receipts.paid_into` (added in place, engine 0.5.2), decoded from the receipt. The projector counts the `private` bucket as what a leg paid (found on the sandbox: the winning private leg first read `payout_base = 0`; fixed in `7d8da57` with a test on the real `settle-a` transaction re-bucketed).
- **The private list.** `positionOf` (now the pure `web/src/features/private/position.ts`, 5 tests): a receipt naming `private`, or a stale refund, is `credited` at once with `paidInto: "private"`; a 0.5.1 receipt stays `settled` until its cash-out dismisses it. The row reads "in private balance", titled with the receipt's words, web and phone; the ticket note and the list's foot say the payout comes back by itself; `/dev/private` shows a 0.5.2 win, loss and void.
- **Cash out.** `/api/private/cashout` answers `done` for a receipt paid into `private` and moves nothing; ops' `/internal/private/move` refuses such a cash-out (`already-claimed`), because moving its payout again would take the seat's public cash. A 0.5.1 receipt still cashes out once.
- **Balances.** No change was needed: a `private`-bucket `VenueCash` was already counted as private and never as spendable (C8d).
- **History and inbox (K-317).** The seat's fills, exits and receipts (`walletFills`, `walletActions`, `walletReceipts`) and its own activity inbox (`seatActivityReader`) leave out its private calls, so neither shows a win the public balance did not receive; Postgres test `read-private-history.test.ts`.

## 5. End to end on a fresh local sandbox (09:37–09:52 UTC)

**Setup.** `dpm sandbox` (Canton 3.5.17), `JAVA_OPTS=-Xmx1536m`, ports 7900–7905 (ledger :7900, admin :7901, sequencer :7902/:7903, **JSON API :7904**, mediator :7905), started empty. Abu's side stood in for as in C2z: the five files of `daml/released/` uploaded in `devnet-r1.md` step-5 order (`POST /v2/dars?vetAllPackages=true`, 200 ×5, 09:38:23–27Z) and the 19 parties allocated with the step-3 hints, their ids pasted as text into a mode-600 file in the lane's scratch directory. Ops: the real `services/ops/src/main.ts`, `OPS_ACTORS=relay,venue,projector,http`, `DRY_RUN=0`, :8790, `ROLLER_SERIES=BTC-1m,BTC-5m`, Postgres `pm_c2e`; no price-source keys (BTC prints come from the three exchanges' public endpoints). Web: `next dev -p 3190`, `NEXT_PUBLIC_CANTON_NETWORK=localnet`, same parties file and database. `OPS_INTERNAL_SECRET` and the seat cookie secret were throwaway values in a mode-600 scratch file, never printed.

**Bootstrap from the released set** (`bootstrap-devnet.ts --allow-local`, the R1 sequence of `c2z-r1-rehearsal.md`):

| Run | Result |
|---|---|
| `--check-only` (09:38:47Z) | **26/26 pass**: Canton 3.5.17; parties file 8 roles, 11 users; 19 parties hosted; `abu-pm-main 0.5.2` `f29dde00cb60…`, `abu-pm-tickets 0.1.4` `6b1d6533919e…`, `abu-pm-agents 0.2.2` `6787ea8c069d…`, `abu-pm-games 0.1.2` `1afe8bf16a66…`, `abu-pm-cc 0.1.1` `f8586e803801…`, each `PACKAGE_STATUS_REGISTERED` |
| real, `--lanes crypto` (09:38:54–09:39:26Z) | pass: **78 writes executed** (desk, 16 shards, the crypto Series, ticket reserves with their LP seed, maker vault, arena, season pool), 105 rows pass, 0 fail; parties file written (mode 600) |

**The drive** (`scripts/drive/c2e-private-payout.ts --only payout,void,out`, then `--only guard`), seat P leased through `/api/seat` with an Ed25519 key. Rows as printed; the commit column is HEAD when each run started (`d2e4485a`; the web ran the working tree that became `fcefa88`, and the ops restarted at 09:51:20 ran `7d8da57`).

| UTC | Check | Ledger evidence | Result |
|---|---|---|---|
| 09:43:12 | seat P moves 30 credits into its private bucket | update `1220b3beb660d1d589daabdac291cf9439756fc72bd90a5176f5e36be0826a78e3ca` (VenueCash_Withdraw + VenueAccount_Credit "private") | pass: public 1,000.00 → 970.00; private 30.00 |
| 09:43:20 | an Up and a Down private call on one BTC-1m Window, paid from private only | updates `122032af101077c1d4f94825671758856143f832d6e0a4a22c48f6b85c34be4c344a`, `122024a0197508c74c4d475143964f1a116ba5df160575811a889e46b4e6b76b0b58` (Quote_Accept, beneficiaryRef "private") | pass: BTC-1m:5, Up 4.99, Down 4.83; private 20.17; public 970.00 (unchanged) |
| 09:44:16 | the venue settles both into the private bucket at once; the public balance does not move | settle update `1220d16d78668ca7783cb8763e25e627c3ad1c8e22c7113d888226d28277ac73b60d` (one Desk_SettleBatch: Leg_Settle → VenueCash "private" + SettlementReceipt, both legs) | pass: Down won 11.00, Up lost 0.00; **private 20.17 → 31.17 with no cash-out**; public 970.00 (unchanged); both receipts `paidInto = "private"` |
| 09:44:17 | Cash out has nothing to move; the receipt is never published; history does not list the calls | POST /api/private/cashout · POST /api/ledger/publications · GET /api/index/wallet/<seat>/receipts | pass: cash-out `done`, private 31.17 → 31.17; publish 409; history 200, neither call listed |
| 09:45:14 | a private call on a BTC-5m Window | update `122031f2de7a2bb22934558cd3623a91b463f28068cc14a2bed12c19cc8e51724bb3` (Quote_Accept, beneficiaryRef "private") | pass: BTC-5m:2 Up for 4.98; private 26.19 |
| 09:51:33 | the Window voids; stake and fee come back into the private bucket, the public balance does not move | settle update `12202ae4e94ecdea0d6ee43ffc9503b54f8b216ee1e2190896aca89da679e293137a` (Leg_Settle on a void Resolution) | pass: void, payout 4.98 = cost 4.98; **private 26.19 → 31.17**; public 970.00 (unchanged); receipt `paidInto = "private"`, resolved void |
| 09:51:35 | the private balance moves back to the seat's balance | update `1220d49ff362652040a828495fc9f82160649f041aeab09ded038c6c295c53712b41` (VenueCash_Withdraw "private" + VenueAccount_Credit "demo") | pass: 31.17 out; public 970.00 → 1,001.17 |
| 09:52:03 | ops refuses to cash out a receipt already paid into the private bucket; nothing moves | POST /internal/private/move op cashout (HMAC) | pass: all 3 such receipts answered `already-claimed` |

**How the void was made.** The drive printed the Window's close deadline (09:51:00Z) as soon as the call was placed; a watcher stopped ops at 09:45:14Z (before the 09:50:00Z expiry, so no close print was posted) and started it again at 09:51:20Z. Past the deadline `Terms_Resolve` is refused by the ledger, so ops' resolver voided BTC-5m:2 (`MissingPrint(CloseSlot)`) and the settler paid every leg on the void Resolution.

**The money, in base units (credits × 10⁶), from the receipts.** Up cost 4,994,810 (fee 18,810), lost, paid 0; Down cost 4,834,064 (fee 27,064), won, paid 11,000,000; the void call cost 4,977,225 and paid 4,977,225 back (fee 0). Private: 30,000,000 − 4,994,810 − 4,834,064 = 20,171,126; + 11,000,000 = 31,171,126; − 4,977,225 = 26,193,901; + 4,977,225 = 31,171,126, all moved out. Public: 1,000.00 → 970.00 → unchanged through two settles and a void → 1,001.171126, net +1,171,126 = the Down payout less the two settled calls' costs.

**Found on the sandbox and fixed.** The projector counted only the public buckets as a leg's payout, so the winning private leg first read `payout_base = 0` in `idx_legs` (the private list was right, it reads the receipt). Fixed in `7d8da57`; the void leg settled after the fix reads 4,977,225 base units.

**Rebuild against live** (`scripts/drive/rebuild-projection.ts`, ops stopped, 10:01Z; replay from offset 0 into a second scratch database `pm_c2e_rebuild` with the fixed projector): to ledger end 891 in 6.4 s; 8 of 11 tables equal row for row, and the 3 that differ (`idx_legs`, `idx_markets`, `idx_positions`) differ in exactly one fact: the winning private leg of BTC-1m:5, which the live projector (started before the fix) recorded as paying 0 and the rebuild reads as 11,000,000 (its leg, its Window's payouts total, the seat's position). The void leg, projected live after ops restarted on the fix, is equal in both (4,977,225).

**C8d's private part on the same stack** (`c8d-markets.ts --only private`, updated for 0.5.2 in `153b26f`): 6/6 pass, seat G: 20 credits in (update `12200f88ece2273156f7d6025926c23d5d480568efb9caccb4c0f37285e3120063d0`); a signed private Up on BTC-5m:4, 9 lots for 4.76 (update `1220c9cd04379c5f1389a74255fc4d7fe0a9b96dde378d88a3f4e4e878705530c9a2`), not in the public positions; Cash out before settlement `open`; settled (lost): nothing moved anywhere, Cash out `done`, publish 409; 15.24 out (update `1220b30109e46d14003563a84e7d10195ebc072d4e7672c49bcfe2bf3eae69c65897`).

## Gates

- **Daml:** `dpm build --all` green; `dpm test` 273 ok, 0 failed. **Release:** `dpm upgrade-check --both` of the five against the 0.5.1 set exit 0, 0 WARN/ERROR; main alone exit 0.
- **Fast:** `pnpm typecheck` (every project, mobile included) and `pnpm invariants` (0 errors, 0 warnings) green on `d2e4485`, and again on `153b26f` with this note and the acceptance rows in the tree (10:03Z).
- **Targeted vitest:** `position.test.ts` 5, `decode.test.ts` 21 (+2), the bootstrap's 26, and the private, projector, venue, markets-server and dev-fixture suites: 174 passed. Against Postgres (`SEAT_PG_URL` = a scratch database `pm_c2e_it`, one file at a time): `packages/db` 26 passed, `read-private-history.test.ts` 3 and `read-lease.test.ts` 5 among them.
- **Sandbox drive:** C2e 8/8 and C8d private 6/6 (above); rebuild equals live but for the one fact the projector fix changed.
- **Not run:** the phone on a simulator (it typechecks); `next build` (owner and `live` worktrees only); a browser look at the seat-owned Portfolio (the `/dev/private` fixture was rendered and shows "in private balance" three times).


## Owner-only files touched

Each in its own commit, flagged in the report:

- `packages/daml-clients/package.json` and `pnpm-lock.yaml` (`8a7e502`): the alias `@daml.js/abu-pm-main-0.5.1` became `…-0.5.2` (one key each), because the regenerated bindings require that name. No dependency added or changed.
- `docs/plan/runbooks/cc-rail.md` (`ce511c0`): one line now names `abu-pm-cc-0.1.1.dar`.
- Granted to this lane and used: `daml/*/daml.yaml` versions, `daml/released/**`, `docs/plan/runbooks/devnet-r1.md` (file names and versions only), `docs/plan/acceptance.md` (local rows appended).
- Not touched, for the owner: `docs/plan/STATUS.md` still names the 0.5.1 set and the private-payout gap; `docs/plan/decisions.md` (K-315 – K-317 below); `docs/plan/parity.md` row L-39.

## Decisions

### K-315 — A private call pays back into the private bucket, and its receipt says so (abu-pm-main 0.5.2)
- **Date / owner:** 2026-10-06 · Claude (lane C2e).
- **Evidence:** §1, §2 (7 Daml scripts, suite 273 ok), §5 (sandbox drive); `daml/abu-pm-main/daml/PM/Leg.daml` (`legPrivate`, `legBucket`), `PM/Publication.daml` (`paidInto`).
- **Rule:** a user's leg tagged `beneficiaryRef = Some "private"` (K-266) pays its owner into the `private` bucket on `Leg_Settle`, `Leg_Claim` (won, lost, void) and `Leg_RefundStale`; the fee is the venue's exactly as on a public leg. `SettlementReceipt.paidInto` (Optional, the last field) is `Some "private"` for such a receipt and `None` for every other. A leg the venue owns is never private. `Leg_CloseOut` (seat drain, swept whole) and `BuyQuote_Accept` (never offered to a private call) keep their public buckets. The change is upgrade-compatible (one Optional field appended, choice bodies changed) and `dpm upgrade-check` passes against 0.5.1.
- **User-visible:** a settled private call's payout is already in the private balance; the private list says "in private balance"; nothing waits for Cash out.
- **Approval:** default; overrulable.

### K-316 — R1 is rebuilt on main 0.5.2, and the dependents bump their versions
- **Date / owner:** 2026-10-06 · Claude (lane C2e).
- **Evidence:** §3; `daml/released/MANIFEST.md`; `docs/plan/acceptance.md` on main (`64a80db9`) had no R1 upload row; `dpm upgrade-check` with tickets kept at 0.1.3 exits 1 with `KNOWN_PACKAGE_VERSION`.
- **Rule:** as in K-235, nothing of R1 was uploaded, so main 0.5.2 replaces 0.5.1 as R1's main and the 0.5.1-based files leave `daml/released/`. Unlike K-235 the dependents bump (tickets 0.1.4, agents 0.2.2, games 0.1.2, cc 0.1.1): rebuilt against a new main they are new content, a participant or `dpm upgrade-check` refuses the same name and version twice, and with the bump each dependent is checked against its 0.5.1-set build and a sandbox that loaded the old set can take the new one as an upgrade. `abu-pm-governance` (never released, LocalNet-only) points at main 0.5.2 and keeps 0.1.0.
- **User-visible:** none; Abu uploads the five files `devnet-r1.md` step 5 now names.
- **Approval:** default; overrulable.

### K-317 — A private call lives only in the private list; Cash out is for 0.5.1 receipts only
- **Date / owner:** 2026-10-06 · Claude (lane C2e).
- **Evidence:** §4, §5; `packages/db/src/idx/read.ts`, `seat-activity.ts`, `read-private-history.test.ts`; `web/src/features/private/position.ts` (+ test); `services/ops/src/actors/venue/private-route.ts`.
- **Rule:** the seat's history reads (fills, exits, receipts) and its own inbox (fills, settlements) leave out legs tagged `private` and receipts paid into `private`, so neither the Portfolio's history nor the inbox shows a win the public balance did not receive; the private list is the one place a private call appears (K-266). A receipt paid into `private` is "credited" at settlement; `/api/private/cashout` answers `done` and moves nothing; ops refuses to cash it out (`already-claimed`), since moving it again would spend the seat's public cash. A receipt from the 0.5.1 engine still cashes out once, as in C8d.
- **User-visible:** private calls are absent from Portfolio history and the activity inbox; the private list's foot and the ticket note say the payout comes back by itself.
- **Approval:** default; overrulable.
