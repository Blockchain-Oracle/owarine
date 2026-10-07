# C7b — the Canton Coin money rail (evidence)

Date: 2026-09-30 · lane C7b (`slice/C7b-canton-coin`, from main `1b41384`, clean) · decisions K-245 to K-248 · parity C-DAML-06 and C-MKT-12 (both Shell; `capabilities.json` keeps them `not-live`).

**One sentence.** Real value can now go in and out of the venue through the Canton token standard (CIP-56): a deposit is the owner's own pending transfer, accepted and credited in one transaction; a withdrawal is a token-standard transfer back; the venue publishes an auditor-visible statement of the coin it holds against the coin it owes. All of it is proved in Daml Script against the token standard's own test registry and in unit tests against a fake ledger and a fake registry. **Nothing here has touched a node, a wallet, Grofty or a real registry**, and the path is `not-live` in code until DevNet proves it.

## What was built

| Piece | Where | What it is |
|---|---|---|
| `abu-pm-cc` 0.1.0 | `daml/abu-pm-cc/` (added to `daml/multi-package.yaml`) | A separate package on `abu-pm-main` 0.5.0 and the token standard V1 interfaces. `abu-pm-main` is untouched. |
| Vendored token standard | `daml/vendor/splice/` (+ `THIRD_PARTY_NOTICES.md`) | Four Splice DARs byte for byte, with hashes, package ids and the Apache-2.0 licence: `splice-api-token-{metadata,holding,transfer-instruction}-v1` 1.0.0 and the token standard's own mock registry `splice-test-token-v1` 1.0.1 (tests only, never uploaded). Source: `canton-network/splice` at `fda19e6`. |
| Money-gate tests | `daml/pm-tests/daml/Test/CC/` | 38 Daml Script tests (12 deposit, 17 withdraw, 9 reserve and privacy incl. two seeded random sequences) plus four tiny in-repo registries for the answers the mock cannot give (`FailingRules`, `StuckOffer`, `CompletingRules`, `LyingRules`). |
| Bindings | `packages/daml-clients/` (`Cc`, `CC_TEMPLATE_IDS`, `CIP56_INTERFACE_IDS`) | `pnpm codegen:daml` output, committed. |
| The CIP-56 edge | `packages/ledger/src/units.ts`, `client.ts` | Decimal to atomic to cash units, exact or refused; an `InterfaceFilter` read. The only place `Decimal` appears. |
| The venue's pass | `packages/markets/src/ops/cc/` | Decoders, choice builders, the pure planners (`policy.ts`), the registry client, the history reader, `railPass`. |
| The ops actor | `services/ops/src/actors/cc-rail/` | Opt-in (`OPS_ACTORS=cc-rail`), never on `all`. |
| Seat side | `packages/markets/src/server/cc.ts`, `web/src/app/api/ledger/cc/{,withdraw,deposit}/route.ts` | Status, deposit instruction, withdrawal request; the party only from the lease; the phone's one-request write proof, body through `jsonBody`. |
| Holdings | `packages/markets/src/holdings/`, `web/src/app/api/holdings/route.ts` | Reads the seat's CIP-56 `Holding`s as the leased party. |
| Funds screens | `web/src/features/funding/` (`cc-panel.ts`, `CcRailPanel.tsx`), `mobile/src/components/funding/CcRailCard.tsx` | A "Canton Coin · Not live" card, drawn from one view model, in the web dialog and the phone drawer. |
| The drain | `packages/markets/src/server/seat-holdings.ts` | A Canton Coin claim holds a seat in the drain. |

## How it works

**Listing.** `CcListing` is the venue's published, static offer: instrument (admin party and id), one fixed rate, deposit bounds, open or closed. Its choices are nonconsuming except `Listing_SetDeposits`. Because a listing is a venue-signed contract the venue can archive and re-create, **what it states is copied into every allowance and every owner-signed ask** (`Terms`: listing id, instrument admin and id, rate), and every choice that spends or counts one refuses when the listing no longer says the same (`terms-changed`, `foreign-allowance`). K-245's "cash credited at one rate is redeemed at that same rate" is therefore enforced, not conventional.

**Deposit** (`Listing_SettleDeposit`, controller: the venue). The owner instructs `TransferFactory_Transfer` (sender: the owner, receiver: the venue); it stays a `TransferInstruction` pending the venue's acceptance. In one transaction the venue accepts it, reads the holdings the registry says it created for the venue (no more coin than the transfer named), converts them exactly, credits the owner's `VenueCash` through the engine's own `VenueAccount_Credit` (bucket `cc:<listing>`), raises the owner's `CcAllowance` and writes a `CcDeposit` receipt whose `ensure` pins the credit to the coin received. A transfer the registry does not complete, a second settle of the same instruction (its contract is gone), the wrong instrument, account or listing credits nothing.

**Withdrawal** (`CcWithdrawProposal`, then `Proposal_Accept`). The owner creates an ask (owner-signed, the venue an observer) naming the units, the terms it saw and when it lapses (`validUntil`). The venue answers in one transaction: check the terms and the expiry and that the transfer window is at most a week, debit exactly the cash through the engine's merge, split and withdraw choices (the owner's authority is the ask's signatory), lower the allowance (refused beyond it), instruct the transfer, and **check the registry's answer**: `Completed` only if the holdings it names are the owner's and cover the amount (`not-delivered`), `Pending` only if the instruction it names is this transfer, venue to owner, this amount and instrument (`wrong-instruction`), `Failed` restores cash and allowance in the same transaction. A pending transfer ends three ways: the owner accepts it (the venue records `Withdrawal_Complete`, bookkeeping), the venue takes it back (`Withdrawal_Refund`: the registry must answer `Failed` and hand the coin back), or **the owner rejects it through the receipt** (`Withdrawal_OwnerReject`: the token standard's own `Reject`, the registry must hand the coin back, and cash and allowance return in the same transaction on the ledger's check, not the venue's word). A transfer the owner rejects somewhere else (a wallet) leaves the receipt `Sent`: nothing on the ledger can show the venue that coin came back, so nothing refunds it on the venue's word alone; the ops actor raises an alert.

**Reserve** (`Listing_Attest`). The venue names its unlocked holdings of the instrument and the allowances of **every listing of that instrument**. The ledger fetches each holding through the `Holding` interface (each must exist and be the venue's; a foreign, locked or repeated one is refused; one may carry up to 10^8 coin), sums each allowance at its own rate in atomic units so two listings on one pool of coin cannot each report it as theirs, and records `covered = heldAtomic >= liabilityAtomic`. Held units round down, owed units round up, `asOf` is the ledger's own time. A short statement is publishable and says so.

## The rate (K-245)

`unitsPerCoin` cash base units per whole coin, stated on the listing, fixed for its life, dividing 10^10 so every conversion is exact. Default 100,000: **1 Canton Coin = 0.10 credit**, one cash unit = 0.00001 coin; a placeholder for Abu to set from the price of the day real value first moves. A deposit that is not a whole number of cash units is **refused as dust and sent back, never rounded**: rounding down would keep the fraction, rounding up would credit cash the venue holds no coin for. The one rounding in the package is `unitsFloor` on the assets side of a statement, which rounds down. The Decimal to Int conversion is one function (`PM.CC.Units.toAtomic`, mirrored vector for vector by `@agari/ledger` `units.ts`); every bound is a division before any product, and the listing, both receipts and every sum carry an `ensure` bound below Int64.

## The reserve (K-247)

The venue's coin claim is a `CcAllowance` per owner and listing: what was deposited and not taken back. **Coin out never exceeds coin in, per owner**: winnings and demo credits never raise the allowance, so the demo economy (the venue mints its own demo cash and pays winners in credits) cannot be redeemed for more coin than was put in, and a seat can take back `min(allowance, cash)`. The statement is then a balance sheet: coin held against the sum of allowances, each side a set of contracts the ledger fetched.

**This is a deposit rail, not real-money trading.** A user's trading losses do not reduce what they can take back: an owner who deposits 100, loses all their cash and later holds credits again can withdraw 100 in coin, because the allowance is only lowered by a withdrawal. The venue underwrites the coin. That is the price of the venue minting its own demo cash; the statement stays conservative and profit the venue makes on trades stays credits until a treasury decision outside the rail. Real-money trading needs a venue whose cash supply is only coin (no faucet, no minted shards), which is a second venue party running the same engine. That is designed and not built.

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
| A failed transfer refunds: immediate `Failed`, never accepted, rejected by the owner; an accepted transfer cannot be refunded; a registry abort rolls everything back | `testFailedTransferRefunds`, `testNeverAcceptedRefunds`, `testOwnerRejectRefunds`, `testAcceptedCannotBeRefunded`, `testRegistryAbortRollsBack` | Daml Script (with `FailingRules`) |
| Reserve: covered, in-flight counted as gone, a shortfall shown honestly, foreign, locked and duplicate holdings refused, the ledger's own time | `Test.CC.Reserve.testStatementCovered`, `testStatementCountsInFlightAsGone`, `testStatementShowsShortfall`, `testStatementRefusals` | Daml Script |
| Two listings of one instrument share one pool: each statement counts both listings' allowances at their own rates, and both say uncovered when the pool is short | `testStatementAcrossListings` | Daml Script |
| A reserve holding of more than 10^7 coin is countable; past 10^8 it is refused, not overflowed | `testWideHoldingsAttest` | Daml Script |
| Terms are enforced: a listing re-created under the same id with another rate or instrument cannot answer an old ask or fold into an old allowance; an ask lapses; the transfer window is bounded | `Test.CC.Withdraw.testTermsChangedRefused`, `testProposalWindow` | Daml Script |
| The registry's answer is checked: `Completed` must have put the coin in the owner's hands, `Pending` must name this very transfer | `testRegistryAnswersMustHoldUp` (with `CompletingRules`, `LyingRules`) | Daml Script |
| The owner gets cash and allowance back by rejecting through the receipt, on the ledger's check; the venue cannot; once refunded or completed it is final | `testOwnerRejectRefunds`, `testCompleteClosesOwnerReject` | Daml Script |
| Duplicate allowances fold into one; another owner's cannot be merged in | `testAllowanceMerge` | Daml Script |
| Reserve after random sequences: coin held + in flight + taken = minted; held covers allowances to the unit; cash equals allowance with no trading | `testRandomSequenceKeepsTheReserve` (seed 20260930), `testRandomSequenceSecondSeed` (seed 7), 40 steps each: deposit, dust refused, withdraw, over-allowance refused, owner accept, venue refund, attest | Daml Script |
| Privacy: an owner sees only their own allowance, receipts and proposal; an outsider sees nothing; the auditor sees allowances, receipts and statements but not proposals | `testRailPrivacy` | Daml Script |
| The planners: a look-alike instruction or holding is never settled, spent or counted, dust is rejected back (and only for a sender with an account), a re-leased seat's transfer is held and never credited or returned, no holding or allowance is reserved twice in a pass, an ask that lapsed or was signed under other terms is declined, in-flight transfers are taken back, recorded or alerted on but never guessed | `ops/cc/policy.test.ts` | unit |
| The pass against a fake ledger and a fake registry: what is read, the accept context and disclosed contracts, the factory call, exact registry-signed inputs, rejects bounded and after every settle, a re-leased seat skipped, an orphaned transfer alerted on, duplicate allowances merged, failures isolated; the registry client is https-only, size-capped and keeps only a status | `ops/cc/rail.test.ts`, `history.test.ts`, `registry.test.ts`, `decode.test.ts` | unit |
| The seat side: every write refuses before journaling or signing while not-live; K-224 offset filter; only records the venue (or, for an ask, the seat) signed count; a deposit instruction with the registry's context, needing a venue account and registry-signed coin; dust refused before signing; deposit and withdrawal have separate command-id namespaces | `server/cc.test.ts` | unit |
| The screens: not-live offers nothing and invents no figure; live states the listing's rate, the exact step, and only what the seat can take back | `web/src/features/funding/cc-panel.test.ts` | unit |
| The drain: a Canton Coin claim holds a seat; a settled receipt does not | `server/seat-holdings.test.ts` | unit |

The planners and the pass answer to every finding of two independent reviews (one of the Daml, one of the TypeScript), which are why the terms, the checked registry answers, `Withdrawal_OwnerReject`, the cross-listing statement, the signatory checks on holdings and the hold-not-reject rule exist.

Gate results are in the last section.

## What Daml cannot check (and what stops it)

An interface view is what the contract's own template says. On a shared participant a look-alike template that implements `TransferInstruction` or `Holding` could claim the right admin party and any amount; Daml cannot tell it from the registry's. So:

- **The ops actor settles an instruction only if the listing's `instrumentAdmin` is among the created event's `signatories`** (a look-alike cannot have the registry's party sign it), and, when `CC_ALLOWED_PACKAGE_IDS` is set, only if its template's package is on the list. **The same holds for the venue's own coin:** a holding is spent as a transfer input or named in a statement only if the registry signed it, and the seat side counts only holdings and records the venue signed. Tested in `planDeposits`, `unlockedHoldings`, `railPass` and `createCcSeat`.
- **Completeness of the statement** (that the venue names every holding and every allowance) is the auditor's check, since the auditor observes every allowance. For Canton Coin the holdings are public on Scan.
- **That the venue pays.** Withdrawing, the venue chooses the factory it instructs the transfer through and the registry endpoint it asked is the trust root (`CC_REGISTRY_URL`, https only). The ledger checks the registry's answer holds up (the coin is the owner's, or the pending instruction is this transfer), but a look-alike factory built to pass those checks cannot be told from the registry's by Daml. The rail is custodial: the owner trusts the venue to pay, and the receipts, the reserve statement and the owner's own holdings (on Scan, for Canton Coin) are what make a failure to pay visible. Until an owner accepts a pending transfer, the venue, as its sender, can also withdraw it on the registry directly; `Withdrawal_Refund` is the honest way and refunds the cash, a hostile venue would not, so an owner should accept promptly.
- **That a gone instruction was accepted or rejected** is read from the ledger's history (`POST /v2/updates`, `history.ts`, each withdrawal from its own offset); without it, or when it cannot say, the planner waits and says so in the log, and never guesses.
- **Transaction-tree privacy.** The tests check who sees a contract. In Canton an informee of an exercise also sees its consequences, so a withdrawing owner (a signatory of the ask) sees the venue's input holdings and the change holding in that one `Proposal_Accept`, and the auditor sees a deposit's cash credit. For Canton Coin the holdings are public; for any other instrument that is the venue's balance. Not measured on a ledger here.

## What waits for DevNet (and a real wallet)

Everything below is written and unit-tested against fixtures and has **not been run against a node**. The path stays `not-live` until it has (K-248).

1. **Upload `abu-pm-cc` 0.1.0** after `abu-pm-main` (Noders Console), and confirm the participant has the token-standard V1 API packages vetted (every Splice validator does). `abu-pm-cc` is not in the R1 set in `daml/released/`. **Merge note:** its `daml.yaml` points at `abu-pm-main-0.5.0.dar`; when lane C7c's 0.5.1 lands the path (and the other packages') moves with it.
2. **Create the listing.** Read the DSO party from Scan, set `CC_INSTRUMENT_ADMIN`, `CC_INSTRUMENT_ID=Amulet`, `CC_UNITS_PER_COIN`, and start the actor with `CC_CREATE_LISTING=1` once. Abu confirms the rate first (K-245).
3. **Point the actor and the web at the registry** (`CC_REGISTRY_URL`, the Scan/validator registry base) and run one pass with `DRY_RUN` on: it prepares only. `registry.ts` is written from `transfer-instruction-v1.yaml` (1.1.0) and has never answered a real request.
4. **A real deposit with a real coin.** A seat's party gets Canton Coin (DevNet tap or a wallet transfer), instructs `TransferFactory_Transfer` to the venue (`POST /api/ledger/cc/deposit`), the actor accepts it with the registry's accept context and credits the cash. This is the first time `TransferInstruction_Accept` runs against Amulet's real implementation, with its real choice context and disclosed contracts. Check the same run for transfer fees (there should be none) and for the holdings' signatories (the registry's DSO party must be one, or the actor will refuse them all).
5. **A real withdrawal**, including the two-step case (no `TransferPreapproval` on the seat, so the transfer is `Pending`), the owner's accept, the venue's `Withdrawal_Complete` (needs `history.ts` to answer against a real update stream), and a refund of one the owner never accepts.
6. **A reserve statement against Scan.** Compare `heldAtomic` with the venue's holdings on Scan.
7. **Flip the capability.** One commit changes `CC_RAIL_CAPABILITY` to `live`, `docs/plan/capabilities.json` (C-DAML-06) and an `acceptance.md` row, with the drive's evidence.
8. **Grofty and any wallet outside our participant.** A wallet user is not a signatory of our package and their participant has not vetted it (`context/11-wallet-and-deployment/grofty-custom-package-feasibility.md`), so the seat-as-depositor design cannot serve them. The route they need is the V2 allocation with the venue as executor (`SettlementFactory_SettleBatch`, executor and admin authority only), plus a durable party the user owns credited through an explicit link. **Not built.** V2 needs the V2 test registry (`splice-test-token-v2`, `splice-token-standard-utils`) and a V2 driver in `pm-tests`; the design above does not change. It is also unverified whether the Grofty extension presents a generic `AllocationFactory_Allocate` at all (the three questions to Grofty are drafted and unsent).
9. **Holdings-dependent UX.** Name a tokenised-share instrument (`CIP56_SHARE_INSTRUMENTS`) and turn on `NEXT_PUBLIC_CIP56_HOLDINGS`; until then the cover and hedge cards, "Your stocks" and the drop bell keep the reference's own "no holdings" state.

## Known limits

- **A deposit rail, not real-money trading** (K-247): a lost deposit stays claimable against later credits; the venue underwrites the coin.
- **Pooled seats.** Seats are recycled (K-224). Real coin must not ride one. The rail treats a live lease as the identity: a deposit from before the current lease is HELD (a reject would hand the coin to the new visitor) and left to expire, a withdrawal ask from before it is declined, no lease at all (no database) holds everything, and the lease is read again just before each command. A seat with a Canton Coin claim, or a pending deposit it instructed, is not recycled. Raw coin a stranger sends to a seat's party is not counted (it would let anyone pin the pool). Before real value moves the depositor must be a durable party (item 8).
- **Receipts accumulate.** `CcDeposit` and settled `CcWithdrawal` are never archived; the venue's pass reads the withdrawals each time. Fine at this scale; an archive choice after a retention period is the follow-up.
- **A transfer the registry evolves.** The token standard lets a registry replace a pending instruction (`TransferInstruction_Update`, a new contract id with `originalInstructionCid`); the receipt keeps the first id and would go stale. Amulet's two-step accept does not do this; another registry might.
- **Fees.** The input coin is chosen to cover exactly the amount. Amulet charges no transfer fee since CIP-0078 as far as the standard's notes say; that is not verified against the real registry, and a fee paid from the venue's holdings would lower `heldUnits` without lowering any allowance (the statement would then show it). Item 4 of the DevNet list checks it.
- **One reject and settle at a time.** The pass is serial with a registry round trip per command; rejects are capped per pass so a flood cannot starve real work, but the venue still pays for each.
- **Statements are not one-live-only.** `previous` chains them, but a chain started afresh leaves the old statement live beside it; readers take the highest `seq` of the latest `asOf`.
- **The reserve is a claim the ledger only half checks.** Per operation it is enforced (K-247); that the statement is complete is the auditor's.

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

Run 30 Sep 2026 on the tree with main `b392711` merged (`abu-pm-main` 0.5.1), Apple silicon, load average 15 to 250:

| Gate | Result |
|---|---|
| `cd daml && dpm build --all && (cd pm-tests && dpm test)` | build exit 0; **266 scripts ok, 0 failed** (of which 38 are the rail's tests and one is their `mkCC` fixture: 12 deposit, 17 withdraw, 9 reserve, privacy and random) |
| `pnpm codegen:daml` then `git status` | no generated diff: the committed bindings match the package |
| `pnpm typecheck` | all 10 projects green (web, mobile, ops, markets, core, ledger, db, brain, scripts, daml-clients) |
| `pnpm invariants` | 0 errors, 0 warnings (`no-party-from-request`, `time-suffix`, `no-float-money`, `file-length`, `capabilities-evidence`, the mobile design rules) |
| `pnpm test` | 318 files passed, 13 skipped; **2,498 tests passed**, 61 skipped, 0 failed. The lane adds 107: ledger units 7 and interface filter 3, the rail's decoders, planners, registry, history and pass 61, the ops actor's env 4, the seat side 17, holdings 6, the seat drain 2, the funds panel 7 |
| `pnpm --filter @agari/mobile typecheck` | green (inside `pnpm typecheck`) |

The Daml suite ran once before the two independent reviews and once after their fixes; both were green. `abu-pm-cc` is **not** in `RELEASE_PACKAGES` (`scripts/bootstrap/dar.ts`) and not in `daml/released/`: it is not ready for DevNet until items 1 to 3 below have a decision behind them.

No sandbox was started: disk had 7.4 GB free (the lane's limit was 8 GB), and nothing here needs one. No node, wallet, registry or remote URL was contacted at any point; every credential-shaped variable in this lane is a name in a runbook, never a value.

## DevNet run, 2026-10-07

The rail's DevNet list (items 2 to 7 above) ran on Noders DevNet (participant `hackcanton-01`, validator 0.9.0, Canton 3.5.19) on 7 Oct 2026, ~20:22 to 20:40 UTC, with this Mac's ops (`OPS_ACTORS=default,cc-rail`) and web as the venue, and a guest seat taken in the browser (seat 3). Every amount below was read back from the ledger and matched exactly.

| Step | Who | Update id | What the ledger then said |
|---|---|---|---|
| Listing `cc-1` created | venue (ops, `CC_CREATE_LISTING=1` once) | — (ops log 20:22:30Z) | Amulet of `DSO::1220be58…471a`, 125,000 cash units per coin (1 CC = 0.125 credit), bounds 0.8 to 8,000 CC |
| Faucet tap, 200 CC | seat 3 (`POST /api/ledger/cc/tap`, the browser's "Get 200 test Canton Coin") | `12204839e455192db513ff5d711eb511274e9eecce040d0875c4d9533cfc1e8f22de` | seat holds 200 CC, the holding signed by the DSO |
| Deposit 100 CC | seat 3 (`POST /api/ledger/cc/deposit`, the registry's factory and context) | `12202355724e7b5eca5a8880626f26084d2de529e63a89c13f2dd850379b8a611ea4` | instruction pending for the venue |
| Settle | venue (`cc-rail`: `settled 1 … attested`, 20:28:57Z) | — | seat cash 1,000 → 1,012.5 credits; allowance 12.5; `CcDeposit` received exactly 100 CC (`1000000000000` atomic, **no transfer fee**); seat holds 100 CC; statement 12.5 held / 12.5 owed, covered |
| Withdraw 5 credits | seat 3 (`POST /api/ledger/cc/withdraw`) | `1220dce2de9d89ed025a6bf9f541ecd670ec3a7e58bf670ad6933c80b8bc5b70f9aa` | ask created |
| Answer | venue (`cc-rail`: `accepted 1`, 20:29:52Z) | — | cash 1,007.5; allowance 7.5; 40 CC instructed to the seat, receipt `WdSent` (two-step: a seat has no preapproval) |
| Receive 40 CC | seat 3 (`POST /api/ledger/cc/receive`, the registry's accept context) | `1220133204c4a2e2045847c8482dc028d027bfcce7fd9a16339d8a79cb92fcb267c4` | seat holds 140 CC |
| Complete | venue (`cc-rail`: `completed 1`, from the update stream, 20:33:27Z) | — | receipt `WdCompleted` |
| Reserve re-stated | venue (`cc-rail`, first pass after the fix below, 20:40:18Z) | — | 7.5 held (the venue's 60 CC) / 7.5 owed, covered |

What the run found and changed (K-406):

- **The registry is the validator's scan proxy, and it wants a token.** A DevNet participant outside the SV allowlist cannot reach any SV's Scan (HTTP 403); the Noders validator proxies it, token standard registry included, at `<validator>/api/validator/v0/scan-proxy/registry/…`, behind the participant's own user token. `CC_REGISTRY_AUTH=ledger` sends this process's ledger token, to the one configured https base only (`ops/cc/registry-env.ts`); unset, nothing is sent, as before.
- **DevNet coin without a wallet.** `AmuletRules_DevNet_Tap` with the DSO's `AmuletRules` and an `OpenMiningRound` read from the same scan proxy and disclosed on the submission (`ops/cc/devnet-tap.ts`): the seat (or any party we host) taps for itself, so the Noders wallet's "Onboard yourself" (which fails for our ledger user) is not on the path. Offered to a seat only where `CC_FAUCET_COIN` is set, and only while it holds less than that.
- **The withdrawal's second step was missing on the seat side.** A seat has no wallet and no preapproval, so every venue → seat transfer is an offer; nothing in the app accepted it. `requestReceive` (`server/cc-moves.ts`) accepts only the registry-signed offers from the venue that name one of the seat's own `sent` receipts.
- **A move made before the statement was due was never stated.** The rail attested only in a pass that both moved something and was due; the withdrawal came a minute after the deposit's statement, so the statement kept saying 12.5 / 12.5. A due pass now compares the ledger's held and owed with the last statement and re-states when they differ, which also covers a restart.
- **Amulet charges no transfer fee** on these transfers (the deposit receipt's `received` equals the amount, and the venue's 60 CC after sending 40 equals 100 − 40). The Splice docs' note is now measured.

Still not built (unchanged from above): a wallet on another participant (item 8, the V2 allocation route), and a durable, user-owned depositor party; the rail stays a DevNet rail on pooled seats (K-248).
