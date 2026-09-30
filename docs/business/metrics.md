# Metrics

The upload version is `materials/03-metrics-validation.md`. This page defines each metric, where its number comes from, and how to re-measure it.

## Business metrics

| Metric | Definition | Target | Now (30 Sep) | Source |
|---|---|---|---|---|
| North star | Settled calls per week placed by people outside the team | Set after launch | 0 (no public URL yet) | projection `idx_fills`, excluding team seats |
| Interviews | 20–30 min problem interviews with ICP people (`icp.md`) | 5 by Tue 6 Oct | 0 | interview log |
| Pain confirmed (H1) | Interviewees scoring visibility pain 4 or 5 out of 5 | 3 of 5 | — | interview log |
| Pilot intent | Interviewees who would try a demo seat or a pilot | 2 | — | interview log |
| Time to first call | Stranger, no help, from landing to a confirmed call | under 60 s | not measured | `usability-test-script.md`, task 1 |
| Second-call rate | Seats that place a second call | 50% or more | not measured | usability tests, then projection |

## Proof the MVP works (local Canton sandbox)

| Metric | Value | How to re-measure | Evidence |
|---|---|---|---|
| Unattended resolution | 43 consecutive 1-minute windows per lane (BTC, ETH), 3/3 prints per boundary, 0 voids | the C3 gate run: sandbox, `bootstrap-local.ts`, ops `main.ts`, two `drive/ops-traffic.ts` drivers | `docs/evidence/c3-gate-2026-09-29.md` |
| Trade success | 160 of 160 accepted, 0 refused or failed | same run | same |
| Quote latency | p50 395 ms, p95 911 ms (n 160) | same run | same |
| Settlement | one batch per window, 310–460 ms | same run | same |
| Recovery | a SIGKILL mid-window, restarted 8 s later; windows 15–17 resolved; 0 duplicates | same run | same |
| Projection integrity | rebuild from offset 0 equals live; zero diffs | `drive/verify-projection.ts`, `drive/rebuild-projection.ts` | same |
| Sell-back | tap to "Sold" 0.91–1.61 s over 5 passes | `drive/exit-it.ts` plus the browser | `docs/evidence/c7a-exit-2026-09-29.md` |
| Daml tests | 175 scripts ok | `cd daml && dpm build --all && (cd pm-tests && dpm test)` | `docs/evidence/c8e-tickets-ux.md` |
| TypeScript tests | 1,999 passed (238 files) | `pnpm test` | `docs/evidence/c9d-seats-games.md` |

## Network activity (the Track 2 ask)

Track 2 asks for "a demonstration of how the solution generates meaningful network activity". Each traded window produces:
- a window open;
- one price post per oracle party per boundary;
- an open print and a resolution;
- one quote and one accept per trade;
- one settle batch.

The C3 run made **1,016 ledger updates in 54 minutes** from 4 lanes and 160 trades, all visible to the venue (`idx_updates 1016`, `docs/evidence/c3-gate-2026-09-29.md`). Activity grows with windows × lanes (fixed) and with trades (per user). On MainNet this is the activity that Featured App markers would count. That is a production step, not something done yet.

## Not measured yet

- Anything on Noders DevNet, or from a hosted URL.
- The iOS app against Canton (push on settle, same seat on web and phone).
- Real users. Every number above comes from drivers and test seats.
