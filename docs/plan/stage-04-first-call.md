# C4 — First call (M1)

**Goal:** a stranger takes a seat and places a call in under a minute, on web and on the phone, and sees it settle; a second seat and the outsider see nothing of it.

- **Dates:** Sat 3 – Mon 5 Oct.
- **Plan:** `00-plan.md`, "Architecture" §4–8, "UX decisions specific to Canton", "Build sequence" (C4 row).
- **Lanes:** web adapter live · seat lease · ticket · switcher and chip · hosted deploy · phone call on internal TestFlight.
- **K-number block:** K-050–059.

## Steps

- [ ] Web adapter live over the ledger routes (`/api/seat`, `/api/ledger/*`, `/api/view`, `/api/index/*` with cookie checks)
- [ ] Seat lease with reset on web and phone: `FOR UPDATE SKIP LOCKED`, idle TTL 15 min, drain rules, pool-full and waitlist plates
- [ ] Demo-cash credit on lease (`./faucet`)
- [ ] Ticket: firm quote at click (20 s), StepProgress and the ring as Abu chose under D-081 (K-010), receipt with update id and proof link
- [ ] View switcher and "who can see this" chip on the main route, the literal `filtersByParty` body on screen
- [ ] Journal recovery: a killed submit reconciles by `commandId`, nothing re-sent under a new id
- [ ] Stale refund and claim one tap each, working with the worker down
- [ ] Hosted deploy on Coolify (K-003; host probes as acceptance rows)
- [ ] DAR release R2: `upgrade-check`, **needs Abu** for the Console upload
- [ ] The same call from the phone on an internal TestFlight build

## Gate

- `scripts/drive/first-call.ts`: four runs on the sandbox, then on Noders.
- `/status` green from outside.
- Tag `m1-first-call`.

**Acceptance rows required:** lease, quote, prepare, accept, owner view, second seat empty, outsider empty, three attestations, resolve, settle, void refund, killed submit reconciled, stale refund; host probes; R2 upload.

## Findings

## Handoff
