# C0 — Bootstrap (M0 "the fork builds")

**Goal:** this repo holds the reference's exact tree (Agari `661a24ee`, without `anchor/`), proven green before import, renamed to a neutral identity, with invariants re-pointed for Canton, the toolchain checked, the parity ledger extended and the plan files in place.

- **Dates:** Tue 29 – Wed 30 Sep noon.
- **Plan:** `00-plan.md`, "Build sequence" (C0 row) and "How the work runs".
- **Lanes:** C0 owner (import, rename, invariants, toolchain, CI) · C0 docs (`docs/plan/*`, README) · probes (candle lag).
- **K-number block:** K-001–009.

## Steps

- [x] Baseline proven on untouched `661a24ee`: `pnpm install && pnpm typecheck && pnpm invariants && pnpm test && pnpm build`, plus `mobile` typecheck (acceptance 01:22–01:26Z; K-001)
- [ ] Baseline: `expo export` for iOS and Android (not in the baseline run)
- [x] Import via `git archive` without `anchor/`; tag `hackcanton-s3-start` (`6f3f3cf`)
- [x] Design-system stylesheets: mounted as a submodule (`94a0d65`), then back in the repo byte-identical (`2855af5`, K-002)
- [ ] Identity rename to the neutral scope (K-007); leftovers itemised in Handoff
- [ ] Invariants re-pointed: `ledger-import-boundary`, `write-boundary`, `no-credential-in-client`, `no-party-from-request`, `no-party-enumeration`, `choice-no-destination`, `package-drift`, `no-solana` (shrinking allowlist), inverted `venue-identity` list, `accept-single-controller`, `file-length` over `.daml`, `docs-consistency`, the metro shim-map check, and a registry check (nothing `live` without evidence)
- [ ] Toolchain check script: adds `~/.dpm/bin`, sets `JAVA_HOME` to openjdk@21, runs `nvm use 25.9.0` for `mobile/`, installs the dpm 3.5.10 assembly for the local sandbox
- [ ] `.21st/design.json` hand-completed from `tokens.css`/`theme.css` so `21st search --context auto` is grounded
- [x] Parity ledger extended with every capability from the fidelity map: 103 reference rows + 118 new (`parity.md`), registry seeded (`capabilities.json`)
- [x] `docs/plan/*` created; `.gitignore` tracks `docs/plan/` (K-006); README states prior work vs in-window work
- [ ] CI on (a `daml` job and a `ts` job, PRs and pushes to `main` only); env check
- [ ] D-123 demo-cash and ladder depth sized to the reference's scale, recorded (C-MKT-07)
- [ ] Docs-site page-by-page rewrite list (C-DOC-01)
- [x] Noders public facts: `/v2/version` → Canton 3.5.18; CORS open
- [ ] Noders probes (rights, parties, DAR validate, token life, sessions, deduplication, synchronizer, pruning, time tolerance, quota, `abu-pm-dev` collision): moved to just before C2x (K-009)
- [ ] Exchange-candle lag measured: BTC spot check done (T+2 s on all three); 60-minute BTC/ETH run in progress
- [ ] Host probes on the Coolify server: moved to the first hosted deploy (K-003)

## Gate

`pnpm typecheck && pnpm invariants` · `pnpm build` · `cd daml && dpm build --all && (cd pm-tests && dpm test)` green on this repo; probe rows recorded in `acceptance.md`.

**Acceptance rows required:** baseline (done), import and tag (done), stylesheets (done), Noders public facts (done), candle lag (spot check done; run result pending), the three gates on this repo's HEAD.

## Findings

- The baseline test run printed local time (`Start at 02:24:42`, BST); the log's section markers are UTC. Acceptance uses UTC.
- The reference's planning docs were out of git since 23 Sep; this repo tracks them (K-006).
- `mobile/src/nav/items.ts` is the source for native routes (the reference's `TAKEOVER_STATUS.md` still lists routes Abu removed on 25 Sep).

## Handoff

- Identity leftovers: to be itemised by the rename step.
- `docs/plan/stage-26-mobile.md` is the reference's S26 file, on disk from the import but untracked; decide delete or keep as prior work before committing `docs/plan/`.
