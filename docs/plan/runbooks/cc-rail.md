# Runbook: the Canton Coin rail on DevNet (C7b)

**Status on 30 Sep:** built and proved in Daml Script and unit tests; never run against a node, a wallet or a registry. The path is `not-live` in code (`CC_RAIL_CAPABILITY`, `packages/core/src/cc/index.ts`), so every seat write refuses and every screen says "Not live" until the steps below have run and been recorded. The decisions are K-245 to K-248; what is proven and what waits is `docs/evidence/c7b-canton-coin.md`.

Nothing in this runbook is done by the build. Abu (or the agent with Abu's go-ahead) does it on the Noders participant, after R1 (`devnet-r1.md`).

## 0. Decide the rate

`CC_UNITS_PER_COIN` is cash base units (10^-6 credit) per whole Canton Coin. It must divide 10^10. The default, 100,000, means 1 Canton Coin = 0.10 credit. On DevNet the coin has no value and any rate works; before real value moves, set it from the price of that day. It is fixed for the life of a listing: a new rate is a new `CC_LISTING_ID`.

## 1. Upload the package

`abu-pm-cc` 0.1.1 is in the R1 set (K-249; 0.1.1 since the C2e rebuild on main 0.5.2, K-316): it is `daml/released/abu-pm-cc-0.1.1.dar`, upload 5 of 5 in `devnet-r1.md` step 5, after `abu-pm-main`. Its package id and sha256 are in `daml/released/MANIFEST.md`. It depends on the token standard V1 API packages, which every Splice validator has vetted; confirm the Console shows them vetted before uploading. The mock registry (`splice-test-token-v1`) is for tests only and is never uploaded.

## 2. Find the registry

- The instrument's admin party for Canton Coin is the DSO party (read it from Scan). `CC_INSTRUMENT_ADMIN` is that party id, `CC_INSTRUMENT_ID=Amulet`.
- The registry's off-ledger API is at the Scan/validator registry base (`/registry/transfer-instruction/v1/...`). `CC_REGISTRY_URL` is that base. It is unauthenticated by design; nothing here sends a credential.

## 3. Create the listing and start the actor, dry

In the ops environment (Coolify `pm-ops`, or the scripts' `devnet.env` for a one-off):

```
OPS_ACTORS=venue,cc-rail        # cc-rail is opt-in; it is never in "all"
CC_LISTING_ID=cc-1
CC_INSTRUMENT_ADMIN=<the DSO party>
CC_INSTRUMENT_ID=Amulet
CC_UNITS_PER_COIN=100000
CC_REGISTRY_URL=<the registry base>
CC_CREATE_LISTING=1             # once; remove after the listing exists
DRY_RUN=1                       # prepare only
```

Read the `cc-rail` lines in the ops log: `created listing cc-1: Amulet of … at 100000 cash units per coin`, then `settled 0, rejected 0, …`. With `DRY_RUN=1` every command is prepared against live state and executed nowhere.

## 4. A real deposit

1. Give a seat's party some Canton Coin (DevNet tap, or a wallet transfer to the party).
2. Set `CC_RAIL_CAPABILITY` to `live` **locally and not committed**, run web against DevNet, and `POST /api/ledger/cc/deposit {"commandId":"<uuid>","amount":"12.5"}` as the seat. The registry is asked for the factory and the choice context; the seat instructs `TransferFactory_Transfer` to the venue.
3. Set `DRY_RUN=0`. The actor accepts the instruction with the registry's accept context and credits the seat's cash in one transaction. Check: the seat's `VenueCash` (bucket `cc:cc-1`) is exactly `amount x 100000 / coin`; a `CcAllowance` of the same units and a `CcDeposit` receipt exist; the venue's holdings on Scan grew by `amount`.
4. Try a dust amount (`1.000001` at the default rate): `depositAmount` and the route refuse it before signing; a transfer of it made outside the app, from a seat that has a venue account, is rejected back by the actor. Check the holdings the actor counts: their signatories must include the DSO party, or every one is ignored.

## 5. A real withdrawal

`POST /api/ledger/cc/withdraw {"commandId":"<uuid>","units":"400000"}` as the seat. The actor answers the proposal: the cash is debited, the allowance lowered, the transfer instructed. Two cases to see: the seat has a `TransferPreapproval` (the transfer completes at once, receipt `WdCompleted`), and it does not (the transfer is `Pending`; the seat accepts it, and the actor's history read records it completed; a transfer nobody accepts is taken back after `CC_REFUND_AFTER_SEC` and refunded; a pending transfer the owner does not want is rejected through the receipt, `Withdrawal_OwnerReject`, which returns cash and allowance in the same transaction. A transfer rejected in a wallet stays `Sent` and the actor logs an ALERT).

## 6. The reserve

The actor publishes a `CcReserveStatement` when something moved and at least every `CC_ATTEST_EVERY_SEC`. Compare `heldAtomic` with the venue's holdings on Scan; `covered` must be true. The log line `ALERT: the reserve is short` means it is not.

## 7. Record it and flip the capability

Add the run's evidence to `docs/evidence/c7b-canton-coin.md` (update ids, screenshots, the Scan comparison), add the `acceptance.md` row, set `C-DAML-06` to `live` in `docs/plan/capabilities.json`, and change `CC_RAIL_CAPABILITY` in one commit.

## Variables

| Name | Default | What |
|---|---|---|
| `CC_LISTING_ID` | `cc-1` | which listing this actor and the web serve |
| `CC_INSTRUMENT_ADMIN` | none | the instrument's admin party (required to create a listing) |
| `CC_INSTRUMENT_ID` | `Amulet` | the instrument id |
| `CC_UNITS_PER_COIN` | `100000` | the fixed rate; must divide 10^10 |
| `CC_MIN_DEPOSIT_UNITS`, `CC_MAX_DEPOSIT_UNITS` | `100000`, `1000000000` | the listing's deposit bounds, in cash units |
| `CC_REGISTRY_URL` | none | the token registry base (https only); without it the actor reads and reports only |
| `CC_ALLOWED_PACKAGE_IDS` | any | package ids the registry's instruction templates may come from |
| `CC_CREATE_LISTING` | off | create the listing when absent |
| `CC_REQUIRE_LEASE` | on | credit and pay only seats with a live lease (K-224); off only for a LocalNet with no seat pool |
| `CC_RAIL_EVERY_MS` | `15000` | pass interval |
| `CC_REFUND_AFTER_SEC`, `CC_TRANSFER_WINDOW_SEC` | `86400` (at least 600) | when an unaccepted transfer is taken back, and how long one the venue sent stays open |
| `CC_ATTEST_EVERY_SEC` | `300` | at least this often when anything moved |
| `NEXT_PUBLIC_CIP56_HOLDINGS` | off | client flag: read the seat's CIP-56 holdings |
| `CIP56_SHARE_INSTRUMENTS` | none | JSON `[{admin,id,symbol}]`: which instruments are verified share tokens |

## What is not here

Grofty and any wallet outside our participant need the V2 allocation route and a durable, user-owned party; neither is built (`docs/evidence/c7b-canton-coin.md`, "What waits for DevNet", item 8). Real value must not be deposited from a pooled seat: the rail rejects across a lease change and holds a seat that has a claim, but the design is DevNet-only until the depositor is a durable party (K-248).
