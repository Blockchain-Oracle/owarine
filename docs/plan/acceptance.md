# Acceptance ledger

Evidence for stage gates, parity rows and the capability registry. **Every command sent to Noders gets a row, including failed ones, with its update id or trace id** (Noders returns only a trace id on errors). Newest last. Times are UTC.

The reference's own public evidence page, imported unchanged, is `docs/evidence/acceptance.md` (Solana devnet, 23 Sep); it is prior work, not this ledger.

| UTC | Stage | Scenario | Parity rows | Commit | Ledger evidence (update id / trace id / artifact) | Result |
|---|---|---|---|---|---|---|
| 2026-09-29 01:22:48–01:23:29 | C0 | Baseline on the untouched Agari tree `661a24ee`: `pnpm install` (1,213 packages resolved, pnpm 11.24.0) in 40.4 s | — | `661a24ee` (reference) | local log `.baseline-661a24ee.log` (outside the repo) | pass |
| 2026-09-29 01:23:29 | C0 | Baseline: `pnpm typecheck` (`pnpm -r typecheck`, 9 of 10 workspace projects: clients, core, brain, markets, db, mobile, ops, web, scripts) | — | `661a24ee` (reference) | same log | pass |
| 2026-09-29 01:24:37 | C0 | Baseline: `pnpm invariants`, 20 rules, 0 errors, 0 warnings | — | `661a24ee` (reference) | same log | pass |
| 2026-09-29 01:24:38 | C0 | Baseline: `pnpm test` (vitest 4.1.11): 191 files (190 passed, 1 skipped); 1,773 tests passed, 3 skipped | — | `661a24ee` (reference) | same log | pass |
| 2026-09-29 01:24:53 | C0 | Baseline: `pnpm build` (web, Next.js 16) | — | `661a24ee` (reference) | same log | pass |
| 2026-09-29 01:25:35–01:26:00 | C0 | Baseline: `mobile` typecheck (`tsc --noEmit`) | — | `661a24ee` (reference) | same log | pass |
| 2026-09-29 01:26:51 | C0 | Import: Agari `661a24ee` via `git archive`, without `anchor/` and `web/src/styles/yosuku/`; annotated tag `hackcanton-s3-start` on the import commit | — | `6f3f3cf` | `git show hackcanton-s3-start` | pass |
| 2026-09-29 01:26:51 | C0 | Yosuku-derived stylesheets mounted from a private submodule (`../hackcanton-pm-styles`) | L-05 | `94a0d65` | `.gitmodules` at that commit | pass (reversed by the next row) |
| 2026-09-29 01:34:07 | C0 | Stylesheets brought back into the repo byte-identical from `661a24ee`; submodule removed (K-002) | L-05 | `2855af5` | `git show --stat 2855af5` | pass |
| 2026-09-29, time not recorded | C0 | Noders JSON Ledger API `GET /v2/version` without a token | — | — | response reports Canton 3.5.18 | pass (public endpoint) |
| 2026-09-29, time not recorded | C0 | Noders JSON Ledger API CORS check from a browser origin | — | — | CORS open | pass |
| 2026-09-29 01:28–01:29 | C0 | Exchange 1-minute candle lag, BTC spot check: time until the closed candle is served | C-OPS-03 | — | `scripts/probes/candle-lag.mjs` (uncommitted) | pass: Coinbase T+2 s, Bitstamp T+2 s, Kraken T+2 s (after a probe fix) |
| 2026-09-29 01:30 (in progress) | C0 | Candle lag, 60-minute run for BTC and ETH; first boundary 01:30Z shows Coinbase and Kraken at T+2 s and Bitstamp first at T+5 s | C-OPS-03 | — | `docs/evidence/probes/candle-lag-{btc,eth}-2026-09-29.jsonl` | running; result recorded when the run ends |
