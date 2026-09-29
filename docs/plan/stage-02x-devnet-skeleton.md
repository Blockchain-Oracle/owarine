# C2x — DevNet skeleton

**Goal:** first ledger updates on Noders DevNet through the real client, from four viewpoints, on a throwaway DAR, while the engine is still under test.

- **Dates:** Thu 1 Oct.
- **Plan:** `00-plan.md`, "Build sequence" (C2x row), "Daml model" (package names).
- **Lanes:** one ledger lane; the stage owner is DevNet's only writer.
- **Before it (Abu, about 2 minutes, K-009):** sign in to the Noders wallet and Console with the HackCanton account and create the party set.

## Steps

- [ ] Noders probes, each an acceptance row (K-009): rights, `POST /v2/parties`, DAR validate, token life, concurrent sessions, deduplication period, `synchronizerId` from `/v2/state/connected-synchronizers`, pruning offset, ledger-time tolerance, whether the primary party counts toward the quota
- [ ] Party set recorded (ids in env/bootstrap, never in docs); seat split fixed as a decision
- [ ] `abu-pm-dev` 0.0.x DAR with the frozen C2 template shapes (`Series`, `MarketTerms`, `WindowState`, `PriceQuote` in Int, `Quote`, `Leg`, `VenueCash`, `OpenPrint`, `Resolution`); package-name collision check; **needs Abu** for the Console upload
- [ ] Market → quote → accept → resolve → settle through the real client, from venue, owner, second seat and outsider
- [ ] Failure bodies captured as fixtures (Noders returns only a trace id)
- [ ] `contention.py 16` and a 10-minute cadence soak

## Gate

First ledger updates on Noders, each with its update id in `acceptance.md`. The spike is never uploaded.

**Acceptance rows required:** every probe, the upload, each command (success or failure, with update or trace id), the four viewpoint reads, contention, soak.

## Findings

## Handoff
