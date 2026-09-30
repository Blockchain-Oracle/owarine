# C7b — the Canton Coin money rail (evidence)

Date: 2026-09-30 · lane C7b (`slice/C7b-canton-coin`, from main `1b41384`, clean) · decisions K-245 to K-248 · parity C-DAML-06 and C-MKT-12 (both Shell; `capabilities.json` keeps them `not-live`).

**One sentence.** Real value can now go in and out of the venue through the Canton token standard (CIP-56): a deposit is the owner's own pending transfer, accepted and credited in one transaction; a withdrawal is a token-standard transfer back; the venue publishes an auditor-visible statement of the coin it holds against the coin it owes. All of it is proved in Daml Script against the token standard's own test registry and in unit tests against a fake ledger and a fake registry. **Nothing here has touched a node, a wallet, Grofty or a real registry**, and the path is `not-live` in code until DevNet proves it.

## What was built

| Piece | Where | What it is |
|---|---|---|
| `abu-pm-cc` 0.1.0 | `daml/abu-pm-cc/` (added to `daml/multi-package.yaml`) | A separate package on `abu-pm-main` 0.5.0 and the token standard V1 interfaces. `abu-pm-main` is untouched. |
| Vendored token standard | `daml/vendor/splice/` (+ `THIRD_PARTY_NOTICES.md`) | Four Splice DARs byte for byte, with hashes, package ids and the Apache-2.0 licence: `splice-api-token-{metadata,holding,transfer-instruction}-v1` 1.0.0 and the token standard's own mock registry `splice-test-token-v1` 1.0.1 (tests only, never uploaded). Source: `canton-network/splice` at `fda19e6`. |
| Money-gate tests | `daml/pm-tests/daml/Test/CC/` | 31 Daml Script tests (12 deposit, 12 withdraw, 7 reserve and privacy incl. two seeded random sequences) plus two tiny in-repo registries for the failure paths the mock cannot produce. |
| Bindings | `packages/daml-clients/` (`Cc`, `CC_TEMPLATE_IDS`, `CIP56_INTERFACE_IDS`) | `pnpm codegen:daml` output, committed. |
| The CIP-56 edge | `packages/ledger/src/units.ts`, `client.ts` | Decimal to atomic to cash units, exact or refused; an `InterfaceFilter` read. The only place `Decimal` appears. |
| The venue's pass | `packages/markets/src/ops/cc/` | Decoders, choice builders, the pure planners (`policy.ts`), the registry client, the history reader, `railPass`. |
| The ops actor | `services/ops/src/actors/cc-rail/` | Opt-in (`OPS_ACTORS=cc-rail`), never on `all`. |
| Seat side | `packages/markets/src/server/cc.ts`, `web/src/app/api/ledger/cc/{,withdraw,deposit}/route.ts` | Status, deposit instruction, withdrawal request; the party only from the lease; the phone's one-request write proof, body through `jsonBody`. |
| Holdings | `packages/markets/src/holdings/`, `web/src/app/api/holdings/route.ts` | Reads the seat's CIP-56 `Holding`s as the leased party. |
| Funds screens | `web/src/features/funding/` (`cc-panel.ts`, `CcRailPanel.tsx`), `mobile/src/components/funding/CcRailCard.tsx` | A "Canton Coin · Not live" card, drawn from one view model, in the web dialog and the phone drawer. |
| The drain | `packages/markets/src/server/seat-holdings.ts` | A Canton Coin claim holds a seat in the drain. |

## How it works

**Listing.** `CcListing` is the venue's published, static offer: instrument (admin party and id), one fixed rate, deposit bounds, open or closed. All its choices are nonconsuming, so nothing contends on a shared contract.

**Deposit** (`Listing_SettleDeposit`, controller: the venue). The owner instructs `TransferFactory_Transfer` (sender: the owner, receiver: the venue); it stays a `TransferInstruction` pending the venue's acceptance. In one transaction the venue accepts it, reads the holdings the registry says it created for the venue, converts them exactly, credits the owner's `VenueCash` through the engine's own `VenueAccount_Credit` (bucket `cc:<listing>`), raises the owner's `CcAllowance` and writes a `CcDeposit` receipt whose `ensure` pins the credit to the coin received. A transfer the registry does not complete, a second settle of the same instruction (its contract is gone), the wrong instrument, account or listing credits nothing.

**Withdrawal** (`CcWithdrawProposal`, then `Proposal_Accept`). The owner creates a proposal (owner-signed, the venue an observer). The venue answers in one transaction: debit exactly the cash through the engine's merge, split and withdraw choices (the owner's authority is the proposal's signatory), lower the allowance (refused beyond it), instruct the transfer, and by the registry's answer record `Completed`, `Sent` (a pending instruction the owner must accept) or `Refunded` (a `Failed` answer restores cash and allowance in the same transaction). `Withdrawal_Refund` takes a pending transfer back when the owner never accepts; `Withdrawal_RefundReturned` restores cash and allowance against returned coin when the owner rejected it.

**Reserve** (`Listing_Attest`). The venue names its unlocked holdings of the instrument and every allowance. The ledger fetches each holding through the `Holding` interface (so each must exist and be the venue's; a foreign, locked or repeated one is refused) and records `heldUnits >= liabilityUnits` as `covered`. A short statement is publishable and says so.

## The rate (K-245)

`unitsPerCoin` cash base units per whole coin, stated on the listing, fixed for its life, dividing 10^10 so every conversion is exact. Default 100,000: **1 Canton Coin = 0.10 credit**, one cash unit = 0.00001 coin; a placeholder for Abu to set from the price of the day real value first moves. A deposit that is not a whole number of cash units is **refused as dust and sent back, never rounded**: rounding down would keep the fraction, rounding up would credit cash the venue holds no coin for. The one rounding in the package is `unitsFloor` on the assets side of a statement, which rounds down. The Decimal to Int conversion is one function (`PM.CC.Units.toAtomic`, mirrored vector for vector by `@agari/ledger` `units.ts`); every bound is a division before any product, and the listing, both receipts and every sum carry an `ensure` bound below Int64.

## The reserve (K-247)

The venue's coin claim is a `CcAllowance` per owner: what was deposited and not taken back. **Winnings and demo credits never raise it**, so the demo economy (the venue mints its own demo cash and pays winners in credits) cannot be redeemed for coin, and the coin the venue holds is claimed only by what was put in. A seat can take back `min(allowance, cash)`. The statement is then a true balance sheet: coin held against the sum of allowances, each side a set of contracts the ledger fetched.

## What is proven, and where

| Claim | Proof | Kind |
|---|---|---|
| Deposit credits exactly the coin received, in the stated bucket; the receipt pins it | `Test.CC.Deposit.testDepositCreditsExactly`, `testSecondDepositRaisesAllowance` | Daml Script on the token standard's test registry |
| Rounding never favours the venue: dust refused, exact steps accepted, the floor only on assets | `testUnitsArithmetic`, `testDustRefused`; `units.test.ts` (same vectors) | Daml Script, unit |
| Overflow: an oversize amount, an unbounded listing, a rate that does not divide 10^10, all refused | `testOverflowBounds`, `testBoundsRefused` | Daml Script |
| Replay and double spend refused: a settled instruction, a replayed proposal, a refunded receipt, a settled allowance | `testReplayRefused`, `testProposalReplayRefused`, `testWithdrawTransfersExactly`, `testNeverAcceptedRefunds` | Daml Script |
| Wrong account, wrong instrument (another registry's coin), wrong listing, closed listing, transfer to someone else, registry that does not complete: nothing credited | `testWrongAccountRefused`, `testWrongInstrumentRefused`, `testClosedListingRefused`, `testTransferNotToVenue`, `testRegistryNotCompletingCreditsNothing` | Daml Script |
| Withdraw transfers exactly (4 coin for 400,000 units), debits exactly, change stays | `Test.CC.Withdraw.testWithdrawTransfersExactly`, `testWithdrawAllLeavesNothing` | Daml Script |
| Only deposited coin can leave; winnings stay credits; cash short refused; the venue cannot touch another owner's cash or allowance | `testOnlyWhatWasDepositedCanLeave`, `testInsufficientCashRefused`, `testWithdrawCannotTouchOthersCash` | Daml Script |
| A failed transfer refunds: immediate `Failed`, never accepted, rejected by the owner; an accepted transfer cannot be refunded; a registry abort rolls everything back | `testFailedTransferRefunds`, `testNeverAcceptedRefunds`, `testRejectedTransferRefundedAgainstReturnedCoin`, `testAcceptedCannotBeRefunded`, `testRegistryAbortRollsBack` | Daml Script (with `FailingRules`) |
| Reserve: covered, in-flight counted as gone, a shortfall shown honestly, foreign, locked and duplicate holdings refused | `Test.CC.Reserve.testStatementCovered`, `testStatementCountsInFlightAsGone`, `testStatementShowsShortfall`, `testStatementRefusals` | Daml Script |
| Reserve after random sequences: coin held + in flight + taken = minted; held covers allowances to the unit; cash equals allowance with no trading | `testRandomSequenceKeepsTheReserve` (seed 20260930), `testRandomSequenceSecondSeed` (seed 7), 40 steps each: deposit, dust refused, withdraw, over-allowance refused, owner accept, venue refund, attest | Daml Script |
| Privacy: an owner sees only their own allowance, receipts and proposal; an outsider sees nothing; the auditor sees allowances, receipts and statements but not proposals | `testRailPrivacy` | Daml Script |
| The planners: a look-alike instruction is never settled, dust is rejected back, an expired or re-leased seat's transfer is never credited, no holding or allowance is reserved twice in a pass, in-flight transfers are taken back, recorded or left alone but never guessed | `ops/cc/policy.test.ts` | unit |
| The pass against a fake ledger and a fake registry: what is read, the accept context and disclosed contracts, the factory call, exact inputs, failures isolated | `ops/cc/rail.test.ts`, `history.test.ts`, `registry.test.ts`, `decode.test.ts` | unit |
| The seat side: every write refuses before journaling or signing while not-live; K-224 offset filter; a deposit instruction with the registry's context; dust refused before signing | `server/cc.test.ts` | unit |
| The screens: not-live offers nothing and invents no figure; live states the listing's rate, the exact step, and only what the seat can take back | `web/src/features/funding/cc-panel.test.ts` | unit |
| The drain: a Canton Coin claim holds a seat; a settled receipt does not | `server/seat-holdings.test.ts` | unit |

Gate results are in the last section.

## What Daml cannot check (and what stops it)

An interface view is what the contract's own template says. On a shared participant a look-alike template that implements `TransferInstruction` could claim the right admin party and have its `Accept` create fake `Holding`s; Daml cannot tell it from the registry's. So:

- **The ops actor settles an instruction only if the listing's `instrumentAdmin` is among the created event's `signatories`** (a look-alike cannot have the registry's party sign it), and, when `CC_ALLOWED_PACKAGE_IDS` is set, only if its template's package is on the list. Tested: `planDeposits` never touches a forged instruction, and `railPass` never asks the registry about one.
- **Completeness of the statement** (that the venue names every holding and every allowance) is the auditor's check, since the auditor observes every allowance. For Canton Coin the holdings are public on Scan.
- **That a gone instruction was accepted or rejected** is read from the ledger's history (`POST /v2/updates`, `history.ts`); without it, or when it cannot say, the planner waits and never guesses.

## What waits for DevNet (and a real wallet)

Everything below is written and unit-tested against fixtures and has **not been run against a node**. The path stays `not-live` until it has (K-248).

1. **Upload `abu-pm-cc` 0.1.0** after `abu-pm-main` (Noders Console), and confirm the participant has the token-standard V1 API packages vetted (every Splice validator does). `abu-pm-cc` is not in the R1 set in `daml/released/`. **Merge note:** its `daml.yaml` points at `abu-pm-main-0.5.0.dar`; when lane C7c's 0.5.1 lands the path (and the other packages') moves with it.
2. **Create the listing.** Read the DSO party from Scan, set `CC_INSTRUMENT_ADMIN`, `CC_INSTRUMENT_ID=Amulet`, `CC_UNITS_PER_COIN`, and start the actor with `CC_CREATE_LISTING=1` once. Abu confirms the rate first (K-245).
3. **Point the actor and the web at the registry** (`CC_REGISTRY_URL`, the Scan/validator registry base) and run one pass with `DRY_RUN` on: it prepares only. `registry.ts` is written from `transfer-instruction-v1.yaml` (1.1.0) and has never answered a real request.
4. **A real deposit with a real coin.** A seat's party gets Canton Coin (DevNet tap or a wallet transfer), instructs `TransferFactory_Transfer` to the venue (`POST /api/ledger/cc/deposit`), the actor accepts it with the registry's accept context and credits the cash. This is the first time `TransferInstruction_Accept` runs against Amulet's real implementation, with its real choice context and disclosed contracts.
5. **A real withdrawal**, including the two-step case (no `TransferPreapproval` on the seat, so the transfer is `Pending`), the owner's accept, the venue's `Withdrawal_Complete` (needs `history.ts` to answer against a real update stream), and a refund of one the owner never accepts.
6. **A reserve statement against Scan.** Compare `heldAtomic` with the venue's holdings on Scan.
7. **Flip the capability.** One commit changes `CC_RAIL_CAPABILITY` to `live`, `docs/plan/capabilities.json` (C-DAML-06) and an `acceptance.md` row, with the drive's evidence.
8. **Grofty and any wallet outside our participant.** A wallet user is not a signatory of our package and their participant has not vetted it (`context/11-wallet-and-deployment/grofty-custom-package-feasibility.md`), so the seat-as-depositor design cannot serve them. The route they need is the V2 allocation with the venue as executor (`SettlementFactory_SettleBatch`, executor and admin authority only), plus a durable party the user owns credited through an explicit link. **Not built.** V2 needs the V2 test registry (`splice-test-token-v2`, `splice-token-standard-utils`) and a V2 driver in `pm-tests`; the design above does not change. It is also unverified whether the Grofty extension presents a generic `AllocationFactory_Allocate` at all (the three questions to Grofty are drafted and unsent).
9. **Holdings-dependent UX.** Name a tokenised-share instrument (`CIP56_SHARE_INSTRUMENTS`) and turn on `NEXT_PUBLIC_CIP56_HOLDINGS`; until then the cover and hedge cards, "Your stocks" and the drop bell keep the reference's own "no holdings" state.

## Known limits

- **Pooled seats.** Seats are recycled (K-224). Real coin must not ride one. The rail treats a live lease as the identity and rejects or declines anything from before it; a seat with a coin claim is not recycled; with no database the actor fails closed. Raw coin a stranger sends to a seat's party is not counted by the drain (it would let anyone pin the pool). Before real value moves the depositor must be a durable party (item 8).
- **Receipts accumulate.** `CcDeposit` and settled `CcWithdrawal` are never archived; the venue's pass reads the withdrawals each time. Fine at this scale; an archive choice after a retention period is the follow-up.
- **The reserve is a claim the ledger only half checks.** Per operation it is enforced (see K-247); that the statement is complete is the auditor's.
- **No allowance is ever reduced by trading losses.** A user who lost their credits still shows an allowance; the venue must keep that coin covered until they take back nothing or the venue forfeits it, which is a treasury decision outside the rail.

## Reproduce

```
export PATH="$HOME/.dpm/bin:$PATH"; export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home; export PATH="$JAVA_HOME/bin:$PATH"
cd daml && dpm build --all && (cd pm-tests && dpm test)
pnpm codegen:daml && git diff --exit-code packages/daml-clients        # the bindings match the package
pnpm typecheck && pnpm invariants && pnpm test
pnpm --filter @agari/mobile typecheck
shasum -a 256 daml/vendor/splice/*.dar                                  # against daml/vendor/splice/README.md
```

The vendored DARs are never edited.

## Gate results

Run 30 Sep 2026 on the merged tree (main `ec7c271` merged, HEAD `9c0a984`+), Apple silicon, load average 15 to 50:

| Gate | Result |
|---|---|
| `cd daml && dpm build --all && (cd pm-tests && dpm test)` | build exit 0; **234 scripts ok, 0 failed** (202 before this lane, 31 rail tests and the `mkCC` fixture: 12 deposit, 12 withdraw, 7 reserve, privacy and random) |
| `pnpm codegen:daml` then `git status` | no diff: the committed bindings match the package |
| `pnpm typecheck` | all 10 projects green (web, mobile, ops, markets, core, ledger, db, brain, scripts, daml-clients) |
| `pnpm invariants` | 0 errors, 0 warnings (`no-party-from-request`, `time-suffix`, `no-float-money`, `capabilities-evidence`, the mobile design rules) |
| `pnpm test` | 310 files passed, 12 skipped; **2,421 tests passed**, 52 skipped, 0 failed. The lane adds 87: ledger units 7 and interface filter 3, the rail's decoders, planners, registry, history and pass 47, the ops actor's env 3, the seat side 13, holdings 6, the seat drain 1, the funds panel 7 |
| `pnpm --filter @agari/mobile typecheck` | green |

No sandbox was started: disk had 7.4 GB free (the lane's limit was 8 GB), and nothing here needs one. No node, wallet, registry or remote URL was contacted at any point; every credential-shaped variable in this lane is a name in a runbook, never a value.
