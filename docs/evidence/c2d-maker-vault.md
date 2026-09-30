# C2d maker vault on the ledger, 2026-09-30 (local sandbox)

K-092's design, built as K-200 and K-201: the maker vault is a book inside the venue (`reserve:maker`). It has its own on-ledger NAV (`Maker_PublishNav`), quotes drawn from its own cash, and every position that turns back into cash leaves a `BookReceipt`.

## Setup

- **Sandbox.** Canton sandbox 3.5.17 (dpm), with ledger API :7581, admin :7582, sequencer :7583/:7584, **JSON API :7585** and mediator :7586. It was started fresh for the final runs: the first sandbox carried the pre-K-201 `abu-pm-main` 0.5.0, and the same name and version cannot be uploaded twice.
- **DARs.** `abu-pm-main-0.5.0`, `abu-pm-tickets-0.1.3`, `abu-pm-games-0.1.1` and `abu-pm-agents-0.2.1`, all uploaded by the bootstrap.
- **Bootstrap.** `scripts/bootstrap-local.ts --seats 4 --users alice,bob`, with a lane-local parties file in the scratchpad. For the maker vault (`bootstrap-maker.ts`) it:
  - created the `MakerDesk` and the `maker` `NavStatement`;
  - seeded the vault from the LP with 10,000 credits in four supplies, which gave four `reserve:maker` shards;
  - published the first statement on ledger (NAV #1: 10,000 / 10,000).
- **Ops.** `scripts/drive/ops-local.ts` with `MAKER_MODE=vault`, `DRY_RUN=0`, HTTP :8787, and the projector on Postgres `pm_c2d`. The maker's defaults are the reference's `MakerParams`, with lanes of 300, 900 and 3,600 s on every asset.
- **Web.** `next build --webpack` plus `next start -p 3180`.
- **Browser.** One headless Chrome page over CDP, with its own profile on :9338.
- **Keys.** None.
- **Drive.** `scripts/drive/maker-vault-it.ts` calls ops' HMAC routes as the web does, and accepts as the seats (`seat-1` is the provider, `seat-2` the taker). At every step it checks the published statement against what the ledger holds for the book.
- **Host.** Load average 80–115 on 10 cores throughout. LEDGER_SUBMIT_TIMEOUT_MS was raised to 240 s: the first bootstrap attempt hit `SUBMISSION_ALREADY_IN_FLIGHT` on a client retry at the default timeout, and a single re-run completed it.

## Run A: supply → quotes from the vault's cash → accept → merge → settle → NAV → withdraw (ALL PASS)

| step | what the ledger shows | update |
|---|---|---|
| supply 500 (seat-1 accepts) | `Nav_IssueSupply` 500 → 500 shares at NAV 1.0000. The statement then reads 10,500 / 10,500 (NAV #3) | `12208c01aacb5c789119e8ea0edde5ed439d3b0d4da4d155cf335822982a2787b6e7` |
| quote Up, BTC-5m:2 | `Desk_IssueQuote` on a `reserve:maker` shard. The Quote carries `book = reserve:maker` | `1220920e61e8b8585c166205e2afbceb9f2eeb480ebac8154a6173c26ec3069572fc` |
| accept Up (seat-2) | the venue's leg is the book's (`beneficiaryRef = reserve:maker`, read as the venue: the taker cannot see it) | `1220199a0e314a22d6df25cfc375633d3f2858c3ef1cb25eceba00c4b286bcf6ac45` |
| quote + accept Down | as above: issue `122098dcdf839af36c54d7ee6240d6b7c724ca09f5f125aadc6d8e3ff7957d304533`, then the accept | `12204ab97e2ea32e463acef088fbe22ee2faf3380590537305f85de5624aac1186ea` |
| after the accepts | book cash 10,500 → 10,491.54. It holds Down 9 and Up 9, and the NAV is unchanged at 10,500 (positions at cost) | — |
| merge crank (seat-2's tap) | `Leg_Merge` with a `BookReceipt merged` 8.46 → 8.46. The NAV is still 10,500 (NAV #4) | `1220c0b83de3bc2692a500b38be9b937eeb1b4cdd4178f4e0478a21e37607c0a3874` |
| resolve + settle | the settler's `Desk_SettleBatch`, then `Residual_Settle` with a `BookReceipt residual` 0 → 0.54 | `1220b516d0f3b1962f95680bb4d4721d0bc2d1b46c100a5f9782ea0ec4bf81d9eab6`, `1220974a46c1e404d4896d21271eacf0677c272f7cf4ef421bf83886234e6b880ecb` |
| NAV after settle | 10,500.54 / 10,500 (NAV #10): it moved by exactly the Window's realised +0.54 (the spread) | `12206e273efa60c3aab131d9617a474ee47f405f89fcb3af02f5cce579a3e15d490d` |
| withdraw all (seat-1) | `Nav_IssueWithdraw` from a `reserve:maker` shard: 500 shares → 500.02 | `1220e6cb6cf2a86c2180ca51417ff99e79e65f8eb195a26896cd5d4546f15aecd6d6` (issue), `122097105c31a856b6d42c6f6dfd51f11e8c225761d45e132360c952ee3121d270a8` (accept) |
| after withdraw | 10,000.51 / 10,000 (NAV #11). The vault's `reserve:maker` cash on the ledger (10,000.514286) equals the statement's liquid figure | — |

## Run C: unequal sizes, so the merge splits first (K-201, ALL PASS)

- **Accepts.** On BTC-5m:4 the book took Down 15 lots (backing 12.06) and Up 4 (backing 0.572):
  - `1220d50b8e65a5ddab86b032ce35c46341c87bfbe930ea18cfe4750b37b9e4ed73ba`
  - `1220e713ade60d0c97dd957accd7f78cd034c9c1ab92335fb7a405d76a2b343b663b`
- **Merge crank.** It answered `merged 1 (after 1 split)`:
  - **`Leg_Split`** cut Down 15 into 4 (3.216) and 11 (8.844): `122030e415d04602430288ebdad04b9dd2728e7bdcf9e7a629398d43b6074f33c05b`
  - **`Leg_Merge`** netted Down 4 against Up 4, releasing 3.788, with a residual owed 0.212 at resolution: `1220dff75fe3b18785c2295883eea64a7bd1832d8052b118fbee34e43cba610c3295`
  - The NAV did not move at the merge: 10,504.90 at both NAV #19 and NAV #20.
- **Settle.** The settler settled the remaining Down 11 (`BookReceipt settled` 8.844 → 11.00): `1220d924c54b7d7526ca0e7ad4215c8e3a75ab052860d3d7657fe05ea52c95793059`. The residual paid 0.212: `12204e7b0be46c14faa63217cbea1f9cbd0ce4684f44be446e3d3f6882750dd44870`.
- **NAV.** 10,504.90 → 10,507.27 (NAV #24), exactly the realised +2.36.
- **Withdraw.** 499.75 shares → 500.11 (`122083a9882b8b935358c8dc2cf1cbbc8a9cd61e0fec67c154456279e16578a4da11`). The ledger's cash equals the statement's liquid figure (10,007.162923).

## Run B: the vault's bounds hold (4 checks FAIL as designed)

The Down side asked for 29 lots, above the reference's `maxQuantityRaw` (20 lots). The issuer therefore quoted it from the venue desk, not from the vault: the Quote has no `book`, and the venue leg is not the book's. The drive's "the Quote is the vault's" checks reported this as FAIL, and the drive's stakes were then set inside the bound for run C. The Up 7 lots it did take settled into the vault: +4.61, receipt `settled 2.387 → 7.00`, update `1220dee69c8796197c15c2071a7ca7ec737ad63391c1754ab95e96b2748353045c47`.

## The statement on the ledger

- **Publishes.** 25 `Maker_PublishNav` exercises on this sandbox, from `122010dd…5266` (bootstrap, 03:32:29Z) to `1220cfa3…5612` (03:50:49Z).
- **Share price.** It went from 1.0000 to 1.0007 over the three runs. It never rose at a quote, an accept or a merge, only when a Window resolved.
- **An expired, unresolved Window counts at 0.** The 390 light screenshot was taken in the gap between BTC-5m:4's close and its Resolution, and shows the Window's `Deployed 0.00` with `closed · settle`.

## Earlier run (first sandbox, before K-201)

It gave the same cycle, ALL PASS apart from the drive's own check, which read the venue's leg from the taker's transaction (Canton privacy hides it; fixed to read as the venue):
- **Loss/gain Window:** +1.81, update `1220d5fb…a97d`.
- **Pair merge:** +0.54, updates `1220713c…06b2` and `122041c9…0f52`.

The same run showed the gap K-201 closes: the book held Up 6 / Down 18 on one Window, the tab said "6 sets paired · merge", and the crank answered "nothing to merge".

## Screens (`docs/evidence/ux/c2d/`)

`maker-{390,1440}-{dark,light}.png` show `/earn`'s maker tab against the live vault (`next start` :3180) while run C's Window was open:
- the hero reads "Live · maker vault", 1.0004 / share, a vault value of 10,504.90 and utilization 0.1%;
- §02 reads BTC 5m, 8.84 deployed, 0 / 11 held, "11 DOWN unpaired", with the two settled Windows at +0.54 and +4.61.

No seat was taken in the browser: the supply and your-position cards show the reference's "Take a seat" state. Supply and withdraw ran through ops' routes as the seats, in the drive above. The iPhone app (`mobile/src/features/earn/MakerEarn.tsx`) renders the same hooks (`useMakerVault`, `useMakerWindows`, `useMakerHistory`, `useMakerShares`, `useEarnWrites`); it was typechecked, not run.

## Gates

- **Daml:** `dpm build --all && (cd pm-tests && dpm test)`: 186 scripts ok, 0 failed. `Test.Maker` has 10 scripts: cycle loss, cycle gain, void returns, locked not withdrawable, never overstates, refusals, exactly-once, residual, stale refund, split-merge.
- **Upgrade:** `dpm upgrade-check --both` passes with 0 warnings for main 0.4.0 → 0.5.0, tickets 0.1.2 → 0.1.3, agents 0.2.0 → 0.2.1 and games 0.1.0 → 0.1.1. Each lineage ends "Typechecking upgrades for lineage of package-name … succeeded".
- **TS:** `pnpm typecheck` and `pnpm invariants` are green; `pnpm test` passes 2,069 tests in 245 files (25 skipped).

## Seen, not changed

- **"N quotes" counts positions.** A Window's quote count is the book's positions: legs, plus two per merge. After a split one quote reads as two positions, so run C's Window reads "3 quotes" for 2 accepts. A merge receipt names only one of its two pairs, so the count cannot be recovered exactly from the ledger.
- **The settle crank rarely has work.** The venue's settler settles every leg at resolution, usually before a seat's tap, so the crank answers "nothing on this Window is ready to settle". That is the same outcome.
