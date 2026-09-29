# C3 — Ledger client, projector and venue operations

**Goal:** `packages/ledger` and a single-writer `services/ops` run a 1-minute lane unattended: windows open, three oracles post, the resolver resolves, legs settle, and the projector mirrors the venue's view into Postgres.

- **Dates:** 3.0 and 3a–3c from Thu 1 Oct on the `abu-pm-dev` DAR; 3d–3e only after the money gate and R1 (Fri 2), to Sat 3.
- **Plan:** `00-plan.md`, "Architecture" §6–9, "Venue operations and the projector", "Performance and libraries".
- **Lanes:** 3.0 → 3a, 3b, 3c in parallel → 3d → 3e. At most four ledger or sandbox lanes on this machine.
- **K-number block:** K-035–049 (K-035 credential default recorded).

## Steps

- [ ] 3.0 `packages/ledger`: token (password grant per process, single-flight, re-grant at 80%), `units.ts`, submit-and-wait with `ACS_DELTA`, `commandId`/`submissionId` discipline, rejection → the 28 `Diagnosis` kinds, paged active-contracts (endpoint settled against `/docs/openapi`)
- [ ] 3a projector: one `/v2/updates` WebSocket filtered to the venue, cursor in the same transaction, `OffsetCheckpoint`, reconnect on re-grant, rows keyed `(update_id, node_id)`; `idx/read.ts` SQL only
- [ ] 3b roller: `execute.ts` → `Series_OpenWindow`; 1-minute demo lane (C-ADD-05)
- [ ] 3c oracle feeders: Coinbase, Kraken, Bitstamp 1-minute closes, one command per oracle and boundary, raw payloads archived with `payloadHash`
- [ ] 3d pricer, quote issuer over K = 16 venue cash shards, expiry sweeper, venue price ladder over SSE
- [ ] 3e resolver proposer, settler (`SettleBatch`, start 25), netting, rebalancer, reserve reporter, seat funding and close-out
- [ ] Venue mode (issuer policy, optional `VenueMode`); oracle quorum default 3 parties, quorum 2 (decision entry); price sourcing decision entry

## Gate

- 30 consecutive 1-minute windows unattended.
- Projector rebuild equals live.
- Kill the worker: every user exit still works.

**Acceptance rows required:** the 30-window run (first and last update ids), rebuild comparison, kill-the-worker, settle-batch size measured.

## Findings

## Handoff
