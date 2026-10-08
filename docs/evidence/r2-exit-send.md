# R2: the resting exit and credit transfers, 8 Oct 2026 (local sandbox)

Revamp step 4. A seat leaves a standing order to sell its side of a Window (trailing stop, stop, take-profit) that the venue fills on the ledger at its own bid, never below the floor the seat signed, even with the seat's tab closed; Close on a position with an armed exit is one venue command; seats send each other credits as offers the receiver accepts. Nothing here has run on Noders yet: the DAR waits for Abu's Console upload (`docs/plan/runbooks/devnet-r2.md`).

## What was built

| Layer | What | Where |
|---|---|---|
| Daml | new package `abu-pm-seat` 0.1.0 on main 0.5.2: `RestingExit` (signed by the owner alone, the venue observes; `RestExit_Fill` with partial fills that keep the rest resting, `_Ratchet` only in the owner's favour, `_Cancel`, `_Expire`, `_Withdraw`) and `TransferDesk` (venue-signed, a flexible-controller offer choice disclosed to each sender) → `CashTransferOffer` (`Offer_Accept`, `_Reject`, `_Withdraw`) | `daml/abu-pm-seat/daml/PM/Seat/` |
| Ops | the `exits` actor: trails followed in memory and ratcheted on the ledger in steps, stops and take-profits filled at the venue's bid (only the ladder levels at or above the floor), sweeps; `POST /internal/exits/close`; creates the `TransferDesk` once; idles while the package is not on the participant | `services/ops/src/actors/exit-keeper/` |
| Seat | `GET/POST /api/ledger/exits`, `…/exits/cancel`, `…/exits/<cid>/close`, `GET/POST /api/ledger/transfers`, `…/transfers/<cid>`; reads answer `deployed: false` before the upload | `packages/markets/src/server/seat-pkg.ts`, `web/src/app/api/ledger/{exits,transfers}/` |
| App | TRAIL on the ledger for a live seat ("On the ledger · fills with this tab closed"), Close through an armed exit, the TP / SL sheet, a toast when the venue fills an exit, Send in the Account sheet (seat id to copy, waiting transfers with Accept / Reject / Take back) | `web/src/features/terminal/{exits,ui/sheets/ExitSheet.tsx,ui/sheets/SendPanel.tsx}` |
| Prices | the CC feed's USDT→USD rate falls back to Bybit's USDC/USDT when Coinbase cannot be reached (it refused this Mac for hours on 7–8 Oct, which left CC without a spot) | `services/ops/src/prices/bybit.ts` |

## Gates

| Gate | Result |
|---|---|
| `dpm test` in `daml/pm-tests` | 275 scripts ok, 0 failed; new: `Test.Seat.Exit` 13 (trail fill of a whole position with the pair conserved, partial fill splitting the last leg and the rest resting, floor, take-profit-only, Down trail, ratchet rules, only the owner's legs of that Window and side, private legs refused, who may do what, shapes, expiry and withdraw, leg sold elsewhere first, privacy) and `Test.Seat.Send` 5 (send and accept, reject and withdraw give it back, refusals including private cash and a desk not disclosed, who may end an offer, privacy) |
| Reproducible build | a clean copy of `daml/` builds `abu-pm-seat-0.1.0.dar` to the same bytes, and the five R1 files byte for byte as released |
| Unit tests | exit rule 15, the terminal's exit plan 5, CC rate fallback 2 |
| Repo | `pnpm typecheck` clean except mobile's three files that were already broken on main (Marquee, TutorialCard, BoardControls); `pnpm invariants` 0 errors, 0 warnings; `pnpm test` 2,820 passed |

## The run

- **Sandbox.** `dpm sandbox` (Canton 3.5.17) on 7671–7676, JSON API :7675, `JAVA_OPTS=-Xmx1536m`, started fresh.
- **DARs.** R1's five plus `abu-pm-seat-0.1.0`, uploaded by `bootstrap-local.ts --seats 4 --lanes crypto` then `--lanes cc`.
- **Ops.** `scripts/drive/ops-local.ts` on :8771, `ROLLER_SERIES=CC-5m,CC-5m_3,CC-2m,CC-2m_1`, Postgres `pm_r2`. BTC Windows could not open: Coinbase and Kraken refused this Mac (curl timeouts), so the open print never had a quorum. CC settles on RedStone (reachable); its spot needed the new USDT fallback.
- **Web.** `next dev -p 3137`.

### `scripts/drive/exit-send-it.ts`: 25 of 25 checks

| Check | Detail |
|---|---|
| lease alice | party owarine-user… |
| lease bob | party owarine-user… |
| seats funded | alice 1000, bob 1000 credits |
| alice buys UP | CC-5m:2, cost 1.951121, update 1220ea2ce2f51b1c53e9ec9da946dd523181a3a75348bd173645b94c0edd63e46b55 |
| the seat package is on the participant | deployed true, 0 exits |
| alice arms a stop above the spot (one create, signed by her alone) | exit b02e1fd8-1979-4103-9a82-cecd96666359 over 6 lots, update 1220974fea9853f6c5ea2abaa8654f99c6fd914f11bd275bac4d8b33bf60d7ade626 |
| the venue sells the stop at its bid: exit and legs gone, sale cash hers | alice +1.56 credits (cost 1.951121) |
| alice buys UP again | CC-5m:2, update 1220d2669655abd4c976ebbca58bf5e8b5853431bae45517768b62c52bda651e0a7d |
| alice arms a 20 % trail from the lowest level (10⁻⁸) | exit 8cdf5dfa-192f-483e-bc16-f4527fcf5aa3, update 1220c1502c99508d46c50648e5ec97e4d4f87513296898711053d31c6522f17c7d92 |
| the venue ratchets the trail on the ledger (same ref, level in her favour only) | level 10⁻⁸ → $0.094375 (spot less 20 %), exit 00f7e44a83d7… |
| bob's exits read shows none of alice's | 0 exits as bob |
| bob cannot close alice's exit | bob's close → gone |
| Close through the armed exit: one venue command at the bid | sold 6 lots @ 277 for 1.662 in 407 ms, update 1220306c04eb1f2a1152e1685ce79a10d2602ae6d18a98efd27baf9b9669524e8147 |
| a 999-tick take-profit rests | exit c4607b59-dc81-4c69-b5f1-2e074ba699fb, update 1220ec53ed88cd4b4c6ce29e07aa55491edc8a2d5ecde635625666fcb3930d05afe3 |
| …and does not fill below its price | exit and legs still there after 3 s |
| the seat disarms it alone | cancelled 1, update 1220dd6fe9d198aa2c3c6702d8ce7802fe09255176835c16791a8abb30c31e3cb02d |
| a 1-tick take-profit fills at the venue's bid | alice +1.13 credits |
| alice sends bob 1 credit | offer 00f4887af9f8…, update 1220bbdd82c6373ce0e6408937640eb94276788c3e0c6c4976807893962b86e7750d |
| bob sees it incoming with its memo | 1 open transfer(s) as bob |
| bob accepts: his cash rises by exactly 1 | credited 1, update 1220c568bded46f73966f7016f0c31a45f59411cf2ec46ee4afc723317eef72265ea |
| bob rejects: it goes back to alice | update 1220fb641815ad8348afde56ecee6f32d0cab9e45e97fd5ec9746ebf2bac8f0d4162 |
| bob cannot withdraw alice's offer | bob's withdraw → refused |
| alice withdraws hers | update 122017817795a4353005f7edaa51a72c64563f1ebce9685d85926938cd3eaa044e51 |
| a seat cannot send to itself | → refused |
| credits are conserved across the two seats | alice 997.771651 + bob 1001 = 1998.771651 |

Close through the armed exit took 407 ms on the local sandbox, one venue command (`RestExit_Fill`) instead of an exit quote and an accept; on DevNet one command measured ≈ 3.5–9 s, so this halves Close there (`context/13-revamp/AVAILABILITY-LATENCY-2026-10-07.md` §4, option D).

### In the browser (Browser pane, :3137, a guest seat)

Took a seat, bought UP on CC 2m, opened the position's **TP / SL** sheet, set +5 credits and a stop at $0.10: the sheet read back "Sells when Close pays 54.44 or more", the toast said "TP / SL on the ledger · CC", and the row showed "Exit: stop $0.1000 · take 95.5¢". When the Window locked the keeper withdrew the exit and the row went back to "TP / SL". Account → Transfer → sent 2 credits with the memo "lunch": "Sent 2 credits", and the waiting list showed "−2 to seat-1… · lunch · Take back".

## Limits, said plainly

- **The ledger bounds the price, not the timing.** It has no spot: when a stop or trail fires is the venue's word against the live price. The level is on the ledger and moves only in the seat's favour, so a fill can be checked afterwards against public prints.
- **A trail never sells below break-even less the slippage tolerance.** A price that gaps through that floor holds the position (it rides to settlement) instead of dumping it. A fixed stop sells at the bid.
- **One fill sells at most 8 legs**, largest first; a seat with more keeps the rest, and the exit keeps resting for them.
- **Close is one command only on a position with an armed exit.** Without one it is still the exit quote and the accept.
