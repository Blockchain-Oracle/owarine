# C2 — Daml engine (`abu-pm-main`) and the money gate

**Goal:** the engine package as modelled in `00-plan.md` ("Daml model"), with the money gate green in `pm-tests`. No financial stage starts until the gate passes.

- **Dates:** Tue 29 Sep – Thu 1 Oct; hard marker Fri 2 Oct (spec freeze with the product specs).
- **Plan:** `00-plan.md`, "Daml model", "What measurement settled".
- **Lanes:** 2a templates, then 2b harness. Owns `daml/` only.
- **K-number block:** K-020–034.

## Steps

- [ ] Workspace: `daml/multi-package.yaml`, `abu-pm-main`, `pm-tests` (the only package depending on daml-script); SDK 3.5.2, LF 2.2
- [ ] `Series` and `Series_OpenWindow` (consuming, checks `nextIndex`)
- [ ] `MarketTerms` (immutable; oracle list, quorum, `maxDeviationBps` copied at open), `WindowState` → `OpenPrint` → exactly one of `Terms_Resolve` / `Terms_Void` (controller resolver)
- [ ] `PriceQuote` per `(oracle, symbol, boundaryT)`, `priceE8 : Int`
- [ ] `OpenPrint`, `Resolution` signed by resolver and venue
- [ ] `VenueCash` (`Spend`, `Merge`, `IssueQuote`, `IssueTwoWay`, `bucket`)
- [ ] `Quote`, `BuyQuote` (`Accept` user-only, `Expire`, `Withdraw`; `ensure validUntil <= lockAt`)
- [ ] `Leg` (`Settle`, `Claim`, `Merge`, `CloseOut`, `RefundStale`), `NettedResidual`
- [ ] Integer units and fee `ensure`s; Int64 bound on `lots × cashUnit`
- [ ] Deadline semantics per `DA/Assert.daml` (`assertWithinDeadline` fails at the deadline; exact port asserts against `deadline + 1s`)
- [ ] Money gate tests (full list in `00-plan.md`, "Money gate"), resolver and quorum tests first
- [ ] Outside Daml: `prepare` vs TS pricer differential, `contention.py 16`, batch-settle sizing, kill-the-worker (with C3)

## Gate

`cd daml && dpm build --all && (cd pm-tests && dpm test)`: every money-gate test green. Watch point: Wed 30 20:00, the resolver test and half the gate tests green, else a second harness lane.

**Acceptance rows required:** the money gate run (test count, commit). R1 (`abu-pm-main` upload by Abu, Fri 2) gets its own row with `upgrade-check` output.

## Findings

## Handoff
