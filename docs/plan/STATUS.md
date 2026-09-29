# STATUS — updated 2026-09-29 ~01:40 UTC by Claude (C0 docs lane)

```
Current stage: C0 / M0 "the fork builds" (in progress)   Lanes: C0 owner · C0 docs (this file) · C2 Daml (in flight, daml/) · candle probe (running)
Last green commit (gate passed): none yet in this repo. Baseline green on the untouched Agari tree 661a24ee before import (acceptance 01:22–01:26Z)
Last commit: 2855af5 "chore(C0.2/styles): bring the design system's stylesheets back into the repo"
In-flight step: C0 docs: docs/plan/* created, README replaced, .gitignore tracks docs/plan (uncommitted). Ledger side effects: none
Done: baseline proven (except expo export) · import + tag hackcanton-s3-start (6f3f3cf) · stylesheets in repo byte-identical (94a0d65 → 2855af5, K-002) | Milestones: M0 ☐ M1 ☐
Progress: parity rows Done 0 / 221 · gates passed today 0
Blockers: none
Network: local Canton sandbox first (K-009). DevNet: Noders, Canton 3.5.18 (/v2/version public, CORS open); not onboarded yet
Parties used: unknown until Noders onboarding (budget in 00-plan.md "Seats")
DAR releases: none (R1 after the money gate)
Next action: C0 owner runs the fast gate on this repo's HEAD, then starts the identity rename and the invariant re-point (stage-00-bootstrap.md).
```

## Business lane (fixed line)

**Mana:** the HackCanton dashboard has a "claim mana" button. It gives 100 a day, and 1,000 is needed to submit, so it takes 10 separate days; the organizers called 30 Sep the last day to start. This is Abu's only daily action. Next business items due: Tue 29 outreach drafts and `docs/brief.md` (agent drafts, Abu sends); daily journal facts file each evening. Full schedule: `stage-90-business.md`.

## Needs Abu

- **Daily:** click "claim mana" on the HackCanton dashboard (above).

## Needs Abu (later, asked in plain words when the build reaches it)

- Before the DevNet skeleton (C2x): sign in once to the Noders wallet and Console with his HackCanton account (about 2 minutes) and create the party set in the Console (K-009).
- Every DAR release (R1, R2 …): the Console upload.
- Before the iOS build (C11): the new App Store Connect app record and its identifiers (K-125).
- At the first hosted deploy: the domain and its DNS records (K-003).
- At the end: the video and the submission form.

Everything else is decided by default in `decisions.md`, where Abu can overrule any of it.

## In flight

- **C2 Daml lane:** `daml/` (untracked) holds `abu-pm-main` and `pm-tests` (SDK 3.5.2, version 0.1.0) in a multi-package workspace. Owned by that lane; see `stage-02-daml-engine.md`.
- **Candle-lag probe:** a 60-minute BTC/ETH run writing `docs/evidence/probes/candle-lag-{btc,eth}-2026-09-29.jsonl` (do not edit); script `scripts/probes/candle-lag.mjs` (untracked). Result goes to `acceptance.md` when it ends.

## Notes for the next session

- `docs/plan/stage-26-mobile.md` is the reference's own S26 stage file (Agari, Solana), present on disk from the import but never tracked. Now that `docs/plan/` is tracked it would be committed with the rest; the C0 owner decides whether to delete it or keep it as prior work. The Canton iOS stage is `stage-11-ios.md`.
- Reference planning docs (read-only): `agari-wt/s26/docs/plan/`.
