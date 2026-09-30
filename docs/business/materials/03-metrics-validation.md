# Metrics / Validation: Agari on Canton

*Platform material 3 of 6. The criterion reads: "Evidence from user research, interviews, tests and key metrics."*

## User research: status on 30 Sep

| Item | Target by Tue 6 Oct | Now |
|---|---|---|
| Interviews with traders and operators (20–30 min) | 5 | **0** |
| Interviewees scoring the leak pain 4 or 5 out of 5 | 3 of 5 | — |
| Interviewees who would try a pilot | 2 | — |
| Usability tests: a stranger takes a seat and places a call | 3 | **0** |

Rows are added only from Abu's own interview notes. Nothing is invented, and people are named only by role if they ask.

**Interview log** (one row per interview):

| Date | Role | Org type and size | Pain /5 | Current workaround | Quote | Would pilot? |
|---|---|---|---|---|---|---|
| | | | | | | |

## Success criteria

- **North star (after launch):** settled calls per week placed by people outside the team.
- **Falsifiable test for this hackathon:** at least 3 of 5 interviewed traders say public position visibility has changed how they size or where they trade. If fewer do, the privacy wedge is weaker than we think.
- **Leading indicators:**
  - Time from landing to first placed call, for a stranger without help. The target is under 60 seconds.
  - The share of seats that place a second call. The target is at least 50% in usability tests.

## What the MVP has already proven (local Canton sandbox, 29–30 Sep)

| Metric | Value | Source in repo |
|---|---|---|
| Consecutive 1-minute windows resolved unattended | 43 per lane on BTC and ETH, with 3 of 3 oracle prints at every open and close, and 0 voids | `docs/evidence/c3-gate-2026-09-29.md` |
| Trades through the real quote-and-accept path | 160, with 0 refused, requoted or failed | same |
| Quote issue latency | p50 395 ms, p95 911 ms | same |
| Settlement | every window's legs settled in one batch, 310–460 ms | same |
| Crash recovery | ops was killed mid-window and restarted 8 s later; the in-flight windows resolved; 0 duplicate contracts | same |
| Ledger activity | 1,016 ledger updates in the 54-minute run | same (projection counts) |
| Sell-back before the close | 0.9–1.6 s from tap to "Sold" | `docs/evidence/c7a-exit-2026-09-29.md` |
| Cadences live | 1m, 5m, 15m, 1h, 4h and 1d on BTC and ETH, plus pre-IPO and basket lanes | `docs/evidence/c6-lanes-2026-09-29.md` |
| Daml Script tests | 175 pass, including outsider-sees-nothing, conservation over 200-step random sequences, and resolve-exactly-once | `docs/evidence/c8e-tickets-ux.md` |
| TypeScript tests | 1,999 pass | `docs/evidence/c9d-seats-games.md` |

## Not yet measured

- Anything on Noders DevNet. The runs above are local.
- A hosted URL that strangers can open.
- The iOS app against Canton.
