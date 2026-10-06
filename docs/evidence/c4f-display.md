# C4f: money and state shown truthfully on web and phone (2026-10-06)

Lane C4f, branch `slice/C4f-display` from `main` at `cc6757bb`, with `main` at `0d95f46f` (C2e, abu-pm-main 0.5.2) merged in. Stage C4, decisions K-325 – K-330. It fixes items 3–7 of `c11b-ios-sim.md` ("Found, not fixed here") and its two side-by-side layout items, on web and phone. It builds on C9e (`c9e-c13b-sweep.md`) and does not redo it. Screens are in `docs/evidence/ux/c4f/`.

## Local stack

| Piece | What ran |
|---|---|
| Sandbox | `dpm sandbox` (Canton 3.5.17), ports 7600–7605, **JSON API :7604**, `JAVA_OPTS=-Xmx1536m` |
| Bootstrap | `bootstrap-local.ts --lanes crypto --users alice,bob,outsider --seats 4` with the release set in `daml/released/`. The first run used main 0.5.1. After the merge the sandbox was rebuilt from 0.5.2, tickets 0.1.4, agents 0.2.2 and games 0.1.2, with cc 0.1.1 uploaded by `POST /v2/dars` (200). |
| Ops | `drive/ops-local.ts` on :8760, `DRY_RUN=0`, `ROLLER_SERIES=BTC-1m,ETH-1m,BTC-5m`, projector on Postgres `pm_c4f`, `OPS_ENV_FILES=0` |
| Web | `next build --webpack`, then `next start -p 3160`, `NEXT_PUBLIC_CANTON_NETWORK=localnet`. Throwaway secrets lived in a mode-600 scratch file. |
| Holder | `scripts/drive/c4f-money.ts` (C4f.8, C4f.11) holds the seat from the command line, as the phone did in C11b. It uses the web's own routes to take a seat, place calls, freeze ops across a close to make a void, show a link code, allow the key that joins, and reset. It prints the party's `VenueCash`, legs and `SettlementReceipt`s, and the record and verdicts as the screens compute them. |
| Joined device | Headless Chrome (playwright-core, scratchpad) on a persistent profile. Its seat key lives in the profile's IndexedDB, and it joins through `/seat/link` like any browser. The Browser pane joined the same way for the first-run observations. |

## What the screens showed against the ledger

**Seat 4** (`agari-user-seat-4-…`, 0.5.2 sandbox, final build). Five calls: four through the web routes, one through the web ticket. The void was made by freezing ops (SIGSTOP 11:24:55 → SIGCONT 11:25:45Z) across BTC-1m:70's close; it voided with reason `MissingPrint(CloseSlot)`.

| Window | Call | Fill update | Receipt: cost / paid | Receipt update |
|---|---|---|---|---|
| BTC-1m:67 | Up 909, 1 lot, fee 828 (placed from the ticket) | `12208e8b…09f` | 909,828 / 1,000,000 | `1220860c…897c` |
| BTC-1m:68 | Up 605, 1 lot, fee 2,390 | `12207833…c9b` | 607,390 / 1,000,000 | `122066cd…2d28` |
| BTC-1m:69 | Down 529, 1 lot, fee 2,492 | `1220dc1a…078` | 531,492 / 1,000,000 | `1220a4be…1900` |
| BTC-1m:70 | Up 507, 1 lot, fee 2,500 | `1220456b…608` | **void** 509,500 / 509,500 | `1220d654…8b9c` |
| BTC-5m:15 | Down 586, 1 lot, fee 2,427 | `122095ec…58e` | 588,427 / 1,000,000 | `1220b65a…675c` |

- **Ledger.** The party holds 1,001,362,863 base in 6 `VenueCash`. The receipts' paid − cost is +1,362,863, so 1,000,000,000 + 1,362,863 = 1,001,362,863 exactly. `/me/balance` returned `spendable 1001.362863`.
- **Joined device, `/portfolio`** (`portfolio-*`):
  - **Your balance:** 1,001.36. Demo credits 1,001.36; open positions 0.00; To collect 0.00; 5 settled.
  - **To collect:** "Nothing to claim". There is no Vault-credit row.
  - **Your record:** **+1.36**, 5 settled, win rate 100 %.
- **Verdict** (`verdict-live-390-dark`). BTC-1m:67, captured on the web the second it settled: "it came in", Net P&L **+0.09**, Stake 0.90 → Payout 1.00, +9 %. The cost is the receipt's 909,828, with no "No entry cost on record". The drive's `record` step gives the same figures for every Window: each verdict's cost equals the receipt's cost, a void returns cost with P&L 0, and the net is 1,362,863 base.

**Seat 1** (first run on the merged build). Eight calls: 6 won, 2 lost, 1 void across BTC-1m and BTC-5m.
- **Fills:** `1220bc17…170`, `12208848…5f6`, `12203712…953`, `12209f8a…2a3`, `122028a7…794`, `122031e9…ec3`, `1220a0a3…631`, `122091e8…6c624`.
- **Receipts:** cost 6,099,127, paid 6,573,450.
- **Totals:** ledger 1,000,474,323. The record read **+0.47** (474,323 base). The 2-lot Down win on BTC-1m:10 showed "Won +1.01 credits · payout 2.00" live (cost 982,998).

**Before any fix, seat 1 on the first sandbox** (0.5.1, `main` at `cc6757bb`). Three settled calls: a loss, a win, and a void made the same way. The ledger moved −629,126 base. The web showed:
- the balance 999.37 next to a record of **"−0.62"**: a truncated loss;
- "Vault credit — withdrawal · 999.37 credits sits in your Trading Balance" under To collect;
- a Trading Balance panel reading Seat 999.37 and Available 999.37 (`before-trading-balance-seat-and-available`);
- "This is Canton DevNet" on a LocalNet build (`before-welcome-devnet-on-localnet`).

After the holder's reset (`DELETE /api/seat` → `none`, then `/me/balance` 401), the joined browser kept showing 999.79 (`before-joined-after-reset-shows-999.79`).

## What was broken, and is fixed (one commit each)

| Commit | Item | Was | Fix | Test |
|---|---|---|---|---|
| `b9262c85` C4f.1 | 3, stale balance | `withReading` kept the last good value, marked stale, on any failed refresh, including a `signer-required` refusal | A refusal of who is asking is the error arm and forgets the last value | `wallet.gone.test.ts` (3): 2 fail on the old code |
| `fd49f172` C4f.10 | 3, live | Still 1,000.00 for a minute of 401s on the joined device. `useReadingQuery` sent the reading's error-arm diagnosis through `diagnose()`, which reads any non-`ReadingError` object as `unknown` (retryable). So every domain answer was thrown, and TanStack kept the last data. | The error arm is classified by its own kind | `reading-query.test.ts` (3): 1 fails on the old code |
| `4443e7c1` C4f.12 (`useBalancePlate`) | 3, live | Balance gone, but "1 settled" and the record stayed until the history's 5-minute poll | A `signer-required` balance read invalidates every query keyed by that address (web and phone) | live, below |
| `1aae1f79` C4f.5 | 4, record vs fees | C11b's −0.82 / −1.69 left out the fee. C9e's replay counts it on `main`, but the record still read "−0.62" beside a balance that had moved 0.63, because `formatBaseUnits` truncated a loss toward zero | Money floors past the shown places, so a negative shows the whole cents it took. Positive values are unchanged. | `format.test.ts` (3); `record-balance.test.ts` (2) pins the first run's loss, win and void to the `VenueCash` movement |
| `6b347d0e`, `f0f73cb5` C4f.2, C4f.9 | 5, verdict | Cost basis came from open positions, which no longer hold a settled Window. C9e's fallback did not cover a Window sold back before the close, and could announce before the receipt reached the history | The cost is the settled round's stake less proceeds: the receipt's backing + fee, i.e. `toVerdict`'s basis. A held Window waits for it, re-reading the history every 3 s, for at most 30 s. A private call (K-317) never enters the history, so the bound ends its wait. | `settled-cost.test.ts` (7) |
| `3fe065c5` C4f.6 | 6, Vault credit | The agents vault reports the seat's own cash as `availableBase`. To collect called it a credit to withdraw, and `vault-withdraw` is refused as the same cash. The phone's plate still had the Solana-era legs "In your seat / In your Trading Balance 0.00". | No credit line on web or phone (K-325). The phone plate is ported to web's C7a plate: balance sheet figure, ready to bet, Demo credits / Open positions / To collect. | typecheck, export, live web |
| `d3795572`, `be6d0bd4` C4f.3, C4f.4 | 7, network label | "THE CALL · CANTON DEVNET", "This is Canton DevNet", and the seat picker's "Canton DevNet" on LocalNet; a void card said "BOTH SIDES PAID 0.5" | `networkLabel()` in `@agari/markets/chain` reads the runtime's network: web `NEXT_PUBLIC_CANTON_NETWORK`, phone `EXPO_PUBLIC_CANTON_NETWORK`, then the build's, then DevNet. A void card says "STAKE AND FEE RETURNED" (K-290). | `chain.test.ts` (2), `network-copy.test.ts` (3) |
| `931c36c9` C4f.7 | side by side | The phone cut "04 · Who sees what on t…"; web at 390 pushed "You" past the card | The phone title wraps beside its index, as web's h2 does. Web's switcher tabs take the desk kit's own narrow rules (cockpit.css ≤ 560 / ≤ 440, already on the phone). | `who-sees-what-*`: all four tabs inside the list at 320 (284 / 284), 390 (354 / 354) and 1440 |

**Live proof of item 3 on the final build** (`joined-reset-before`, `joined-reset-after`). The holder reset seat 4 at 11:33:29. At 11:33:42 the joined device's next reads answered 401. By 11:33:45:
- the header read "—";
- the plate read 0.00 (the reference's unread-balance figure) with "Get demo credits";
- the record read "0 settled".

Before the reset, the same screen showed 1,001.36 and +1.36 over 5 settled.

## Gates

| Gate | Result |
|---|---|
| `pnpm typecheck` | green, all projects |
| `pnpm invariants` | 0 errors, 0 warnings |
| `vitest` (whole suite) | 350 files and 2,619 tests passed; 14 files and 65 tests skipped (Postgres). New: 23 tests in 7 files |
| Web routes at 390 and 1440, light and dark | `/portfolio`, `/markets`, the Window page's switcher (also at 320), the welcome, `/dev/share`: `scrollWidth − innerWidth = 0` on every capture |
| `pnpm --filter @agari/mobile typecheck` (Node 25.9.0) | green |
| `expo export --platform ios` (Node 25.9.0, `EXPO_OFFLINE=1`) | green: 5,580 modules, 24 MB, 26 s |

## What still does not work here, and why

- **The phone's plate and section header were not seen on a device or simulator.** This lane had none. They are typechecked, exported, and literal ports of web's.
- **A gone seat's plate reads 0.00 with "Get demo credits".** The header reads "—". The 0.00 is the reference's figure for an unread balance (`totalUnknown`); the seat's money is no longer shown.
- **The Trading Balance panel still lists Seat and Available as the same figure.** That is the C8f model (K-087: the seat's cash is the Trading Balance). It is not false, so it is left for Abu's eye.

## Decisions

### K-325 — To collect lists no Trading Balance credit; the phone's plate is web's C7a plate (C4f)
- **Date / owner:** 2026-10-06 · Claude (C4f).
- **Evidence:** C11b item 6. The first run here: 999.37 "sits in your Trading Balance" beside Demo credits 999.37. `agents-lane.ts`: `vault-withdraw` is refused with `SAME_CASH`.
- **Rule:**
  - The seat's `VenueCash` is the Trading Balance (K-087), so the vault read's available cash is never a credit to withdraw, and `VaultCreditRows` lists only vault-held rounds still to settle.
  - The phone's `LedgerPlate` follows web's C7a plate: the balance sheet, ready to bet, and the legs Demo credits / Open positions / To collect.
- **User-visible:** no false withdrawal row; the phone plate matches web.
- **Approval:** default; overrulable.

### K-326 — A seat that refuses the caller shows none of its money (C4f)
- **Date / owner:** 2026-10-06 · Claude (C4f).
- **Evidence:** C11b item 3; `wallet.gone.test.ts`, `reading-query.test.ts`; the live reset above.
- **Rule:**
  - A `signer-required` refresh is the error arm and forgets the last good value.
  - A reading's error arm is classified by its own kind: domain answers resolve, outages retry.
  - A refused balance read re-reads every query keyed by that address.
- **User-visible:** after a reset on another device, the joined device shows "—" and 0 settled within one poll.
- **Approval:** default; overrulable.

### K-327 — A settled Window's verdict takes its cost from the ledger's record and waits for it briefly (C4f)
- **Date / owner:** 2026-10-06 · Claude (C4f).
- **Evidence:** C11b item 5; `settled-cost.test.ts`; the live verdict (+0.09 on cost 909,828).
- **Rule:** cost basis = the settled round's stake − proceeds (its settlement receipts' backing + fee). A held, non-void Window without it waits up to 30 s, re-reading the history every 3 s, then says the cost is unread.
- **User-visible:** "No entry cost on record" appears only when the record truly lacks it.
- **Approval:** default; overrulable.

### K-328 — Money floors past the shown places (C4f)
- **Date / owner:** 2026-10-06 · Claude (C4f).
- **Evidence:** the record read "−0.62" for −629,126 base while the balance went 1,000.00 → 999.37; `format.test.ts`.
- **Rule:** `formatBaseUnits` rounds toward −∞ at `maxDp`. A positive value is truncated, as before. A cent-exact start, the balance after and the change between them agree on screen.
- **User-visible:** a loss shows the whole cents it took (−0.63, not −0.62).
- **Approval:** default; overrulable.

### K-329 — Every sentence that names the network reads the configured one (C4f)
- **Date / owner:** 2026-10-06 · Claude (C4f).
- **Evidence:** C11b item 7; `chain.test.ts`, `network-copy.test.ts`; `welcome-*` reads "This is Canton LocalNet".
- **Rule:** `networkLabel()` (`@agari/markets/chain`) is the read runtime's network, else the build's `NEXT_PUBLIC_CANTON_NETWORK`, else DevNet. The Call, the share stamps and posts, the tutorial and the seat picker read it. Sentences about the planned DevNet release (roadmap, "not yet on DevNet") are statements about DevNet and stay.
- **User-visible:** a LocalNet build says Canton LocalNet; a void card says the stake and fee came back.
- **Approval:** default; overrulable.

### K-330 — Section titles wrap on the phone; the switcher's tabs take the desk kit's narrow rules on web (C4f)
- **Date / owner:** 2026-10-06 · Claude (C4f).
- **Evidence:** C11b side by side (K-314 listed them for Abu; this lane's brief ordered the fix); `who-sees-what-320/390/1440-*`.
- **Rule:**
  - The phone's `SectionHeader` title and eyebrow wrap (no `numberOfLines`), as web's do.
  - `.cx-switcher` tabs share the row at ≤ 560 px and drop the count pills at ≤ 440 px, as `cockpit.css` and the phone's `UnderlineTabs` already do.
- **User-visible:** "Who sees what on the ledger" is whole on the phone; all four tabs fit at 320 and 390 on web.
- **Approval:** default; overrulable.

## Owner-only files touched

`web/src/providers/wallet/copy.ts` (C4f.4, its own commit): the seat picker's "Canton DevNet" group label now reads `networkLabel()`.

## Cleanup

- **Stopped by pid:** web, ops and the sandbox (`dpm` and its JVM).
- **Dropped:** `pm_c4f`.
- **Moved to the Trash:** `web/.next`.
- **Scratchpad:** the headless profile, logs, parties file and throwaway secrets stay there and go with the session.
