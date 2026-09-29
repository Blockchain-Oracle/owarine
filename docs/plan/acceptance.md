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
| 2026-09-29 | C3.0 | `packages/ledger` integration on a local sandbox (Canton 3.5.17, spike DAR): per-party ACS paging (alice sees only her 2 contracts, bob only his), resend under the same commandId and actAs → HTTP 409 `DUPLICATE_COMMAND` (context `completion_offset`, `accepted=true`), recovered via completions + update-by-id to the same update; same commandId with a different actAs set creates a new update; `/v2/updates` WebSocket from offset 0 delivers the created event and a checkpoint | C-OPS-* | 91fffb7 | `packages/ledger/src/ledger.it.test.ts` (6/6 with `LEDGER_IT=1`) | pass |
| 2026-09-29 | C3.0 | Noders JSON API host is `ledger-api-json.participant.hackcanton-01.devnet.naas.noders.services` (serves 3.5.18); the `…validator…` host returns 404 | — | — | GET `/docs/openapi` | pass (host corrected) |
| 2026-09-29 01:30–02:30 | C0 | Candle lag, 60 boundaries each for BTC and ETH: first T+offset at which each exchange served the closed 1-minute candle. Coinbase: T+2 s 58, T+5 s 1. Kraken: T+2 s 58, T+5 s 1. Bitstamp: T+2 s 4, T+5 s 55. The one miss per exchange is the probe's starting minute. Oracle `minDelaySec` set to 10 s | C-OPS-03 | — | `docs/evidence/probes/candle-lag-{btc,eth}-2026-09-29.jsonl` | pass |
| 2026-09-29 | C2b | `abu-pm-main` 0.2.0: two-way quotes, SettleBatch (25 legs; atomic failure naming the missing leg, then retry), PM.Reserve (NAV rounding in the venue's favour, exact), all 10 `caps.vectors.json` rows, revoke and day-rollover races, policy coverage of both boundaries. `dpm test` 63 ok (57 tests + 6 helpers), 0 failed; `@agari/daml` codegen typecheck green | — | dc4222e | `daml/pm-tests` | pass |
