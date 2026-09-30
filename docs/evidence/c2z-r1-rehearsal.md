# C2z: R1 rehearsed on one local sandbox, 2026-09-30

The first DevNet release, R1, is now a proven, boring sequence. This rehearsal ran every step of `docs/plan/runbooks/devnet-r1.md` on one local Canton sandbox: Abu's side as scripted stand-ins for his Console clicks, the agent's side exactly as written. Nothing here touched Noders or any remote node, and no credential exists in this run. The only secrets were two throwaway local HMAC and cookie keys, kept in the scratchpad and deleted with it.

**Result.** The steps:
- **Release DARs.** Built, `upgrade-check --both` green, committed with a manifest (K-202).
- **Bootstrap.** `--check-only` 25/25, then `--dry-run` with 84 writes prepared. The real run failed twice on a starved sandbox, and the third attempt made all 139 writes. A re-run executed 0.
- **`first-call.ts --network local`.** Five runs:
  - run 1: 15 of 17 rows, fixed in C2z.5;
  - runs 2 and 3: 17 of 17;
  - run 4: 16 of 17, a race fixed in C2z.6;
  - run 5: 17 of 17 on the fixed commit `57ade20`.
- **`seat-routes-it.ts` on engine 0.5.0.** 32 of 37, fixed in C2z.7; then 37 of 37.

## Setup

- **Host.** 10 cores, a load average of 26–66, and 12–17 GB of 18 GB swap in use throughout. Another lane's sandbox was running, and two `next build`s besides this one. The sandbox was started when one other Canton JVM was running and 32 GB of disk was free.
- **Sandbox.** `dpm sandbox` (Canton open source 3.5.17), `JAVA_OPTS=-Xmx1536m`, ports 7521–7526: ledger API :7521, admin :7522, sequencer :7523 and :7524, **JSON API :7525**, mediator :7526.
- **Postgres.** `pm_c2z` for the web and ops, `pm_c2z_it` for the seat drive. Both were dropped after the run.
- **Ops.** `scripts/drive/ops-local.ts` on :8727 with `DRY_RUN=0`, the projector on `pm_c2z`, and `ROLLER_SERIES=BTC-1m,ETH-1m,BTC-5m`. The rehearsal limits the roller to those lanes to spare the host; the bootstrap still created all 73 Series.
- **Web.** `next build` (Turbopack, 17 min 41 s under this load), then `next start -p 3120` against the same parties file.
- **Parties file.** `<scratch>/canton/parties.devnet.json` (mode 600), written by `bootstrap-devnet.ts --out`. Party ids never left the scratchpad; every row names a party by hint only (`pm-seat-3::…`).
- **Drives** ran under `caffeinate -i`.

## 1. Release DARs (`cce808c`)

- `dpm build --all` in `daml/` (SDK 3.5.2, dpm 3.5.10): 72 s.
- The four release DARs were copied to `daml/released/`. Package ids, sha256 hashes, sizes and the upload order are in `daml/released/MANIFEST.md`. Each is 0.82–1.01 MB, so they are tracked in Git (K-202).
- **Main package ids.** main 0.5.0 `076dbb92…`, tickets 0.1.3 `a441ff5a…`, agents 0.2.1 `9bf15da9…`, games 0.1.1 `158901a6…`. Tickets, agents and games each carry main `076dbb92…`.
- **Upgrade check.** `dpm upgrade-check --both` ran against the `afc7b3b` builds (main 0.4.0, tickets 0.1.2, agents 0.2.0, games 0.1.0). It exited 0 in 14.5 s with 0 WARN or ERROR lines; all four lineages "succeeded". The verbatim lines are in the manifest.
- **Daml gate.** `dpm test` in `pm-tests`: 186 scripts ok, 0 failed (66 s).

## 2. Abu's side, stood in for

1. **Upload.** `POST /v2/dars?vetAllPackages=true` for `daml/released/abu-pm-main-0.5.0.dar`, then tickets, agents and games, in the runbook's step-5 order: 200 ×4.
2. **Parties.** 19 parties allocated with exactly the step-3 hints: `pm-venue`, `pm-resolver`, three `pm-oracle-*`, `pm-auditor`, `pm-lp`, `pm-agent-runner`, `pm-alice`, `pm-bob`, `pm-outsider`, and `pm-seat-1` … `pm-seat-8`.
3. **The parties file.** The id list was written to `<scratch>/canton/parties.devnet.txt` as tab-separated text with an "Act-as on" column, the way a pasted Console list looks. The bootstrap read it by hint.

## 3. The agent's side: bootstrap (`bootstrap-devnet.ts --allow-local`)

| Run | Command | Result |
|---|---|---|
| check only | `--parties <scratch>/parties.devnet.txt --out <scratch>/parties.devnet.json --check-only` | 25/25 PASS: version, parties file (8 roles, 11 users), 19 parties hosted, 4 package ids `PACKAGE_STATUS_REGISTERED` |
| dry run | same, `--dry-run` | 84 writes prepared, 0 executed (the venue's ACS stayed empty). The dependent writes (LP accept, supplies, first statements, season funding) are named, not prepared |
| real, attempt 1 | same, no flag | **fail** after 1 min 43 s: `409 SUBMISSION_ALREADY_IN_FLIGHT` on the first write (trace `31febb775b468fb6e47b7f5f5af0c0e5`) |
| real, attempt 2 | + `LEDGER_SUBMIT_TIMEOUT_MS=300000` | **fail** after 1 min 11 s: the same (trace `677a56b484b9601c2e4aee7d95987819`) |
| real, attempt 3 | + `LEDGER_REQUEST_TIMEOUT_MS=120000` | **pass**: 139 executed in 4 min 17 s; wrote the parties file (mode 600) |
| re-run | same | **pass**: "0 executed (everything was already on the ledger)" in 40 s |
| check only, after C2z.3 | `--parties <scratch>/parties.devnet.json --check-only` | 25/25 PASS from the JSON form; no codegen noise above the table |

**Why attempts 1 and 2 failed.** Nothing landed. The sandbox log shows the first transaction's phase 1 took minutes. The mediator then rejected it with `MEDIATOR_SAYS_TX_TIMED_OUT` (`unresponsiveParties` = pm-venue and the sandbox itself), and the sequencer with `MAX_SEQUENCING_TIME_EXCEEDED` / `NOT_SEQUENCED_TIMEOUT`. The sequencer's block time lagged wall clock by 66 s at 05:26 local (04:26Z), after the DAR uploads and 19 allocations, and by 9 s at 05:28. Those rejections are contention-category, so `@agari/ledger` re-sent them under the same commandId. Each re-send met the change id still in flight and got `SUBMISSION_ALREADY_IN_FLIGHT`, until the attempts ran out. The third run, once the sequencer had caught up, created everything. The runbook now says what to do: wait a minute and run the same command again.

**Follow-up, C3f (2026-09-30).**
- **The error.** The Canton 3.5.17 jar confirms the id: `SUBMISSION_ALREADY_IN_FLIGHT` is `ConsistencyErrors.SubmissionAlreadyInFlight`, category 2 (ContentionOnSharedResources), with the cause "The submission is already in-flight". So `@agari/ledger` filed it as contention and re-sent it under the transport's short backoff until its attempts (`LEDGER_MAX_ATTEMPTS`, 4) ran out.
- **The client now.** It gives the error its own kind, `in-flight`. It stops re-sending at the first in-flight answer and waits for the pending submission's completion from a ledger end pinned before the first resend. That wait is bounded by the caller's deadline or `LEDGER_INFLIGHT_WAIT_MS`. It then returns that submission's transaction or throws its own rejection. If neither arrives in time, it reports `outcome unknown` with the commandId.
- **Attempts 1 and 2 under C3f.** They would have waited at the first in-flight answer. Once the first submission completed, they would have stopped with its own rejection (the log shows `MEDIATOR_SAYS_TX_TIMED_OUT`), not the in-flight error. Had it outlasted the 3-minute wait, they would have stopped with `outcome unknown`.
- **The bootstrap.** It prints its run id and takes `--run <id>`, so a re-run keeps the same command ids.
- **Coverage.** Unit tests against a fake JSON API (`packages/ledger/src/inflight.test.ts`); not re-rehearsed on a sandbox.

<details><summary>check only: 25 rows</summary>

| UTC | Stage | Scenario | Parity rows | Commit | Ledger evidence (update id / trace id / artifact) | Result |
|---|---|---|---|---|---|---|
| 2026-09-30T04:21:09.546Z | C2y | DevNet bootstrap: JSON API version | — | cce808c | GET /v2/version | pass: Canton 3.5.17 |
| 2026-09-30T04:21:09.546Z | C2y | DevNet bootstrap: parties file | — | cce808c | — | pass: 8 roles, 11 users |
| 2026-09-30T04:21:09.546Z | C2y | DevNet bootstrap: party venue (pm-venue::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:21:09.546Z | C2y | DevNet bootstrap: party resolver (pm-resolver::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:21:09.546Z | C2y | DevNet bootstrap: party oracle-coinbase (pm-oracle-coinbase::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:21:09.546Z | C2y | DevNet bootstrap: party oracle-kraken (pm-oracle-kraken::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:21:09.546Z | C2y | DevNet bootstrap: party oracle-bitstamp (pm-oracle-bitstamp::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:21:09.546Z | C2y | DevNet bootstrap: party auditor (pm-auditor::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:21:09.546Z | C2y | DevNet bootstrap: party lp (pm-lp::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:21:09.546Z | C2y | DevNet bootstrap: party agent-runner (pm-agent-runner::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:21:09.546Z | C2y | DevNet bootstrap: party alice (pm-alice::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:21:09.546Z | C2y | DevNet bootstrap: party bob (pm-bob::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:21:09.546Z | C2y | DevNet bootstrap: party outsider (pm-outsider::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:21:09.546Z | C2y | DevNet bootstrap: party seat-1 (pm-seat-1::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:21:09.546Z | C2y | DevNet bootstrap: party seat-2 (pm-seat-2::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:21:09.546Z | C2y | DevNet bootstrap: party seat-3 (pm-seat-3::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:21:09.546Z | C2y | DevNet bootstrap: party seat-4 (pm-seat-4::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:21:09.546Z | C2y | DevNet bootstrap: party seat-5 (pm-seat-5::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:21:09.546Z | C2y | DevNet bootstrap: party seat-6 (pm-seat-6::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:21:09.546Z | C2y | DevNet bootstrap: party seat-7 (pm-seat-7::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:21:09.546Z | C2y | DevNet bootstrap: party seat-8 (pm-seat-8::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:21:09.546Z | C2y | DevNet bootstrap: package abu-pm-main 0.5.0 | — | cce808c | GET /v2/packages/076dbb9246f8…/status | pass: id 076dbb9246f8… PACKAGE_STATUS_REGISTERED |
| 2026-09-30T04:21:09.546Z | C2y | DevNet bootstrap: package abu-pm-tickets 0.1.3 | — | cce808c | GET /v2/packages/a441ff5ab84b…/status | pass: id a441ff5ab84b… PACKAGE_STATUS_REGISTERED |
| 2026-09-30T04:21:09.546Z | C2y | DevNet bootstrap: package abu-pm-agents 0.2.1 | — | cce808c | GET /v2/packages/9bf15da97a74…/status | pass: id 9bf15da97a74… PACKAGE_STATUS_REGISTERED |
| 2026-09-30T04:21:09.546Z | C2y | DevNet bootstrap: package abu-pm-games 0.1.1 | — | cce808c | GET /v2/packages/158901a60ff5…/status | pass: id 158901a60ff5… PACKAGE_STATUS_REGISTERED |

</details>

<details><summary>dry run: 110 rows (84 prepared writes)</summary>

| UTC | Stage | Scenario | Parity rows | Commit | Ledger evidence (update id / trace id / artifact) | Result |
|---|---|---|---|---|---|---|
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: JSON API version | — | cce808c | GET /v2/version | pass: Canton 3.5.17 |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: parties file | — | cce808c | — | pass: 8 roles, 11 users |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: party venue (pm-venue::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: party resolver (pm-resolver::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: party oracle-coinbase (pm-oracle-coinbase::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: party oracle-kraken (pm-oracle-kraken::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: party oracle-bitstamp (pm-oracle-bitstamp::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: party auditor (pm-auditor::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: party lp (pm-lp::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: party agent-runner (pm-agent-runner::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: party alice (pm-alice::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: party bob (pm-bob::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: party outsider (pm-outsider::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: party seat-1 (pm-seat-1::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: party seat-2 (pm-seat-2::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: party seat-3 (pm-seat-3::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: party seat-4 (pm-seat-4::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: party seat-5 (pm-seat-5::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: party seat-6 (pm-seat-6::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: party seat-7 (pm-seat-7::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: party seat-8 (pm-seat-8::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: package abu-pm-main 0.5.0 | — | cce808c | GET /v2/packages/076dbb9246f8…/status | pass: id 076dbb9246f8… PACKAGE_STATUS_REGISTERED |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: package abu-pm-tickets 0.1.3 | — | cce808c | GET /v2/packages/a441ff5ab84b…/status | pass: id a441ff5ab84b… PACKAGE_STATUS_REGISTERED |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: package abu-pm-agents 0.2.1 | — | cce808c | GET /v2/packages/9bf15da97a74…/status | pass: id 9bf15da97a74… PACKAGE_STATUS_REGISTERED |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: package abu-pm-games 0.1.1 | — | cce808c | GET /v2/packages/158901a60ff5…/status | pass: id 158901a60ff5… PACKAGE_STATUS_REGISTERED |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: bootstrap writes | — | cce808c | — | pass: 84 prepared |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:desk:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:shards:devnet-munllmer as venue (16 commands) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:BTC-1m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:BTC-5m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:BTC-15m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:BTC-60m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:BTC-240m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:BTC-1440m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:ETH-1m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:ETH-5m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:ETH-15m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:ETH-60m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:ETH-240m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:ETH-1440m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:TSLA-5m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:TSLA-15m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:TSLA-60m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:NVDA-5m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:NVDA-15m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:NVDA-60m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:AAPL-5m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:AAPL-15m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:AAPL-60m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:MSFT-5m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:MSFT-15m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:MSFT-60m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:META-5m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:META-15m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:META-60m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:AMZN-5m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:AMZN-15m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:AMZN-60m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:GOOGL-5m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:GOOGL-15m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:GOOGL-60m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:QQQ-5m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:QQQ-15m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:QQQ-60m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:VOO-5m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:VOO-15m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:VOO-60m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:TSLAx-5m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:TSLAx-15m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:TSLAx-60m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:NVDAx-5m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:NVDAx-15m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:NVDAx-60m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:QQQx-5m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:QQQx-15m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:QQQx-60m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:SPYx-5m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:SPYx-15m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:SPYx-60m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:TSLA-gap:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:NVDA-gap:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:AAPL-gap:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:MSFT-gap:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:META-gap:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:AMZN-gap:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:GOOGL-gap:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:QQQ-gap:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:VOO-gap:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:OPENAI-60m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:ANTHROPIC-60m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:SPACEX-60m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:NEURALINK-60m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:ANDURIL-60m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:KALSHI-60m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:POLYMARKET-60m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:FIGUREAI-60m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:AILABS-60m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:FRONTIER-60m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:PREDMKTS-60m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:DEFSPACE-60m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:series:PREALL-60m:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:earndesk:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:reserve:range:devnet-munllmer as venue (2 commands) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:reserve:parlay:devnet-munllmer as venue (2 commands) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:reserve:boost:devnet-munllmer as venue (2 commands) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:lp-invite:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:makerdesk:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:reserve:maker:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:arena:arena-1:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |
| 2026-09-30T04:21:22.226Z | C2y | DevNet bootstrap: prepared bootstrap:season:s1:devnet-munllmer as venue (1 command) | — | cce808c | prepare | pass: prepared, not executed |

</details>

<details><summary>real, attempt 1: 26 rows (1 fail)</summary>

| UTC | Stage | Scenario | Parity rows | Commit | Ledger evidence (update id / trace id / artifact) | Result |
|---|---|---|---|---|---|---|
| 2026-09-30T04:23:19.524Z | C2y | DevNet bootstrap: JSON API version | — | cce808c | GET /v2/version | pass: Canton 3.5.17 |
| 2026-09-30T04:23:19.524Z | C2y | DevNet bootstrap: parties file | — | cce808c | — | pass: 8 roles, 11 users |
| 2026-09-30T04:23:19.524Z | C2y | DevNet bootstrap: party venue (pm-venue::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:23:19.524Z | C2y | DevNet bootstrap: party resolver (pm-resolver::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:23:19.524Z | C2y | DevNet bootstrap: party oracle-coinbase (pm-oracle-coinbase::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:23:19.524Z | C2y | DevNet bootstrap: party oracle-kraken (pm-oracle-kraken::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:23:19.524Z | C2y | DevNet bootstrap: party oracle-bitstamp (pm-oracle-bitstamp::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:23:19.524Z | C2y | DevNet bootstrap: party auditor (pm-auditor::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:23:19.524Z | C2y | DevNet bootstrap: party lp (pm-lp::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:23:19.524Z | C2y | DevNet bootstrap: party agent-runner (pm-agent-runner::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:23:19.524Z | C2y | DevNet bootstrap: party alice (pm-alice::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:23:19.524Z | C2y | DevNet bootstrap: party bob (pm-bob::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:23:19.524Z | C2y | DevNet bootstrap: party outsider (pm-outsider::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:23:19.524Z | C2y | DevNet bootstrap: party seat-1 (pm-seat-1::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:23:19.524Z | C2y | DevNet bootstrap: party seat-2 (pm-seat-2::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:23:19.524Z | C2y | DevNet bootstrap: party seat-3 (pm-seat-3::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:23:19.524Z | C2y | DevNet bootstrap: party seat-4 (pm-seat-4::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:23:19.524Z | C2y | DevNet bootstrap: party seat-5 (pm-seat-5::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:23:19.524Z | C2y | DevNet bootstrap: party seat-6 (pm-seat-6::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:23:19.524Z | C2y | DevNet bootstrap: party seat-7 (pm-seat-7::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:23:19.524Z | C2y | DevNet bootstrap: party seat-8 (pm-seat-8::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:23:19.524Z | C2y | DevNet bootstrap: package abu-pm-main 0.5.0 | — | cce808c | GET /v2/packages/076dbb9246f8…/status | pass: id 076dbb9246f8… PACKAGE_STATUS_REGISTERED |
| 2026-09-30T04:23:19.524Z | C2y | DevNet bootstrap: package abu-pm-tickets 0.1.3 | — | cce808c | GET /v2/packages/a441ff5ab84b…/status | pass: id a441ff5ab84b… PACKAGE_STATUS_REGISTERED |
| 2026-09-30T04:23:19.524Z | C2y | DevNet bootstrap: package abu-pm-agents 0.2.1 | — | cce808c | GET /v2/packages/9bf15da97a74…/status | pass: id 9bf15da97a74… PACKAGE_STATUS_REGISTERED |
| 2026-09-30T04:23:19.524Z | C2y | DevNet bootstrap: package abu-pm-games 0.1.1 | — | cce808c | GET /v2/packages/158901a60ff5…/status | pass: id 158901a60ff5… PACKAGE_STATUS_REGISTERED |
| 2026-09-30T04:23:19.524Z | C2y | DevNet bootstrap: bootstrap writes | — | cce808c | trace id 31febb775b468fb6e47b7f5f5af0c0e5 | fail: HTTP 409 SUBMISSION_ALREADY_IN_FLIGHT: /v2/commands/submit-and-wait-for-transaction → 409 SUBMISSION_ALREADY_IN_FLIGHT: The submission is already in-flight |

</details>

<details><summary>real, attempt 2: 26 rows (1 fail)</summary>

| UTC | Stage | Scenario | Parity rows | Commit | Ledger evidence (update id / trace id / artifact) | Result |
|---|---|---|---|---|---|---|
| 2026-09-30T04:27:25.918Z | C2y | DevNet bootstrap: JSON API version | — | cce808c | GET /v2/version | pass: Canton 3.5.17 |
| 2026-09-30T04:27:25.918Z | C2y | DevNet bootstrap: parties file | — | cce808c | — | pass: 8 roles, 11 users |
| 2026-09-30T04:27:25.918Z | C2y | DevNet bootstrap: party venue (pm-venue::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:27:25.918Z | C2y | DevNet bootstrap: party resolver (pm-resolver::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:27:25.918Z | C2y | DevNet bootstrap: party oracle-coinbase (pm-oracle-coinbase::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:27:25.918Z | C2y | DevNet bootstrap: party oracle-kraken (pm-oracle-kraken::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:27:25.918Z | C2y | DevNet bootstrap: party oracle-bitstamp (pm-oracle-bitstamp::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:27:25.918Z | C2y | DevNet bootstrap: party auditor (pm-auditor::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:27:25.918Z | C2y | DevNet bootstrap: party lp (pm-lp::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:27:25.918Z | C2y | DevNet bootstrap: party agent-runner (pm-agent-runner::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:27:25.918Z | C2y | DevNet bootstrap: party alice (pm-alice::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:27:25.918Z | C2y | DevNet bootstrap: party bob (pm-bob::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:27:25.918Z | C2y | DevNet bootstrap: party outsider (pm-outsider::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:27:25.918Z | C2y | DevNet bootstrap: party seat-1 (pm-seat-1::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:27:25.918Z | C2y | DevNet bootstrap: party seat-2 (pm-seat-2::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:27:25.918Z | C2y | DevNet bootstrap: party seat-3 (pm-seat-3::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:27:25.918Z | C2y | DevNet bootstrap: party seat-4 (pm-seat-4::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:27:25.918Z | C2y | DevNet bootstrap: party seat-5 (pm-seat-5::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:27:25.918Z | C2y | DevNet bootstrap: party seat-6 (pm-seat-6::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:27:25.918Z | C2y | DevNet bootstrap: party seat-7 (pm-seat-7::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:27:25.918Z | C2y | DevNet bootstrap: party seat-8 (pm-seat-8::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:27:25.918Z | C2y | DevNet bootstrap: package abu-pm-main 0.5.0 | — | cce808c | GET /v2/packages/076dbb9246f8…/status | pass: id 076dbb9246f8… PACKAGE_STATUS_REGISTERED |
| 2026-09-30T04:27:25.918Z | C2y | DevNet bootstrap: package abu-pm-tickets 0.1.3 | — | cce808c | GET /v2/packages/a441ff5ab84b…/status | pass: id a441ff5ab84b… PACKAGE_STATUS_REGISTERED |
| 2026-09-30T04:27:25.918Z | C2y | DevNet bootstrap: package abu-pm-agents 0.2.1 | — | cce808c | GET /v2/packages/9bf15da97a74…/status | pass: id 9bf15da97a74… PACKAGE_STATUS_REGISTERED |
| 2026-09-30T04:27:25.918Z | C2y | DevNet bootstrap: package abu-pm-games 0.1.1 | — | cce808c | GET /v2/packages/158901a60ff5…/status | pass: id 158901a60ff5… PACKAGE_STATUS_REGISTERED |
| 2026-09-30T04:27:25.918Z | C2y | DevNet bootstrap: bootstrap writes | — | cce808c | trace id 677a56b484b9601c2e4aee7d95987819 | fail: HTTP 409 SUBMISSION_ALREADY_IN_FLIGHT: /v2/commands/submit-and-wait-for-transaction → 409 SUBMISSION_ALREADY_IN_FLIGHT: The submission is already in-flight |

</details>

<details><summary>real, attempt 3: 165 rows (139 writes with update ids)</summary>

| UTC | Stage | Scenario | Parity rows | Commit | Ledger evidence (update id / trace id / artifact) | Result |
|---|---|---|---|---|---|---|
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: JSON API version | — | cce808c | GET /v2/version | pass: Canton 3.5.17 |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: parties file | — | cce808c | — | pass: 8 roles, 11 users |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: party venue (pm-venue::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: party resolver (pm-resolver::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: party oracle-coinbase (pm-oracle-coinbase::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: party oracle-kraken (pm-oracle-kraken::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: party oracle-bitstamp (pm-oracle-bitstamp::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: party auditor (pm-auditor::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: party lp (pm-lp::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: party agent-runner (pm-agent-runner::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: party alice (pm-alice::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: party bob (pm-bob::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: party outsider (pm-outsider::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: party seat-1 (pm-seat-1::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: party seat-2 (pm-seat-2::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: party seat-3 (pm-seat-3::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: party seat-4 (pm-seat-4::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: party seat-5 (pm-seat-5::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: party seat-6 (pm-seat-6::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: party seat-7 (pm-seat-7::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: party seat-8 (pm-seat-8::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: package abu-pm-main 0.5.0 | — | cce808c | GET /v2/packages/076dbb9246f8…/status | pass: id 076dbb9246f8… PACKAGE_STATUS_REGISTERED |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: package abu-pm-tickets 0.1.3 | — | cce808c | GET /v2/packages/a441ff5ab84b…/status | pass: id a441ff5ab84b… PACKAGE_STATUS_REGISTERED |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: package abu-pm-agents 0.2.1 | — | cce808c | GET /v2/packages/9bf15da97a74…/status | pass: id 9bf15da97a74… PACKAGE_STATUS_REGISTERED |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: package abu-pm-games 0.1.1 | — | cce808c | GET /v2/packages/158901a60ff5…/status | pass: id 158901a60ff5… PACKAGE_STATUS_REGISTERED |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: bootstrap writes | — | cce808c | — | pass: 139 executed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:desk:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220e6d9764cefaf71c793670079cead9835fc4fe6142742b4b467b309038dd167d5 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:shards:devnet-munlwuoq as venue (16 commands) | — | cce808c | update 122085b5495dde2963bba8e824d80ed168dd9807e33903e43cec73125fcb1880e9ff | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:BTC-1m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220951f4b1ba2913ca006eeb561a85e56240c0f01ebde05cf0da9069496806d3ce4 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:BTC-5m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220cef0d3cddc1b493f9989e150300e29533c9ac1fbfbb1021ee6d7e9560f193bf5 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:BTC-15m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 12205a448839947a1e86b8fc9775361a73994d698663b3aa972611626a1a9011879f | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:BTC-60m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220daab30174d7bcbc944b7ebeb376ed5455152ca2ae8bf21e575907f50baba9a69 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:BTC-240m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 12209d30a1af6167fe7da53bed3837db12baa47c9ff16758a6909ee74ac1b98c1443 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:BTC-1440m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 12200ec92834d9f25dfa8ec5bb16a526f68deadd924cd162d2b66115e40e8bbdf3e9 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:ETH-1m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220d2eeaae7457714f01ac2e249daf8217a383a8b432e6691ca22f50aa66719bab0 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:ETH-5m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220ac6b7f3c495f7b3ed4d237abccee2c44371fc815097e969e8b00991fbe587565 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:ETH-15m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220926c38b4b060e97ef41b769487957fe7b8124195c10295f4c38c503dd6c5f841 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:ETH-60m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220251bc56ad8393d415b08ae3380da43782c2f38639f2ed11fa2b3102e227cf936 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:ETH-240m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220f4bb04c022405400dca05dfe4f80e5f62cbb1a46bb675819091c37af40ad5e71 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:ETH-1440m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220bbfd3d1193bd8d341e20100f87edb120f1ea167751fe844afda00ccebe843afb | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:TSLA-5m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 122009b48414e604cee1b8ff13f2cb7855c42ce7bee1022c3681a04cda4698743fcc | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:TSLA-15m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 12202d4962c6734ce547fb818c176b2d329a8aa7b5aab662bdca852f84992abcff7f | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:TSLA-60m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220b5a16e85d5f98e3a3f0feb97b6ecc69e38f3980269ef29fcca017abf9f53efec | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:NVDA-5m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 122007cecd9463256bee07ca26f383b189d69a90c1c7fdfc9d37df1a11bb095f8543 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:NVDA-15m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 12209194529cd3f1a6ae5371ad6ad992efef6c260016b666a17fdadbfa2e876298c0 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:NVDA-60m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220dff4f6af00ce2040080925bf51fc4f5b0f4e5f54abfc7dd6a97f1aac4c927fd5 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:AAPL-5m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220c6c7f1b06963d17f5ca9b81a2602fd3d15bddd7016136a088b50e9fa4bb19579 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:AAPL-15m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 12204f755f18c2a4351cb556b94de4e0fac53b65663899d2d8a06e1033867997d7ad | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:AAPL-60m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 12206ed795420633091bc716b09729f70945c0ff6621993e446899f651cc67087a17 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:MSFT-5m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 12205e6aaf77bec4f47b320796bd103f53ec970c27a375a58eaf9e591c80761fa2bf | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:MSFT-15m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220547680ab4cfe301b162855175052449e7ad56d62299a2a788431600df1074a8c | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:MSFT-60m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220d281b5b51f9739ee5c8b1f8e35b968c04c0285206f761b270335f18907fda0dd | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:META-5m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220fa14f759ba7d1601839a7dc192efb65207bc8aa3cbf5615fbc926eb330c2fc02 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:META-15m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220d076d61478c61ad4bc2f0ab01451ea804b68d04fb71477130bb701b9e7e5765f | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:META-60m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220a23b1d5c45e8c320d0251bbbf786126e319e9c5d59ea7b7e175e715f1043f5b3 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:AMZN-5m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 12203e16a4bf2c37d506b3a67f845f520371b2ba994a97eba26fc1afce047e1aef7a | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:AMZN-15m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220315c2243120caa226a6432796c4ed3ce23b45a09eb40371f6dc0484dccbfb365 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:AMZN-60m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220c9f9f037a4e8c3d506a6bdab6266d8d601904be36b42b253f5bbff1e33364909 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:GOOGL-5m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220641a023a804f273dd2d62dbc68dd6e250ef855c4a3062f6296c13311654364ce | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:GOOGL-15m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 122001c56f129db03feead22613cc3ffbcc30189b3d8c0f2368ba4ab342de6b6f47d | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:GOOGL-60m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 12207cfe83e8d5ecff5b08c23941e4ffc15c26b083fddded6e9fa19fe818ac5943d7 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:QQQ-5m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 122017bb7fe990bc19cddf3aab955c0a74c8c3b00e1b5bafdfcd0b20f102adfd9c6d | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:QQQ-15m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220d7891d48cbfbca0c8269c5d641e74eb6956fd3d907245d491d42183499bcca4d | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:QQQ-60m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220c0be0dbe78a097645558fc0506b5727f02b1e465d3bbda449fb8eb279bcfc3e2 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:VOO-5m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220a692eaf358e02d154f0bca76faa05eff508fc082179f47450520b15ecc13b7fd | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:VOO-15m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 12201bbfea019f5fbf2e73029b299e02423005be824f5b6e9d47052ee0ba7a98fa3e | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:VOO-60m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 12209793ac5e534dd4337b48f3607b51f2cf968e435b224284d6f3168502c931e65d | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:TSLAx-5m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220eafcc24d9d6c1bce7b6607c0932e91ca4229445b006a08a75e41aaaa15f3b3eb | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:TSLAx-15m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220471566db956e984b0b3a43cc1e1b78128614dda60e5116fc1d02a24dd2578b9c | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:TSLAx-60m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220465e6ddcd6b79aa4d36eea2b75799682bae5159dc80297c94948c5a8b90a4986 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:NVDAx-5m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220b89bddd9e2c197a0ab773079e0b50fb61df6ac37054a130f713e18a627d85c2e | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:NVDAx-15m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 12205a3c2f3b24ef481f239d2239a936b280e0ac07a0ecf47386114e1e4eb2003689 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:NVDAx-60m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 12201d939907cd28e7b18a9105615d3ed046a2e45f460d74de416d504a9ac3b011ab | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:QQQx-5m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 12202d407f5b74c29c9963a0c2ade1fe51f87934f59235afd7863017cd47530d4592 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:QQQx-15m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220d3693f9a1c8d7b9e1b507a8fed3f97b70e42c6d5bdcfeafe0077600a03f5e2c3 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:QQQx-60m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 122057ab0cd68145866c3c3d452e40b5e00b6c296cb06d8717e3b6a1c6d383292206 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:SPYx-5m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220ab31ca91cc87cb1a7609af70e691857e7f3712eb489273c95d7482d22dd23e5f | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:SPYx-15m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 12205b8e503beb9f6a8353cf31a3cdf571168fa33441ecb1daa4da1a7cddb78f9a26 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:SPYx-60m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220bacc6fd8c8996dcd02e4d611c500a3d81d550aa19be1912f418fd7c5bea332d5 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:TSLA-gap:devnet-munlwuoq as venue (1 command) | — | cce808c | update 122052ee7c8db7f80c159ce43ed30e590aefc568ae7b276f9aaf7139673edcba1ac0 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:NVDA-gap:devnet-munlwuoq as venue (1 command) | — | cce808c | update 12208e8e7af9f3769cb3cc83a32257a49bf2baf813c79217dbde93d3cc47e4fbe234 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:AAPL-gap:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220e35ceef13478650992db914dec809d49aa9250a2cb7af8d57263f6de502921f4 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:MSFT-gap:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220137e9cfc1df62e92586bddfac6397c3c3b47e5d0d8632461b7a6e5487619b190 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:META-gap:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220b9a7bba6fad149a4d06d2813fd9d035ad7167b82a876678ec6c90c524f60f2d6 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:AMZN-gap:devnet-munlwuoq as venue (1 command) | — | cce808c | update 122027bc2e861164df9c24d75440e2efdaca37a625e5e304b3cc20a060b3b4529ab7 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:GOOGL-gap:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220ad997098b1ba19aa3964b9075e92d7a12f82801a4d491f1f3f3d1e9513b9552c | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:QQQ-gap:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220833654c4d58719fba9ec645d018a8e551937bdd1dd3163081f763c7dfeba0c5f | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:VOO-gap:devnet-munlwuoq as venue (1 command) | — | cce808c | update 122053a65a81d22826549512c425e2d69ee500ffe09b357dc581e198d434827a4713 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:OPENAI-60m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220366e1916532cb14753550830c0ba408fcf85ac388d90c6fa2cbb49a47a511878 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:ANTHROPIC-60m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 122071f9bb6a05124efafad6dad1f380fd366df46c36e754c5c66fb3919d2dd87312 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:SPACEX-60m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220fbe3be514ec01e22b093e7ac6c18564aa78a7f9b6279e02da77a497e8b502deb | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:NEURALINK-60m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 122007394214b2cb432a072702c2dd867e2ff0441cde4827721d123cf01d5c9a1383 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:ANDURIL-60m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 12201d1064480796fbe8be07008ee9c43f4e6612162da3ee7753053b6bbd61983dee | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:KALSHI-60m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220b0c7352dc6fb55d0fcd752bbc7daeeb532feca6275eafb06f7c40ecdfb4adc91 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:POLYMARKET-60m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220683d0a670cccb804e1b298e5b255ad2b17c8e56bebc987db1458d0fe09cbaa28 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:FIGUREAI-60m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220bd8f0800df3a2ec77f93edb7a75a950af227b014e6871c098cac2f3b3de5ac3f | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:AILABS-60m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 12201d82e827535ad8c32c4a0724777c2d6919bf327d85822f2b6b54e335eecaa1d4 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:FRONTIER-60m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 12206fff35b6ab58dba62838d5879d17762766b5c02c8899e5ebfa53b58e1ea9b664 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:PREDMKTS-60m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 12209b332114b2347937e69b2e4dbc6addd62e821f407f36332f7e2fc6148a4fafdb | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:DEFSPACE-60m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220c41bfc15161be4232e2a173d7b9990eb188ede0b5ce52c12689477c7d8ae0a9d | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:series:PREALL-60m:devnet-munlwuoq as venue (1 command) | — | cce808c | update 12204ff0c53b32728e53ed25f3ccd33a7d59eb23d142acef3826d92e3b5af8ec76b4 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:earndesk:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220d9766ffd872755dcff2b53dd52b588b540654ca2d8335c9eb4c11743fb346153 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:reserve:range:devnet-munlwuoq as venue (2 commands) | — | cce808c | update 122002e28d007f8f7f48ebd2ddc74ae50eb0cb35680b08b4b0643540242cfa9e5190 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:reserve:parlay:devnet-munlwuoq as venue (2 commands) | — | cce808c | update 1220bb672b3e94d5976b5775be0d9dfa48c67f2eaf654bb53eee4c70511b36ebe0e4 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:reserve:boost:devnet-munlwuoq as venue (2 commands) | — | cce808c | update 1220159c9aff4afc74b97c57488ee2d63b4393ad9a7ac6743492e1fd686368a08398 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:lp-invite:devnet-munlwuoq as venue (1 command) | — | cce808c | update 12206d9a12436bba53f063a5623c91cd562e4bea7245a29a09122a2d9314b134ea85 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:lp-accept:devnet-munlwuoq as lp (1 command) | — | cce808c | update 1220a75561bbc894d6532da64516053204705a3bb2ac7a4638af94e63af3d8413bcb | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:lp-credit:range:0:devnet-munlwuoq as venue (1 command) | — | cce808c | update 12201925a051bf1b0fb915017dc84f2ecfbf1d0fbf1f5ba583392cdf64f982a9c851 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:supply:range:0:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220ba12bb5574ed7bf795d4a4273aa456d9c5e96bd23c8670cd0af58f1b994c1c0f | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:supply-accept:range:0:devnet-munlwuoq as lp (1 command) | — | cce808c | update 1220395e9b0169598e0e9fc849039c4bfe2793bbf014215f4698eb0c6cc5c1b26a9c | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:lp-credit:range:1:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220ee191f88c75c680310107e60e299ee3488b7bae61806a64aa7c07eeab88cd004 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:supply:range:1:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220334b9655ce1f1858c7abfefdaca7b7ca141ed967c409f25d69026f7f4b8bd21d | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:supply-accept:range:1:devnet-munlwuoq as lp (1 command) | — | cce808c | update 1220866f5f65864653b4a10f9508c825a0921228a4e890ddd3c41598d4199f41dd39 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:lp-credit:range:2:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220e7a891ab68f96e7c9a8f0a09b13d27b8786db631fae9c3842cc4419a8616646f | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:supply:range:2:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220ce0d058c26a1938f9af8ac1044b96a68d3819e4c1380bb7f615b20bb5096d20a | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:supply-accept:range:2:devnet-munlwuoq as lp (1 command) | — | cce808c | update 1220774c328cbd8ceff885283ec76af91b2e91ab85f513de6a8eb4422be9c1b60f36 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:lp-credit:range:3:devnet-munlwuoq as venue (1 command) | — | cce808c | update 12207a0d14c91e9f28c7cb04a8ee586226712d445347dd1b4e8fc04ab7873516a22d | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:supply:range:3:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220a1f9df1b0d6f907502b86358a51d256cd158985c978e76c513d05c808bfc27e8 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:supply-accept:range:3:devnet-munlwuoq as lp (1 command) | — | cce808c | update 12205f8a69c681415b7d6460883eb65b63322f62e38d6404caa061864be9ae67e89d | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:lp-credit:parlay:0:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220b7ae978a811c85ee31c55554ea7207be9034788a8c989faed3572c355470d0fa | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:supply:parlay:0:devnet-munlwuoq as venue (1 command) | — | cce808c | update 12209f621af035c5c648948e7f4f858d5a60d202d2f892c23837b403c27eccdc8c55 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:supply-accept:parlay:0:devnet-munlwuoq as lp (1 command) | — | cce808c | update 1220bfc11d81fb46121c34fa23743985215bf8818f7b6eb3c9e098b4f5652f5fafb5 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:lp-credit:parlay:1:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220474a2eac9196a42ba0cecca5e8d4cf9254d87e9b23249725b9d8cf06e1927ebf | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:supply:parlay:1:devnet-munlwuoq as venue (1 command) | — | cce808c | update 122078ed22610e5f03ff2381143a8d67533a3c1e20fb8772f3c0bfc5f8bbafa7e29f | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:supply-accept:parlay:1:devnet-munlwuoq as lp (1 command) | — | cce808c | update 12206d2c644d06546161008386b0619c0a46ad7472e8bdaef6a123db4ab72f40a087 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:lp-credit:parlay:2:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220b28bee49727558a3c73529f5f966c258f79624e20c6cc4662987c92ad47478c2 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:supply:parlay:2:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220a5dd7cb9c7bb664124ab78dc3650cad1940eb3ce002932d51f02572216982468 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:supply-accept:parlay:2:devnet-munlwuoq as lp (1 command) | — | cce808c | update 1220256209d9efe4802eb9fd4dc79b20d14820d8a522a5d47541276158eb453300ae | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:lp-credit:parlay:3:devnet-munlwuoq as venue (1 command) | — | cce808c | update 12205a3839415701560a8c37c276c9f21e4cb6e06d77dc093fe3b671582b995dc152 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:supply:parlay:3:devnet-munlwuoq as venue (1 command) | — | cce808c | update 122022dba1dfa96960ea1180f5e2a6d7a8173def7390bf2ff1da2e7640eacb03e123 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:supply-accept:parlay:3:devnet-munlwuoq as lp (1 command) | — | cce808c | update 1220a22f06d07dacefe8f7c16efad17340ff963e32f9719cac53bf2bb7bdcd9a7fef | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:lp-credit:boost:0:devnet-munlwuoq as venue (1 command) | — | cce808c | update 12205e198cdfa77cda89d3b16ebb9b6f4028ea906c21d8f9d3468678a1f9b76898ad | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:supply:boost:0:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220bd4e3dbd382b15b8fa1ba000e961cc1a522d2d32f0653cbfe1142bfe8668a526 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:supply-accept:boost:0:devnet-munlwuoq as lp (1 command) | — | cce808c | update 12209f14b8ca4073e09a737afb78bbf66df404bd38d89a1b101f36f1a46cc824b24d | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:lp-credit:boost:1:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220adf085d8894428f39f8bcc0d285c167da1ce9d6b7f91298a11cb23c2bcedaa9a | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:supply:boost:1:devnet-munlwuoq as venue (1 command) | — | cce808c | update 122075192c36cf1ff7d1bbd9fd00d842210b4a1776015066e07b887a3655e25b30df | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:supply-accept:boost:1:devnet-munlwuoq as lp (1 command) | — | cce808c | update 1220244cb7a10f53ffebdc41f46776355441b46220d7fc0c5106fb088849d3942e63 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:lp-credit:boost:2:devnet-munlwuoq as venue (1 command) | — | cce808c | update 12204b347390e0ca1c71b983f3ae797cd89a17243acc9717824f7e6370cac3be3d11 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:supply:boost:2:devnet-munlwuoq as venue (1 command) | — | cce808c | update 122026a89ad3fde743b1c531c8ebf311f9e00cdc887998d4d0f766117bbf2304a985 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:supply-accept:boost:2:devnet-munlwuoq as lp (1 command) | — | cce808c | update 12206321e6114aef06ce9d84ccb64d9d32aad1944335bcb5501074aab9dde33e5bf0 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:lp-credit:boost:3:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220a7a6dfac34acbeb7690eedb1c931cf38751717fb1ea8b3987b81f537d9c6501c | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:supply:boost:3:devnet-munlwuoq as venue (1 command) | — | cce808c | update 12200cc7e0bb96b21b6b08644694c5f42d4031e5efc9af71611cac29ef66f348e23e | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:supply-accept:boost:3:devnet-munlwuoq as lp (1 command) | — | cce808c | update 122064f1f4e92f826c450877aa65ffd09e92b61addcbd57cffa0cd3c7042b16a3c6a | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:nav:range:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220fac4d8a128106dee292aecd3bca74e00289d2101557792b481ab3d5db15be551 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:nav:parlay:devnet-munlwuoq as venue (1 command) | — | cce808c | update 12207033c8ac898890517c9e8a60a83053e349942e4915e7302fe12dd6bf1502c26d | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:nav:boost:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220d8d06a012fd152263c764913b834fa0d0e93ff865dbaee93f02e3af83c322118 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:makerdesk:devnet-munlwuoq as venue (1 command) | — | cce808c | update 122049034432d66a5e7194dde51e93cf2d0a92bd20d2f7066c9232ec2244fee91ba2 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:reserve:maker:devnet-munlwuoq as venue (1 command) | — | cce808c | update 12209dc16ffcb21285e3ac2b4941a951c6d84903e52939a92c18d959c7052963eed9 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:lp-credit:maker:0:devnet-munlwuoq as venue (1 command) | — | cce808c | update 122078afdbc28ccdff44838b506a649d9783569ce7677e7f6693465a9ed0f4fd393c | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:supply:maker:0:devnet-munlwuoq as venue (1 command) | — | cce808c | update 12207903efcd058c9aae54ea080e723d8ac0c1db449945031af7097112e2f519ee59 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:supply-accept:maker:0:devnet-munlwuoq as lp (1 command) | — | cce808c | update 12204b4e8fd200a2a85f3c7d7f2408e5e4ceafb34e26d356d50b1e372cc978abfc64 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:lp-credit:maker:1:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220d14424b8e6514a45dcae1633b6e3fa81a4c89f290dcf209bb4765416141c036a | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:supply:maker:1:devnet-munlwuoq as venue (1 command) | — | cce808c | update 12208367d9d2fa924516ace3e70fcc76c8ca3bc4949321b8449c1f0f14dec7c514b6 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:supply-accept:maker:1:devnet-munlwuoq as lp (1 command) | — | cce808c | update 1220e1562a42148c199c5f3ed0989f4739958a4844ba830c36d09318e2ddb34adf4c | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:lp-credit:maker:2:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220c4b054f3011e03a684a2851dc64cb8c4240f1c485910476b2ddccc598d9c86a4 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:supply:maker:2:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220079e65092505b084938f8bf5f8ac2cd25110192aee950120ec834bac99dd139f | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:supply-accept:maker:2:devnet-munlwuoq as lp (1 command) | — | cce808c | update 122026b31ab442eea40eeebf89131fdfbdec84afdbb339a22d04021921e356915d67 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:lp-credit:maker:3:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220be41a1ac1e93c832db34eb0e4a763932a73ec6894a7680657b30567f3bf050ba | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:supply:maker:3:devnet-munlwuoq as venue (1 command) | — | cce808c | update 12200f79ae6f3d68777f38148049389693a6080e44aa6a241c6608accbbab5e89ae0 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:supply-accept:maker:3:devnet-munlwuoq as lp (1 command) | — | cce808c | update 1220931395bf1cb83cf5ac1576266548def32ac5702213a8fbec64bc0694aa8a8dfc | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:nav:maker:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220825342cde7b0a6f26c924bccc05a66b4b48eac9604a16fc2658a58acc6606084 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:arena:arena-1:devnet-munlwuoq as venue (1 command) | — | cce808c | update 122014e6b0dc5ab77ef46c44017b18bcb5fd529b1d28a127711c27f783864fbecf85 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:season:s1:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220a80488c4de559103cdca21e2bc88824927bd572c3a7c158eda40b62f11a7bed9 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:season-shard:s1:devnet-munlwuoq as venue (1 command) | — | cce808c | update 1220cdc002b5d2b5e5ed311e796bf6c11f913cb85c7e2ee4d401ab7942dea217f142 | pass: committed |
| 2026-09-30T04:30:05.746Z | C2y | DevNet bootstrap: sent bootstrap:season-fund:s1:devnet-munlwuoq as venue (1 command) | — | cce808c | update 12205701e76eab1eb46126f177069753b0a49dfaa43024b3ab803abe8c71ce1af12e | pass: committed |

</details>

<details><summary>re-run: 26 rows (0 executed)</summary>

| UTC | Stage | Scenario | Parity rows | Commit | Ledger evidence (update id / trace id / artifact) | Result |
|---|---|---|---|---|---|---|
| 2026-09-30T04:36:29.437Z | C2y | DevNet bootstrap: JSON API version | — | cce808c | GET /v2/version | pass: Canton 3.5.17 |
| 2026-09-30T04:36:29.437Z | C2y | DevNet bootstrap: parties file | — | cce808c | — | pass: 8 roles, 11 users |
| 2026-09-30T04:36:29.437Z | C2y | DevNet bootstrap: party venue (pm-venue::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:36:29.437Z | C2y | DevNet bootstrap: party resolver (pm-resolver::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:36:29.437Z | C2y | DevNet bootstrap: party oracle-coinbase (pm-oracle-coinbase::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:36:29.437Z | C2y | DevNet bootstrap: party oracle-kraken (pm-oracle-kraken::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:36:29.437Z | C2y | DevNet bootstrap: party oracle-bitstamp (pm-oracle-bitstamp::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:36:29.437Z | C2y | DevNet bootstrap: party auditor (pm-auditor::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:36:29.437Z | C2y | DevNet bootstrap: party lp (pm-lp::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:36:29.437Z | C2y | DevNet bootstrap: party agent-runner (pm-agent-runner::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:36:29.437Z | C2y | DevNet bootstrap: party alice (pm-alice::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:36:29.437Z | C2y | DevNet bootstrap: party bob (pm-bob::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:36:29.437Z | C2y | DevNet bootstrap: party outsider (pm-outsider::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:36:29.437Z | C2y | DevNet bootstrap: party seat-1 (pm-seat-1::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:36:29.437Z | C2y | DevNet bootstrap: party seat-2 (pm-seat-2::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:36:29.437Z | C2y | DevNet bootstrap: party seat-3 (pm-seat-3::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:36:29.437Z | C2y | DevNet bootstrap: party seat-4 (pm-seat-4::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:36:29.437Z | C2y | DevNet bootstrap: party seat-5 (pm-seat-5::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:36:29.437Z | C2y | DevNet bootstrap: party seat-6 (pm-seat-6::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:36:29.437Z | C2y | DevNet bootstrap: party seat-7 (pm-seat-7::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:36:29.437Z | C2y | DevNet bootstrap: party seat-8 (pm-seat-8::…) | — | cce808c | GET /v2/parties/{party} | pass: hosted on this participant |
| 2026-09-30T04:36:29.437Z | C2y | DevNet bootstrap: package abu-pm-main 0.5.0 | — | cce808c | GET /v2/packages/076dbb9246f8…/status | pass: id 076dbb9246f8… PACKAGE_STATUS_REGISTERED |
| 2026-09-30T04:36:29.437Z | C2y | DevNet bootstrap: package abu-pm-tickets 0.1.3 | — | cce808c | GET /v2/packages/a441ff5ab84b…/status | pass: id a441ff5ab84b… PACKAGE_STATUS_REGISTERED |
| 2026-09-30T04:36:29.437Z | C2y | DevNet bootstrap: package abu-pm-agents 0.2.1 | — | cce808c | GET /v2/packages/9bf15da97a74…/status | pass: id 9bf15da97a74… PACKAGE_STATUS_REGISTERED |
| 2026-09-30T04:36:29.437Z | C2y | DevNet bootstrap: package abu-pm-games 0.1.1 | — | cce808c | GET /v2/packages/158901a60ff5…/status | pass: id 158901a60ff5… PACKAGE_STATUS_REGISTERED |
| 2026-09-30T04:36:29.437Z | C2y | DevNet bootstrap: bootstrap writes | — | cce808c | — | pass: 0 executed (everything was already on the ledger) |

</details>


## 4. Ops and web on the bootstrapped venue

Ops booted against the parties file. The roller opened BTC-1m, ETH-1m and BTC-5m Windows. The three oracles posted every open and close (3/3), and the resolver recorded and resolved, e.g. `BTC-1m:17 04:47Z Down 83285.57 → 83266.4 (3 oracles)`. The settler, issuer (a pool of 16 shards) and seat funding all ran, and `/health` was `ok: true` throughout. The web answered `GET /api/seat` with `{"kind":"none"}`.

## 5. `scripts/drive/first-call.ts --network local`

```
LEDGER_AUTH_MODE=none LEDGER_JSON_API_URL=http://localhost:7525 \
  pnpm --filter @agari/scripts exec tsx drive/first-call.ts --network local --parties <scratch>/canton/parties.devnet.json --ops-pid <ops node pid>
```

| Run | Commit | Time | Rows | Notes |
|---|---|---|---|---|
| 1 | `441a19a` | 2 min 43 s | 15/17 | The owner view and the venue view failed. B waited for the next 1-minute Window, and by then A's Window had resolved and A's leg was settled. Fixed in C2z.5: the views are read right after each accept |
| 2 | `441a19a` + the C2z.5 change, uncommitted | 2 min 11 s | 17/17 | A won: paid 110.00 credits without signing |
| 3 | `b2be55e` | 2 min 23 s | 17/17 | A won: paid 132.00 credits |
| 4 | `b2be55e` | 2 min 02 s | 16/17 | "void on disagreement" failed (`deadline-not-exceeded`, trace `dda1857f9e2febeb2999d0288317a765`). The run started under 2 min after run 3, so its Window's start was a few seconds ahead. Ops' resolver voided the Window 7 s later from the same prints, and the refund row passed. Fixed in C2z.6 |
| 5 | `57ade20` | 1 min 43 s | 17/17 | A won: paid 63.00 credits; the drive's own resolver session recorded the void |

The outsider's query, as the web sent it to the participant (run 5; the party's fingerprint is masked here, and the drive prints it whole):

```
{"eventFormat":{"filtersByParty":{"pm-outsider::1220…":{"cumulative":[{"identifierFilter":{"TemplateFilter":{"value":{"templateId":"#abu-pm-main:PM.Money:VenueCash","includeCreatedEventBlob":false}}}},{"identifierFilter":{"TemplateFilter":{"value":{"templateId":"#abu-pm-main:PM.Quote:Quote","includeCreatedEventBlob":false}}}},{"identifierFilter":{"TemplateFilter":{"value":{"templateId":"#abu-pm-main:PM.Leg:Leg","includeCreatedEventBlob":false}}}},{"identifierFilter":{"TemplateFilter":{"value":{"templateId":"#abu-pm-main:PM.Market:Resolution","includeCreatedEventBlob":false}}}},{"identifierFilter":{"TemplateFilter":{"value":{"templateId":"#abu-pm-main:PM.Market:MarketTerms","includeCreatedEventBlob":false}}}}]}},"verbose":true}}
```

Run 5's rows (`57ade20`):

| UTC | Stage | Scenario | Parity rows | Commit | Ledger evidence (update id / trace id / artifact) | Result |
|---|---|---|---|---|---|---|
| 2026-09-30T05:06:34.607Z | C2z | first-call, local rehearsal: preflight | — | 57ade20 | GET /v2/version | pass: Canton 3.5.17; the web answers /api/seat; venue pm-venue::… |
| 2026-09-30T05:06:36.094Z | C2z | first-call, local rehearsal: lease seat A (Alice) and seat B (Bob) | — | 57ade20 | POST /api/seat ×2 | pass: seat A (Alice) → pm-seat-1::… lease 6e113018-97f9-4ac8-82a1-580fe78bc2ca, funded; seat B (Bob) → pm-seat-2::… lease b6e1d19a-6120-4b8a-a305-8f5760d75a5c, funded |
| 2026-09-30T05:06:36.820Z | C2z | first-call, local rehearsal: quote (seat A, Up, a firm quote from ops) | — | 57ade20 | update 1220afbdad0e7a94efebde476f6cb2b2c035d183b5cea9a87e7f9809a40239da8d95 (Desk_IssueQuote by ops) | pass: BTC-1m Window BTC-1m:36: 63 lots Up at 973 (cost 61.30 + fee 0.02 credits), valid until 05:06:50Z |
| 2026-09-30T05:06:37.003Z | C2z | first-call, local rehearsal: prepare (dry run of seat A's accept shows the cost) | — | 57ade20 | POST /v2/interactive-submission/prepare | pass: prepared, not executed (hash TNi9zOb+p/aEsL87…): the call costs 61.32 credits = stake 61.30 + fee 0.02; 0 bytes of traffic; the seat holds 1000.00 in 1 cash contract(s) |
| 2026-09-30T05:06:37.663Z | C2z | first-call, local rehearsal: accept (seat A, through the web) | — | 57ade20 | update 122047898a3ae2b2542c8d808ca721ddc6f24c4a8ca3b4c575953e866c6388c557aa | pass: pm-seat-1::… holds leg 00eb216095b7…: 63 lots SideUp, cost 61.30 + fee 0.02 |
| 2026-09-30T05:06:37.695Z | C2z | first-call, local rehearsal: owner view (seat A: /api/view?as=me) | — | 57ade20 | GET /api/view?as=me at offset 1792 | pass: queried as pm-seat-1::…: 2 rows (PM.Money:VenueCash, PM.Leg:Leg); A's leg 00eb216095b7… is there |
| 2026-09-30T05:06:37.712Z | C2z | first-call, local rehearsal: outsider empty (/api/view?as=outsider, while seat A holds its leg) | — | 57ade20 | GET /api/view?as=outsider at offset 1792 | pass: 0 rows; body {"eventFormat":{"filtersByParty":{"pm-outsider::1220…":{"cumulative":[{"identifierFilter":{"TemplateFilter":{"value":{"templateId":"#abu-pm-main:PM.Money:VenueCash","includeCreatedEventBlob":false}}}},{"identifierFilter":{"TemplateFilter":{"value":{"templateId":"#abu-pm-main:PM.Quote:Quote","includeCreatedEventBlob":false}}}},{"identifierFilter":{"TemplateFilter":{"value":{"templateId":"#abu-pm-main:PM.Leg:Leg","includeCreatedEventBlob":false}}}},{"identifierFilter":{"TemplateFilter":{"value":{"templateId":"#abu-pm-main:PM.Market:Resolution","includeCreatedEventBlob":false}}}},{"identifierFilter":{"TemplateFilter":{"value":{"templateId":"#abu-pm-main:PM.Market:MarketTerms","includeCreatedEventBlob":false}}}}]}},"verbose":true}} |
| 2026-09-30T05:06:38.724Z | C2z | first-call, local rehearsal: killed submit reconciled (seat B's accept, response dropped, same commandId re-sent) | — | 57ade20 | update 1220894b858036716a084ea2166a82c5d4bc2cc22b2a01ccf0c72daf22bda771bb87 | pass: the web answered 200 and the client got a dropped socket; the re-send answered confirmed, recovered true; pm-seat-2::… holds 1 Leg for pair 544927d4-b068-4e3a-a442-a6aff4d466db |
| 2026-09-30T05:06:38.866Z | C2z | first-call, local rehearsal: second seat empty (seat B and the alice/bob personas see none of A's contracts) | — | 57ade20 | GET /api/view?as=me\|alice\|bob | pass: seat B 2 rows, 0 of A's; alice 0 rows, 0 of A's; bob 0 rows, 0 of A's; B sees its own leg |
| 2026-09-30T05:06:38.867Z | C2z | first-call, local rehearsal: venue view (the fourth viewpoint: the counterparty sees both legs) | — | 57ade20 | POST /v2/state/active-contracts as the venue | pass: as pm-venue::…, read right after each accept: seat A's leg 00eb216095b7… and seat B's leg 0023e9161c09… |
| 2026-09-30T05:07:15.360Z | C2z | first-call, local rehearsal: three attestations (the Window's close) | — | 57ade20 | updates 122031abcbd4468a3e1c8dd76bb5352942a136a88efa657b296c41b8a7937984097c, 1220a2323ac528247e4746bea4e653c324b73f5245af3d6f4087a9f6c2eaad9ace25, 1220a92420703e540f956c90ef3499e733fe02868863606acb7b0592ab4f8215f1be | pass: 3 of 3 oracles counted at 2026-09-30T05:07:00.000Z: pm-oracle-bitstamp::… 83284.99, pm-oracle-coinbase::… 83277.23, pm-oracle-kraken::… 83278.70 |
| 2026-09-30T05:07:15.363Z | C2z | first-call, local rehearsal: resolve (the resolver, from the prints) | — | 57ade20 | update 1220564ecadf3a9288a4ee7cdaa0d28c7eabb655bcf00280d39e9cd5ef35a00ced52 | pass: SideUp (open 83254.99 → close 83278.70), signed by pm-resolver::… |
| 2026-09-30T05:07:15.384Z | C2z | first-call, local rehearsal: settle (the venue pays; neither seat signs) | — | 57ade20 | updates 1220a1d5263cf46de88e1e51b128716849047341031fffefb2f016254e1a262a44a7 | pass: seat A (Alice) SideUp won: paid 63.00 credits; seat B (Bob) SideDown lost: paid 0 credits; no command from either seat after its accept |
| 2026-09-30T05:07:17.021Z | C2z | first-call, local rehearsal: void market: open, venue quote, accept (seat A) | — | 57ade20 | open 122017957f475f11a76cb593ce2ca5a906f5954be30799845de70c60b91044bb4d5c, quote 122066311f6160b65ad3a48f1ef9996fd237bfa397ce3ebf814a44ed1cdf2602dfbc, accept 1220fd3bb01fcad9d0f63868edd436896b30b8d71e65db0ab13a8af9a601e78a0d83 | pass: Window first-call-void:4: seat A holds 10 lots Up at 600 (cost 6.00 + fee 0.05 credits) |
| 2026-09-30T05:07:18.449Z | C2z | first-call, local rehearsal: void on disagreement (the three opens disagree) | — | 57ade20 | prints 122073f356fbe3ede38986da59002a9fcb6f139927a5c7de35abc74b792a4c299d08, 1220735473a1fb67b28eeb40b6d2e4a91aed7ee8edad4bcd6258ab8f596823b36114, 1220b9162649813be5c459c243032d0f6146ef10cb8aedc08dcb3d6d20677810d870; void 1220a80a4c4c0033094743e903183cd3c8495416de85ce929a03466a98f81ddba0e7 | pass: prints 1.00, 1.00 and 1.10 are 10% apart and the Series allows 1%: the drive's Terms_RecordOpen (as the resolver) voided the Window (SourceDisagreement, OpenSlot) |
| 2026-09-30T05:07:21.473Z | C2z | first-call, local rehearsal: void refund (cost + fee back to seat A) | — | 57ade20 | update 1220cdb28cb0b4119df8bcb0b0173409b4514c33622944e3f5a35485898f85fa8083 | pass: settled by the venue: 6.05 credits back = cost 6.00 + fee 0.05 |
| 2026-09-30T05:08:13.541Z | C2z | first-call, local rehearsal: stale refund with ops stopped | — | 57ade20 | open 1220046af4b6e408b041748b1d3c413a2c0354434162720e61e48899b8b1956ae333, quote 12207336ae73e171f536e02ab768a2f0997d1fae9b40690cce5f39628fedbdfbc8bb, accept 1220cbf55db57734aeb8092c5e9bc71cacf63c1365fa0c3613de59482be5d85fde4b; refund 122040ccf07f660ae7b6a4476fdc5b4f011b54165faa2a0745edb3c6b3d05a284087; venue leg 122005b6e63cf33b709454296a49a7d14e4865b9d42c49078947814356da8e1518eb | pass: ops frozen (SIGSTOP pid 14874), /health silent; before refundAfter: not-settled; after: confirmed, 4.05 credits back = backing 4.00 + fee 0.05; the venue then refunded its own opposite leg |

<details><summary>run 1: 17 rows (2 fail)</summary>

| UTC | Stage | Scenario | Parity rows | Commit | Ledger evidence (update id / trace id / artifact) | Result |
|---|---|---|---|---|---|---|
| 2026-09-30T04:54:33.523Z | C2z | first-call, local rehearsal: preflight | — | 441a19a | GET /v2/version | pass: Canton 3.5.17; the web answers /api/seat; venue pm-venue::… |
| 2026-09-30T04:54:36.742Z | C2z | first-call, local rehearsal: lease seat A (Alice) and seat B (Bob) | — | 441a19a | POST /api/seat ×2 | pass: seat A (Alice) → pm-seat-1::… lease 075464ae-4796-4ce2-ae46-98d9eec6101c, funded; seat B (Bob) → pm-seat-2::… lease 2e1fd94a-7c6c-42ee-9172-7e90efc7f82d, funded |
| 2026-09-30T04:54:37.622Z | C2z | first-call, local rehearsal: quote (seat A, Up, a firm quote from ops) | — | 441a19a | update 12208fd45f549c0d25b58fbfd516de2ffb0803abb30145688509f09665e2d8973fbf (Desk_IssueQuote by ops) | pass: BTC-1m Window BTC-1m:24: 399 lots Up at 154 (cost 61.45 + fee 0.52 credits), valid until 04:54:50Z |
| 2026-09-30T04:54:38.162Z | C2z | first-call, local rehearsal: prepare (dry run of seat A's accept shows the cost) | — | 441a19a | POST /v2/interactive-submission/prepare | pass: prepared, not executed (hash a8v9vMGwKKx4fVti…): the call costs 61.97 credits = stake 61.45 + fee 0.52; 0 bytes of traffic; the seat holds 1000.00 in 1 cash contract(s) |
| 2026-09-30T04:54:38.848Z | C2z | first-call, local rehearsal: accept (seat A, through the web) | — | 441a19a | update 12203829c67b3f9718541b8b98f7ceb51fde518f5fc8e2806d802da8eee36238b6c4 | pass: pm-seat-1::… holds leg 00bdc7670f18…: 399 lots SideUp, cost 61.45 + fee 0.52 |
| 2026-09-30T04:55:16.366Z | C2z | first-call, local rehearsal: killed submit reconciled (seat B's accept, response dropped, same commandId re-sent) | — | 441a19a | update 12206dac884c0b0b3223a2926bb869df8311272f6f9afd8555e9f65cd53d242e8d90 | pass: the web answered 200 and the client got a dropped socket; the re-send answered confirmed, recovered true; pm-seat-2::… holds 1 Leg for pair 1a4b431c-86ba-4813-9152-a78b383df26c |
| 2026-09-30T04:55:16.384Z | C2z | first-call, local rehearsal: owner view (seat A: /api/view?as=me) | — | 441a19a | GET /api/view?as=me at offset 997 | fail: queried as pm-seat-1::…: 1 rows (PM.Money:VenueCash); A's leg 00bdc7670f18… is there |
| 2026-09-30T04:55:16.431Z | C2z | first-call, local rehearsal: second seat empty (seat B and the alice/bob personas see none of A's contracts) | — | 441a19a | GET /api/view?as=me\|alice\|bob | pass: seat B 2 rows, 0 of A's; alice 0 rows, 0 of A's; bob 0 rows, 0 of A's; B sees its own leg only |
| 2026-09-30T04:55:16.442Z | C2z | first-call, local rehearsal: outsider empty (/api/view?as=outsider) | — | 441a19a | GET /api/view?as=outsider at offset 997 | pass: 0 rows; body {"eventFormat":{"filtersByParty":{"pm-outsider::1220…":{"cumulative":[{"identifierFilter":{"TemplateFilter":{"value":{"templateId":"#abu-pm-main:PM.Money:VenueCash","includeCreatedEventBlob":false}}}},{"identifierFilter":{"TemplateFilter":{"value":{"templateId":"#abu-pm-main:PM.Quote:Quote","includeCreatedEventBlob":false}}}},{"identifierFilter":{"TemplateFilter":{"value":{"templateId":"#abu-pm-main:PM.Leg:Leg","includeCreatedEventBlob":false}}}},{"identifierFilter":{"TemplateFilter":{"value":{"templateId":"#abu-pm-main:PM.Market:Resolution","includeCreatedEventBlob":false}}}},{"identifierFilter":{"TemplateFilter":{"value":{"templateId":"#abu-pm-main:PM.Market:MarketTerms","includeCreatedEventBlob":false}}}}]}},"verbose":true}} |
| 2026-09-30T04:55:16.453Z | C2z | first-call, local rehearsal: venue view (the fourth viewpoint: the counterparty sees both legs) | — | 441a19a | POST /v2/state/active-contracts as the venue | fail: 2 legs on two Windows as pm-venue::…: seat A's and seat B's, with the venue's opposite legs |
| 2026-09-30T04:55:16.488Z | C2z | first-call, local rehearsal: three attestations (the Window's close) | — | 441a19a | updates 1220049d9721b62ab886e701c7aff62be008dba6c51ccfe769e09a9a4f7409acc34b, 1220b215d8a8a391e9282c544adf17c5eb4d5eeec662fd7b7c3ddd4ce4d1ede61201, 122062c244e1ef1a9a22edf15beedfc68e593d9efaca3862febc557f0389059117a3 | pass: 3 of 3 oracles counted at 2026-09-30T04:55:00.000Z: pm-oracle-bitstamp::… 83170.39, pm-oracle-coinbase::… 83169.24, pm-oracle-kraken::… 83176.70 |
| 2026-09-30T04:55:16.492Z | C2z | first-call, local rehearsal: resolve (the resolver, from the prints) | — | 441a19a | update 1220ed905ac00884aaf3f51d3f819325d2d020d95c678d6abcccef9ff69cff3de573 | pass: SideDown (open 83190.10 → close 83170.39), signed by pm-resolver::… |
| 2026-09-30T04:56:16.833Z | C2z | first-call, local rehearsal: settle (the venue pays; neither seat signs) | — | 441a19a | updates 12204b28dca8b53caf4fc9be736426a872dfe41c6b0dd7bb2f34451033e169be5000, 1220027c2c64186796f9a741f118e2c9539b17c76f024a194ca5e90aef4cad73d5a4 | pass: seat A (Alice) SideUp lost: paid 0 credits; seat B (Bob) SideDown lost: paid 0 credits; no command from either seat after its accept |
| 2026-09-30T04:56:18.764Z | C2z | first-call, local rehearsal: void market: open, venue quote, accept (seat A) | — | 441a19a | open 1220ab076ffc6a8db142795fea342049f3b779ada962c5a20476cfbea026c35d3cd8, quote 12203553f255fcab259355cbff88695e1cf2a6312a4dbfb5b243d6b0a97a9324964b, accept 1220027c3c01b76d84f6d5f8f559f210a98f5d7e452854a54240e064a06b7e39cc67 | pass: Window first-call-void:0: seat A holds 10 lots Up at 600 (cost 6.00 + fee 0.05 credits) |
| 2026-09-30T04:56:20.190Z | C2z | first-call, local rehearsal: void on disagreement (the three opens disagree) | — | 441a19a | prints 1220ff6f1debf427e964a345604d4782f1bbef82d2de74c83b410e60fc9b13186346, 12208331096986d692891835194750ca5d43b31fbb8e3cc6801f8eca5ead112ac50e, 1220224ea155056ad22b0e81e16804f1ebb67766afc259b42d463ab0eddb74ddb950; void 1220b23cdc85e944dce4305d649f2f7832c79d14c2ab4f2e52bb2313f82c623d6a83 | pass: prints 1.00, 1.00 and 1.10 are 10% apart and the Series allows 1%: Terms_RecordOpen voided the Window (SourceDisagreement, OpenSlot) |
| 2026-09-30T04:56:23.223Z | C2z | first-call, local rehearsal: void refund (cost + fee back to seat A) | — | 441a19a | update 1220593ac1896e55b3042aa524a68742673fcab3a56c53d7ef3fe323bf38e484ff5a | pass: settled by the venue: 6.05 credits back = cost 6.00 + fee 0.05 |
| 2026-09-30T04:57:14.497Z | C2z | first-call, local rehearsal: stale refund with ops stopped | — | 441a19a | open 122093e8fa87f5f925277a0cee0b3677cd736d98767cde5c7d0343859025bb68e6da, quote 1220d0d8157e63f94e889f2005d9bcfc04319de3e58de42273c414a91e024c4be7ba, accept 1220dc16a4cf04dd32fa937f390278647ba66cb869a96bea1713550f1496d2a7d27c; refund 122063c6a02c2dc5bafb9e6b2c707475dad3d14adb85f8906c4fb3e6cc4fd0cf85ec | pass: ops frozen (SIGSTOP pid 14874), /health silent; before refundAfter: not-settled; after: confirmed, 4.05 credits back = backing 4.00 + fee 0.05 |

</details>

<details><summary>run 2: 17 rows</summary>

| UTC | Stage | Scenario | Parity rows | Commit | Ledger evidence (update id / trace id / artifact) | Result |
|---|---|---|---|---|---|---|
| 2026-09-30T04:58:27.694Z | C2z | first-call, local rehearsal: preflight | — | 441a19a | GET /v2/version | pass: Canton 3.5.17; the web answers /api/seat; venue pm-venue::… |
| 2026-09-30T04:58:30.529Z | C2z | first-call, local rehearsal: lease seat A (Alice) and seat B (Bob) | — | 441a19a | POST /api/seat ×2 | pass: seat A (Alice) → pm-seat-3::… lease d40972b5-e819-4a8f-b487-d838ae5a6d8f, funded; seat B (Bob) → pm-seat-4::… lease 1ece23e8-a0ef-463b-a9eb-88bc00ae42a4, funded |
| 2026-09-30T04:58:31.370Z | C2z | first-call, local rehearsal: quote (seat A, Up, a firm quote from ops) | — | 441a19a | update 12200f6f41e9857e233fd37a60fd0967ced9bee78051102f9b4f48c669f9153c5131 (Desk_IssueQuote by ops) | pass: BTC-1m Window BTC-1m:28: 110 lots Up at 558 (cost 61.38 + fee 0.27 credits), valid until 04:58:50Z |
| 2026-09-30T04:58:31.469Z | C2z | first-call, local rehearsal: prepare (dry run of seat A's accept shows the cost) | — | 441a19a | POST /v2/interactive-submission/prepare | pass: prepared, not executed (hash MopAIS9hLn7e/tpQ…): the call costs 61.65 credits = stake 61.38 + fee 0.27; 0 bytes of traffic; the seat holds 1000.00 in 1 cash contract(s) |
| 2026-09-30T04:58:32.047Z | C2z | first-call, local rehearsal: accept (seat A, through the web) | — | 441a19a | update 1220e9bf9083649507c3848f3b26035b513c022a27cd0840133dc19cc6ccaba1e4f3 | pass: pm-seat-3::… holds leg 00147e370fbe…: 110 lots SideUp, cost 61.38 + fee 0.27 |
| 2026-09-30T04:58:32.082Z | C2z | first-call, local rehearsal: owner view (seat A: /api/view?as=me) | — | 441a19a | GET /api/view?as=me at offset 1207 | pass: queried as pm-seat-3::…: 2 rows (PM.Money:VenueCash, PM.Leg:Leg); A's leg 00147e370fbe… is there |
| 2026-09-30T04:58:32.110Z | C2z | first-call, local rehearsal: outsider empty (/api/view?as=outsider, while seat A holds its leg) | — | 441a19a | GET /api/view?as=outsider at offset 1207 | pass: 0 rows; body {"eventFormat":{"filtersByParty":{"pm-outsider::1220…":{"cumulative":[{"identifierFilter":{"TemplateFilter":{"value":{"templateId":"#abu-pm-main:PM.Money:VenueCash","includeCreatedEventBlob":false}}}},{"identifierFilter":{"TemplateFilter":{"value":{"templateId":"#abu-pm-main:PM.Quote:Quote","includeCreatedEventBlob":false}}}},{"identifierFilter":{"TemplateFilter":{"value":{"templateId":"#abu-pm-main:PM.Leg:Leg","includeCreatedEventBlob":false}}}},{"identifierFilter":{"TemplateFilter":{"value":{"templateId":"#abu-pm-main:PM.Market:Resolution","includeCreatedEventBlob":false}}}},{"identifierFilter":{"TemplateFilter":{"value":{"templateId":"#abu-pm-main:PM.Market:MarketTerms","includeCreatedEventBlob":false}}}}]}},"verbose":true}} |
| 2026-09-30T04:58:33.377Z | C2z | first-call, local rehearsal: killed submit reconciled (seat B's accept, response dropped, same commandId re-sent) | — | 441a19a | update 1220b7936012bc6edbbf0a2e5edaa08fdaa6d468d248fcda2c65905975cab81bac6b | pass: the web answered 200 and the client got a dropped socket; the re-send answered confirmed, recovered true; pm-seat-4::… holds 1 Leg for pair 23aa8ffb-4277-48e8-908a-2de378f5e761 |
| 2026-09-30T04:58:33.482Z | C2z | first-call, local rehearsal: second seat empty (seat B and the alice/bob personas see none of A's contracts) | — | 441a19a | GET /api/view?as=me\|alice\|bob | pass: seat B 2 rows, 0 of A's; alice 0 rows, 0 of A's; bob 0 rows, 0 of A's; B sees its own leg |
| 2026-09-30T04:58:33.482Z | C2z | first-call, local rehearsal: venue view (the fourth viewpoint: the counterparty sees both legs) | — | 441a19a | POST /v2/state/active-contracts as the venue | pass: as pm-venue::…, read right after each accept: seat A's leg 00147e370fbe… and seat B's leg 00e3eb49d5eb… |
| 2026-09-30T04:59:12.797Z | C2z | first-call, local rehearsal: three attestations (the Window's close) | — | 441a19a | updates 1220873f5a619c62161b13da89c88b48ad2892151174b079bbd8ad6a46b082bfea67, 1220670ab63f0adad17cd073a447d6f2e1366b95b65f18d4adaa18850961f7e8add6, 122026cb50b5b169cf252a61920823ef4b14b900747a7786b1b29ae982b05d66e8d1 | pass: 3 of 3 oracles counted at 2026-09-30T04:59:00.000Z: pm-oracle-bitstamp::… 83179.22, pm-oracle-coinbase::… 83191.48, pm-oracle-kraken::… 83192.50 |
| 2026-09-30T04:59:12.805Z | C2z | first-call, local rehearsal: resolve (the resolver, from the prints) | — | 441a19a | update 1220414d99a82d990793ba78def27491da2bcf161612fb19fa3ebcc57ca9c8e3d4ae | pass: SideUp (open 83181.67 → close 83191.48), signed by pm-resolver::… |
| 2026-09-30T04:59:16.028Z | C2z | first-call, local rehearsal: settle (the venue pays; neither seat signs) | — | 441a19a | updates 1220258fd201e39b484d238286b486ab95cc4f0adacf721ff622c2e76092c301be71 | pass: seat A (Alice) SideUp won: paid 110.00 credits; seat B (Bob) SideDown lost: paid 0 credits; no command from either seat after its accept |
| 2026-09-30T04:59:19.352Z | C2z | first-call, local rehearsal: void market: open, venue quote, accept (seat A) | — | 441a19a | open 12200397ae36ac68eb591b1fa568609aa33943196998832249833c14f8e090f18502, quote 12205a6378f2583786f28fc5d749ff2e6dc4b320f34bf9bb94265dc69ad6079e3f88, accept 1220f5a323f60f058cb92743a7d34f8417c340c44cb1635cbdd5b3b15e65b6410b4c | pass: Window first-call-void:1: seat A holds 10 lots Up at 600 (cost 6.00 + fee 0.05 credits) |
| 2026-09-30T04:59:22.974Z | C2z | first-call, local rehearsal: void on disagreement (the three opens disagree) | — | 441a19a | prints 1220b26693aa244dab44f792e36c6e55b31154f173b1325f0f29dc2ec7c97f5dcfe0, 1220c06d69207cc34b038963b92966ef1f307fe67abc74b9de3b49046d7d3d0da2d5, 1220d8ef5f6ee9690d714faa32364e410a3dff116dba882202be18403da971c9c87b; void 12201ea707b2a52e31929c89ebd39f387ad83a639e880a0a519faa98251d20f0bdd5 | pass: prints 1.00, 1.00 and 1.10 are 10% apart and the Series allows 1%: Terms_RecordOpen voided the Window (SourceDisagreement, OpenSlot) |
| 2026-09-30T04:59:29.489Z | C2z | first-call, local rehearsal: void refund (cost + fee back to seat A) | — | 441a19a | update 12203fd8560ef3d1f6707362cc1480eec8bafed7ba0bc8eed5da92ba8c9427608263 | pass: settled by the venue: 6.05 credits back = cost 6.00 + fee 0.05 |
| 2026-09-30T05:00:34.216Z | C2z | first-call, local rehearsal: stale refund with ops stopped | — | 441a19a | open 1220190631445d565e5379cd4d57cb260556c0b692e5237aa4b27a92236ae66643b6, quote 1220b359f6e526f53d6d3aaaf462f1832b2d1c517efe477cd55b0715c921caf928e8, accept 12202c4168a1e06f93e9cbc05a16e435d2c8fa28d19475468e1093df206f286ae526; refund 12201476b02900bf28b181a140b98362e86b6cf59caf905c19347843dde0cce76f73; venue leg 1220f718c58cd49f97ba0c49c735f4cb947c6249691b0d757a441699e3ff3873b028 | pass: ops frozen (SIGSTOP pid 14874), /health silent; before refundAfter: not-settled; after: confirmed, 4.05 credits back = backing 4.00 + fee 0.05; the venue then refunded its own opposite leg |

</details>

<details><summary>run 3: 17 rows</summary>

| UTC | Stage | Scenario | Parity rows | Commit | Ledger evidence (update id / trace id / artifact) | Result |
|---|---|---|---|---|---|---|
| 2026-09-30T05:01:04.864Z | C2z | first-call, local rehearsal: preflight | — | b2be55e | GET /v2/version | pass: Canton 3.5.17; the web answers /api/seat; venue pm-venue::… |
| 2026-09-30T05:01:13.551Z | C2z | first-call, local rehearsal: lease seat A (Alice) and seat B (Bob) | — | b2be55e | POST /api/seat ×2 | pass: seat A (Alice) → pm-seat-5::… lease 5d7bef32-d2d1-4f82-a3f5-a7291fb95295, funded; seat B (Bob) → pm-seat-6::… lease ca5358a4-dee0-4be8-92f3-b5c5b655afce, funded |
| 2026-09-30T05:01:17.941Z | C2z | first-call, local rehearsal: quote (seat A, Up, a firm quote from ops) | — | b2be55e | update 122047bb16a4c724b9a61c95e456bad4b7fc67a0f7a5a917edaffa537e48e5a26dd2 (Desk_IssueQuote by ops) | pass: BTC-1m Window BTC-1m:31: 132 lots Up at 465 (cost 61.38 + fee 0.33 credits), valid until 05:01:37Z |
| 2026-09-30T05:01:18.061Z | C2z | first-call, local rehearsal: prepare (dry run of seat A's accept shows the cost) | — | b2be55e | POST /v2/interactive-submission/prepare | pass: prepared, not executed (hash 47DQuJorYMoRTUZx…): the call costs 61.71 credits = stake 61.38 + fee 0.33; 0 bytes of traffic; the seat holds 1000.00 in 1 cash contract(s) |
| 2026-09-30T05:01:18.806Z | C2z | first-call, local rehearsal: accept (seat A, through the web) | — | b2be55e | update 1220ad858c4602ff842f191a8308efdca92829cb0133569adcf51fa6f63dc8d54652 | pass: pm-seat-5::… holds leg 001224332252…: 132 lots SideUp, cost 61.38 + fee 0.33 |
| 2026-09-30T05:01:19.081Z | C2z | first-call, local rehearsal: owner view (seat A: /api/view?as=me) | — | b2be55e | GET /api/view?as=me at offset 1411 | pass: queried as pm-seat-5::…: 2 rows (PM.Money:VenueCash, PM.Leg:Leg); A's leg 001224332252… is there |
| 2026-09-30T05:01:19.219Z | C2z | first-call, local rehearsal: outsider empty (/api/view?as=outsider, while seat A holds its leg) | — | b2be55e | GET /api/view?as=outsider at offset 1411 | pass: 0 rows; body {"eventFormat":{"filtersByParty":{"pm-outsider::1220…":{"cumulative":[{"identifierFilter":{"TemplateFilter":{"value":{"templateId":"#abu-pm-main:PM.Money:VenueCash","includeCreatedEventBlob":false}}}},{"identifierFilter":{"TemplateFilter":{"value":{"templateId":"#abu-pm-main:PM.Quote:Quote","includeCreatedEventBlob":false}}}},{"identifierFilter":{"TemplateFilter":{"value":{"templateId":"#abu-pm-main:PM.Leg:Leg","includeCreatedEventBlob":false}}}},{"identifierFilter":{"TemplateFilter":{"value":{"templateId":"#abu-pm-main:PM.Market:Resolution","includeCreatedEventBlob":false}}}},{"identifierFilter":{"TemplateFilter":{"value":{"templateId":"#abu-pm-main:PM.Market:MarketTerms","includeCreatedEventBlob":false}}}}]}},"verbose":true}} |
| 2026-09-30T05:01:21.960Z | C2z | first-call, local rehearsal: killed submit reconciled (seat B's accept, response dropped, same commandId re-sent) | — | b2be55e | update 122037db261ad2f01169d3d8b3e239468ff1a9f80fc4a004b33c950458faf558c672 | pass: the web answered 200 and the client got a dropped socket; the re-send answered confirmed, recovered true; pm-seat-6::… holds 1 Leg for pair 96ae55e9-e512-4438-916b-e073b280e175 |
| 2026-09-30T05:01:22.161Z | C2z | first-call, local rehearsal: second seat empty (seat B and the alice/bob personas see none of A's contracts) | — | b2be55e | GET /api/view?as=me\|alice\|bob | pass: seat B 2 rows, 0 of A's; alice 0 rows, 0 of A's; bob 0 rows, 0 of A's; B sees its own leg |
| 2026-09-30T05:01:22.162Z | C2z | first-call, local rehearsal: venue view (the fourth viewpoint: the counterparty sees both legs) | — | b2be55e | POST /v2/state/active-contracts as the venue | pass: as pm-venue::…, read right after each accept: seat A's leg 001224332252… and seat B's leg 00326f70b94f… |
| 2026-09-30T05:02:15.411Z | C2z | first-call, local rehearsal: three attestations (the Window's close) | — | b2be55e | updates 1220c31df7c9aa1e366cf2cf028b7c2d5a0efa8ab0b9d8f6ff3da7566cb5a5f8f907, 12207bc72f718aa66a3d34f4406d32948ef2ba017b9cf8f101b53ff5b7881051640a, 122039a5a3fff7ad41a5dd8387cde010f08b1f438ce521e24ee258bcc3f8c271b960 | pass: 3 of 3 oracles counted at 2026-09-30T05:02:00.000Z: pm-oracle-bitstamp::… 83296.47, pm-oracle-coinbase::… 83314.24, pm-oracle-kraken::… 83313.20 |
| 2026-09-30T05:02:15.420Z | C2z | first-call, local rehearsal: resolve (the resolver, from the prints) | — | b2be55e | update 12204b5cef7f56767376da7bdeb8f282649db86e05115b0af60c82fdf9c36d04456f | pass: SideUp (open 83298.20 → close 83313.20), signed by pm-resolver::… |
| 2026-09-30T05:02:18.763Z | C2z | first-call, local rehearsal: settle (the venue pays; neither seat signs) | — | b2be55e | updates 122026b565871f58afb1d12d76f41f32cdeb2e6ab2291cb274b4a4ff473348b43a7c | pass: seat A (Alice) SideUp won: paid 132.00 credits; seat B (Bob) SideDown lost: paid 0 credits; no command from either seat after its accept |
| 2026-09-30T05:02:20.717Z | C2z | first-call, local rehearsal: void market: open, venue quote, accept (seat A) | — | b2be55e | open 1220d7ec470ab51ca7947fa09733ac162564406cebb7b30831764d7c61bffdf4fc84, quote 12204d1a55292ea03a19fa8efa8a6f4f5de2cbebad5ca4da6fed44833bbdc0579e0b, accept 1220b8f9a0066c62ba7437f13161708903d57deb759a53c630aa1f16e216d315d184 | pass: Window first-call-void:2: seat A holds 10 lots Up at 600 (cost 6.00 + fee 0.05 credits) |
| 2026-09-30T05:02:22.121Z | C2z | first-call, local rehearsal: void on disagreement (the three opens disagree) | — | b2be55e | prints 122047b01c670a8354faa71c87f7f1ff11ed7850cbec850d56012abd6d801ff4ad32, 122017cb6957f97fd36c87b703ba71ea8cf62468064b4a10cfbca65c12b9c832df4a, 12206b709825fdadc6abd61e156f13ff4f02f5a85894a4ee118cd98edd571368c968; void 1220c97fa62d5fe73d6fa94ea6c8958093fc00dc31f6f7f8eb804eee244d9e362856 | pass: prints 1.00, 1.00 and 1.10 are 10% apart and the Series allows 1%: Terms_RecordOpen voided the Window (SourceDisagreement, OpenSlot) |
| 2026-09-30T05:02:25.171Z | C2z | first-call, local rehearsal: void refund (cost + fee back to seat A) | — | b2be55e | update 12207f40c89c5c80668c03d49130b413a9ddfc88a144025eb8cd09ece284034606af | pass: settled by the venue: 6.05 credits back = cost 6.00 + fee 0.05 |
| 2026-09-30T05:03:17.437Z | C2z | first-call, local rehearsal: stale refund with ops stopped | — | b2be55e | open 12205ed57af3a0b3337fb1016f5585b6992153fef03c7fe020904337223f341f0bbf, quote 1220623c963b234a3e624ac0a23360d205bfae50a7b7910c29a57e782541cd7a49d7, accept 1220327bec26450865f8902a692ffe04614ec6fbea179daeb7eb9fa7f18264c78e03; refund 1220ff272a98111e51578fe9df5ff333a3852ffa6d7c0750494238415c2d95be8018; venue leg 1220ec7d0169763bbc11ebcb26e6ee5961e0d3b4315b5752c94f49072c44debca001 | pass: ops frozen (SIGSTOP pid 14874), /health silent; before refundAfter: not-settled; after: confirmed, 4.05 credits back = backing 4.00 + fee 0.05; the venue then refunded its own opposite leg |

</details>

<details><summary>run 4: 17 rows (1 fail)</summary>

| UTC | Stage | Scenario | Parity rows | Commit | Ledger evidence (update id / trace id / artifact) | Result |
|---|---|---|---|---|---|---|
| 2026-09-30T05:03:19.884Z | C2z | first-call, local rehearsal: preflight | — | b2be55e | GET /v2/version | pass: Canton 3.5.17; the web answers /api/seat; venue pm-venue::… |
| 2026-09-30T05:03:22.280Z | C2z | first-call, local rehearsal: lease seat A (Alice) and seat B (Bob) | — | b2be55e | POST /api/seat ×2 | pass: seat A (Alice) → pm-seat-7::… lease aac20ffd-722b-4f08-9812-fc8d00ee652e, funded; seat B (Bob) → pm-seat-8::… lease ba77755b-32c6-4edd-9e5f-6ff867f346b6, funded |
| 2026-09-30T05:03:22.780Z | C2z | first-call, local rehearsal: quote (seat A, Up, a firm quote from ops) | — | b2be55e | update 1220f5837bbeaa3cb89352ee5b0de1863ad3e479b7e4d3c3e1010b9fa7b5fb8f1e5c (Desk_IssueQuote by ops) | pass: BTC-1m Window BTC-1m:33: 93 lots Up at 663 (cost 61.66 + fee 0.21 credits), valid until 05:03:42Z |
| 2026-09-30T05:03:22.841Z | C2z | first-call, local rehearsal: prepare (dry run of seat A's accept shows the cost) | — | b2be55e | POST /v2/interactive-submission/prepare | pass: prepared, not executed (hash apHOutyhIcASrsnK…): the call costs 61.87 credits = stake 61.66 + fee 0.21; 0 bytes of traffic; the seat holds 1000.00 in 1 cash contract(s) |
| 2026-09-30T05:03:23.368Z | C2z | first-call, local rehearsal: accept (seat A, through the web) | — | b2be55e | update 12203b817a7960d4242c8e46525cd83ae236898e89197a9abdf9f7c559f43fd3f4ca | pass: pm-seat-7::… holds leg 000468932e8b…: 93 lots SideUp, cost 61.66 + fee 0.21 |
| 2026-09-30T05:03:23.424Z | C2z | first-call, local rehearsal: owner view (seat A: /api/view?as=me) | — | b2be55e | GET /api/view?as=me at offset 1585 | pass: queried as pm-seat-7::…: 2 rows (PM.Money:VenueCash, PM.Leg:Leg); A's leg 000468932e8b… is there |
| 2026-09-30T05:03:23.450Z | C2z | first-call, local rehearsal: outsider empty (/api/view?as=outsider, while seat A holds its leg) | — | b2be55e | GET /api/view?as=outsider at offset 1585 | pass: 0 rows; body {"eventFormat":{"filtersByParty":{"pm-outsider::1220…":{"cumulative":[{"identifierFilter":{"TemplateFilter":{"value":{"templateId":"#abu-pm-main:PM.Money:VenueCash","includeCreatedEventBlob":false}}}},{"identifierFilter":{"TemplateFilter":{"value":{"templateId":"#abu-pm-main:PM.Quote:Quote","includeCreatedEventBlob":false}}}},{"identifierFilter":{"TemplateFilter":{"value":{"templateId":"#abu-pm-main:PM.Leg:Leg","includeCreatedEventBlob":false}}}},{"identifierFilter":{"TemplateFilter":{"value":{"templateId":"#abu-pm-main:PM.Market:Resolution","includeCreatedEventBlob":false}}}},{"identifierFilter":{"TemplateFilter":{"value":{"templateId":"#abu-pm-main:PM.Market:MarketTerms","includeCreatedEventBlob":false}}}}]}},"verbose":true}} |
| 2026-09-30T05:03:24.332Z | C2z | first-call, local rehearsal: killed submit reconciled (seat B's accept, response dropped, same commandId re-sent) | — | b2be55e | update 122007b9c47b0f11f8706b5b1703354dbb481bd17654ffd1c180c6f532190ef28027 | pass: the web answered 200 and the client got a dropped socket; the re-send answered confirmed, recovered true; pm-seat-8::… holds 1 Leg for pair 0ce5df1b-23e4-4c28-9193-d57d77548aa0 |
| 2026-09-30T05:03:24.427Z | C2z | first-call, local rehearsal: second seat empty (seat B and the alice/bob personas see none of A's contracts) | — | b2be55e | GET /api/view?as=me\|alice\|bob | pass: seat B 2 rows, 0 of A's; alice 0 rows, 0 of A's; bob 0 rows, 0 of A's; B sees its own leg |
| 2026-09-30T05:03:24.427Z | C2z | first-call, local rehearsal: venue view (the fourth viewpoint: the counterparty sees both legs) | — | b2be55e | POST /v2/state/active-contracts as the venue | pass: as pm-venue::…, read right after each accept: seat A's leg 000468932e8b… and seat B's leg 0079f320c7c0… |
| 2026-09-30T05:04:12.797Z | C2z | first-call, local rehearsal: three attestations (the Window's close) | — | b2be55e | updates 1220a75a698714b41799ebdc7c29eed86c4228a3e52a2bf1ffe76f686777d3d530eb, 1220ae2e9f80fabd267cf575fc106cb572270ed94d00eda3fda4f3a9ad36d654fec1, 12200f2b1fad51a1f62a32d0207a9f6bc7950bbc942dae1e3b0ef24d6fb6a8deabe7 | pass: 3 of 3 oracles counted at 2026-09-30T05:04:00.000Z: pm-oracle-bitstamp::… 83253.16, pm-oracle-coinbase::… 83253.04, pm-oracle-kraken::… 83252.40 |
| 2026-09-30T05:04:12.801Z | C2z | first-call, local rehearsal: resolve (the resolver, from the prints) | — | b2be55e | update 1220c917e5efe0afa6ef007b5d50c408040520e0f1567c74ce45ec5b112fdef9a9d4 | pass: SideDown (open 83264.38 → close 83253.04), signed by pm-resolver::… |
| 2026-09-30T05:04:12.822Z | C2z | first-call, local rehearsal: settle (the venue pays; neither seat signs) | — | b2be55e | updates 1220f6219513dfc3738305d39e485f9973c3ca62a5f2fc7d4bc0ab3e6551f3469fef | pass: seat A (Alice) SideUp lost: paid 0 credits; seat B (Bob) SideDown won: paid 156.00 credits; no command from either seat after its accept |
| 2026-09-30T05:04:14.245Z | C2z | first-call, local rehearsal: void market: open, venue quote, accept (seat A) | — | b2be55e | open 122091248b8a6e27ac56c9ceeb46c9ee95d1174ecb20a947de96a075fcb07514112c, quote 1220b6b996bffa8036ed22de880417792188dbaf45d0f32f554bdad5c7955ab2039a, accept 12200194f79d3b29ec7db9b1be014353777fbadf7b7b068df111e0f54b32f67a9758 | pass: Window first-call-void:3: seat A holds 10 lots Up at 600 (cost 6.00 + fee 0.05 credits) |
| 2026-09-30T05:04:15.403Z | C2z | first-call, local rehearsal: void on disagreement (the three opens disagree) | — | b2be55e | trace id dda1857f9e2febeb2999d0288317a765 | fail: HTTP 400 DAML_FAILURE: /v2/commands/submit-and-wait-for-transaction → 400 DAML_FAILURE: Interpretation error: Error: User failure: stdlib.daml.com/deadline-not-exceeded (error categor |
| 2026-09-30T05:04:27.481Z | C2z | first-call, local rehearsal: void refund (cost + fee back to seat A) | — | b2be55e | update 1220dc3c6d5d69dfed1cd5af47ee7eefc4d7ebac9697972510e533f0df10970195a8 | pass: settled by the venue: 6.05 credits back = cost 6.00 + fee 0.05 |
| 2026-09-30T05:05:19.136Z | C2z | first-call, local rehearsal: stale refund with ops stopped | — | b2be55e | open 12200a622bc8f9df6fe4a97275bea980b0407e6e89e1010ecae466423c5624bb1915, quote 122058c95947d073393f6e5bafbab70ca878a346a59f520b136a4c5e4d5ce456600c, accept 12208f8b4ef7cffbb5e70434a4fd80dd37cf93ceb3a79e87b2f68a556ba19ccb54b6; refund 1220c2eb0f30c13d9904fc5a81e116ef7033c44146eabbb3645171fefb9958c46e42; venue leg 12208059338be370272f177ba7fe99610f3d56269a690113b47dc6c340474d8ea8bd | pass: ops frozen (SIGSTOP pid 14874), /health silent; before refundAfter: not-settled; after: confirmed, 4.05 credits back = backing 4.00 + fee 0.05; the venue then refunded its own opposite leg |

</details>


### What the rows prove

- **The four viewpoints.** Seat A's owner view (`/api/view?as=me`) holds its Leg. Seat B's view, and the alice and bob personas, hold 0 of A's contracts. The outsider gets 0 rows for the literal body above. The venue, as counterparty, sees both seats' legs.
- **Prepare.** A dry run (`/v2/interactive-submission/prepare`) of A's exact `Quote_Accept` names the cost before anything is executed: stake plus fee, and the traffic estimate (0 bytes on a sandbox).
- **Killed submit.** The drop proxy let the web finish (200) and then killed the client's socket. The same commandId, re-sent, answered `confirmed, recovered true` with the same update id, and B holds exactly one Leg for the pair.
- **Settle.** Three oracles attest each close, the resolver resolves, and the venue's settler pays. Across the five runs A won 3 times (runs 2, 3 and 5), and each time was paid lots × 1 credit with no command from A after its accept. Runs 1 and 4 A lost; in run 4 B won and was paid 156.00.
- **Void.** Opens of 1.00, 1.00 and 1.10, against a Series allowing 1%, void the Window (`SourceDisagreement`, `OpenSlot`). The venue's settler then pays A exactly cost plus fee (6.05 = 6.00 + 0.05).
- **Stale.** The drive froze ops with SIGSTOP, and `/health` went silent. A refund before `refundAfter` is refused `not-settled`. After it, the seat alone gets backing plus fee (4.05 = 4.00 + 0.05) through the web. Ops is thawed (SIGCONT) afterwards and was healthy again.
- **The venue's stale leg.** From run 2, the drive refunds the venue's own opposite leg on the stale Window. In run 1 it was left behind. Once ops woke, the sweeper voided that Window, and the settler logged one `ALARM first-call-stale:0: 1 legs past refundAfter unsettled` per ops process. The venue's stake also stays locked in that leg. The C2z.5 commit message says the alarm repeats "every pass"; in fact it fires once per Window per ops process.

## 6. `scripts/drive/seat-routes-it.ts` on engine 0.5.0

```
LEDGER_JSON_API_URL=http://localhost:7525 SEAT_IT_DB=postgres://…/pm_c2z_it pnpm --filter @agari/scripts exec tsx drive/seat-routes-it.ts
```

It allocates its own world on the same sandbox, runs `next start` on :3120 (the rehearsal web was stopped first) and a mock of ops on :4199.

- **Run 1** (`57ade20`, 1 min 16 s): 31 of 37. Its 20-second fast Window, opened at setup, had stopped trading by the time its quote came. The accept was refused, and 5 checks that depend on that leg failed with it.
- **Run 2** (`645363a`, C2z.7: the fast Window opens right before its quote), on a fresh `pm_c2z_it`, 1 min 04 s: **37 of 37, "ALL CHECKS PASSED"**.

<details><summary>run 2 output (37 checks)</summary>

```
PASS  seat A leases a party and is funded on first lease  {"status":200,"kind":"leased","funded":true}
PASS  the lease sets an HttpOnly seat cookie
PASS  balance reads the seat's demo cash as its party  1000000000
PASS  a cost above the confirmed cap is a requote (no contract)  requote
PASS  POST /api/ledger/quotes returns a firm quote from ops  quote
PASS  the seat sees its open quote
PASS  a cookie write without our Origin and seat header is refused (403)  403
PASS  accept lands as seat A and books from the created Leg  {"kind":"confirmed","booked":{"marketId":"6Yc18HrZvJTK9m8QF7RU3EHvmThT4wiixEhrdzadi36G","side":"up","contractsRaw":"100000","costBase":"60480","avgPriceBps":6000,"txHash":"1220dcba5583955185bcb2ebb25aa857bb1ea47267df1d2c7dbbd7a90e1b1733a399","fillCount":1}}
PASS  the same commandId again returns the landed transaction (no second leg)  {"kind":"confirmed","booked":{"marketId":"6Yc18HrZvJTK9m8QF7RU3EHvmThT4wiixEhrdzadi36G","side":"up","contractsRaw":"100000","costBase":"60480","avgPriceBps":6000,"txHash":"1220dcba5583955185bcb2ebb25aa857bb1ea47267df1d2c7dbbd7a90e1b1733a399","fillCount":1},"updateId":"1220dcba5583955185bcb2ebb25aa857bb1ea47267df1d2c7dbbd7a90e1b1733a399","recovered":true}
PASS  GET /api/ledger/commands/:id says landed for its own lease  {"commandId":"bcddb054-a69b-4060-8514-7d6c79c84350","status":"landed","updateId":"1220dcba5583955185bcb2ebb25aa857bb1ea47267df1d2c7dbbd7a90e1b1733a399","diagnosis":null}
PASS  a second call on the fast window lands  confirmed
PASS  a stale refund before refundAfter is refused not-settled  not-settled
PASS  positions show the leg  [{"marketId":"62z8NRD2mbYr62dpGzW4EA7UmtV9KZsCSr2LDsrvkJhR","asset":"ITB","intervalSec":20,"expirySec":1790745081,"decimals":6,"balanceUpRaw":"0","balanceDownRaw":"100000","costBasisBase":"60480","avgCostRaw":"604800","markValueBase":"60000","unrealizedPnlBase":"-480","realizedPnlBase":"0"},{"marketId":"6Yc18HrZvJTK9m8QF7RU3EHvmThT4wiixEhrdzadi36G","asset":"ITA","intervalSec":60,"expirySec":1790745118,"decimals":6,"balanceUpRaw":"100000","balanceDownRaw":"0","costBasisBase":"60480","avgCostRaw":"604800","markValueBase":"60000","unrealizedPnlBase":"-480","realizedPnlBase":"0"}]
PASS  the phone path (signed seat header, no cookie) reads the same seat  200
PASS  no seat → 401 signer-required  401
PASS  seat B leases the other party  leased
PASS  seat B's positions are empty  []
PASS  seat B cannot see seat A's command (404)  404
PASS  seat B presenting seat A's command id is refused  {"kind":"refused","diagnosis":{"kind":"contract-revert","retryable":false,"technical":"this command id belongs to another seat"}}
PASS  a third seat gets pool-full with a position and next-free estimate  {"kind":"pool-full","total":2,"inUse":2,"nextFreeAtMs":1790745965643,"position":1}
PASS  /api/view?as=outsider is empty and echoes its filtersByParty  {"rows":0}
PASS  /api/view?as=me shows seat A's leg and cash, queried as its party  ["PM.Leg:Leg","PM.Money:VenueCash","PM.Leg:Leg"]
PASS  /api/view?as=alice sees none of seat A's contracts
PASS  /api/view never takes a party from the query  400
PASS  a claim before resolution is refused not-settled  not-settled
PASS  claimables show the win after resolution  {"kind":"win","marketId":"6Yc18HrZvJTK9m8QF7RU3EHvmThT4wiixEhrdzadi36G","marketAddress":"6Yc18HrZvJTK9m8QF7RU3EHvmThT4wiixEhrdzadi36G","asset":"ITA","intervalSec":60,"expirySec":1790745118,"legs":[{"outcomeIdx":0,"amountRaw":"100000","payoutBase":"100000"}],"netPayoutBase":"100000","feeBps":0,"decimals":6,"settledAtMs":1790745120699}
PASS  claimables show the fast window's stale refund  stale-refund
PASS  claim lands with the resolution disclosed and pays the winner  {"kind":"confirmed","updateId":"1220ca9637036744ef1dd494159b3e354d27078bedd4417e76a0ff3b9377682878b7","payoutBase":"100000","legs":1,"recovered":false}
PASS  the stale refund pays backing plus fee back  {"kind":"confirmed","updateId":"1220e9c88b2949266693d66334330e76b5da5d6d3d30471109adc74efdfeb0dbba9b","payoutBase":"60480","legs":1,"recovered":false}
PASS  the balance rose by the claim and the refund  999879040 → 1000039520
PASS  positions are empty after the exits  []
PASS  claiming again is already-claimed  already-claimed
PASS  DELETE /api/seat releases the lease and clears the cookie
PASS  the released cookie no longer reads the seat  401
PASS  a newcomer queues behind the visitor already waiting (FIFO)  {"kind":"pool-full","total":2,"inUse":1,"nextFreeAtMs":1790746021897,"position":2}
PASS  the first waiting visitor gets the recycled party  {"kind":"leased","leaseId":"c025bd1c-7825-49d3-a11d-ca27825a4b96","address":"BCQBz6nJfMxz51UDNjm9DQWR8nt5k1k1ZqrtFPD3WPsM","party":"seat-b-itmunndf24::1220…","leasedAtMs":1790745122255,"idleExpiresAtMs":1790746022255,"hardCapAtMs":1790759522255,"openLegs":0,"funded":true}
PASS  the recycled seat starts empty: only its own fresh funding, no positions  {"balance":"1000000000","positions":0}
ALL CHECKS PASSED
```

</details>

<details><summary>run 1 output (31 of 37)</summary>

```
PASS  seat A leases a party and is funded on first lease  {"status":200,"kind":"leased","funded":true}
PASS  the lease sets an HttpOnly seat cookie
PASS  balance reads the seat's demo cash as its party  1000000000
PASS  a cost above the confirmed cap is a requote (no contract)  requote
PASS  POST /api/ledger/quotes returns a firm quote from ops  quote
PASS  the seat sees its open quote
PASS  a cookie write without our Origin and seat header is refused (403)  403
PASS  accept lands as seat A and books from the created Leg  {"kind":"confirmed","booked":{"marketId":"Pev2vmKGEDDvpTdEhVQAGCTHmHhxeu5uvBXWXG5iyLS","side":"up","contractsRaw":"100000","costBase":"60480","avgPriceBps":6000,"txHash":"1220721c846e79447f97ab02f394c6bc828e5293ce1e913276b25a676fab34c91a70","fillCount":1}}
PASS  the same commandId again returns the landed transaction (no second leg)  {"kind":"confirmed","booked":{"marketId":"Pev2vmKGEDDvpTdEhVQAGCTHmHhxeu5uvBXWXG5iyLS","side":"up","contractsRaw":"100000","costBase":"60480","avgPriceBps":6000,"txHash":"1220721c846e79447f97ab02f394c6bc828e5293ce1e913276b25a676fab34c91a70","fillCount":1},"updateId":"1220721c846e79447f97ab02f394c6bc828e5293ce1e913276b25a676fab34c91a70","recovered":true}
PASS  GET /api/ledger/commands/:id says landed for its own lease  {"commandId":"39c77fbb-ac91-403e-a298-9c88e8545ee9","status":"landed","updateId":"1220721c846e79447f97ab02f394c6bc828e5293ce1e913276b25a676fab34c91a70","diagnosis":null}
FAIL  a second call on the fast window lands  refused
FAIL  a stale refund before refundAfter is refused not-settled  already-claimed
FAIL  positions show the leg  [{"marketId":"Pev2vmKGEDDvpTdEhVQAGCTHmHhxeu5uvBXWXG5iyLS","asset":"ITA","intervalSec":60,"expirySec":1790744994,"decimals":6,"balanceUpRaw":"100000","balanceDownRaw":"0","costBasisBase":"60480","avgCostRaw":"604800","markValueBase":"60000","unrealizedPnlBase":"-480","realizedPnlBase":"0"}]
FAIL  the phone path (signed seat header, no cookie) reads the same seat  200
PASS  no seat → 401 signer-required  401
PASS  seat B leases the other party  leased
PASS  seat B's positions are empty  []
PASS  seat B cannot see seat A's command (404)  404
PASS  seat B presenting seat A's command id is refused  {"kind":"refused","diagnosis":{"kind":"contract-revert","retryable":false,"technical":"this command id belongs to another seat"}}
PASS  a third seat gets pool-full with a position and next-free estimate  {"kind":"pool-full","total":2,"inUse":2,"nextFreeAtMs":1790745851269,"position":1}
PASS  /api/view?as=outsider is empty and echoes its filtersByParty  {"rows":0}
PASS  /api/view?as=me shows seat A's leg and cash, queried as its party  ["PM.Money:VenueCash","PM.Leg:Leg","PM.Quote:Quote"]
PASS  /api/view?as=alice sees none of seat A's contracts
PASS  /api/view never takes a party from the query  400
PASS  a claim before resolution is refused not-settled  not-settled
PASS  claimables show the win after resolution  {"kind":"win","marketId":"Pev2vmKGEDDvpTdEhVQAGCTHmHhxeu5uvBXWXG5iyLS","marketAddress":"Pev2vmKGEDDvpTdEhVQAGCTHmHhxeu5uvBXWXG5iyLS","asset":"ITA","intervalSec":60,"expirySec":1790744994,"legs":[{"outcomeIdx":0,"amountRaw":"100000","payoutBase":"100000"}],"netPayoutBase":"100000","feeBps":0,"decimals":6,"settledAtMs":1790744996641}
FAIL  claimables show the fast window's stale refund
PASS  claim lands with the resolution disclosed and pays the winner  {"kind":"confirmed","updateId":"12206ac041d58a98a466ed21c0d97dfb83842ac7bffb44bec975c1d870747c66635c","payoutBase":"100000","legs":1,"recovered":false}
FAIL  the stale refund pays backing plus fee back  {"kind":"refused","diagnosis":{"kind":"already-claimed","retryable":false,"technical":"the seat holds nothing on this Window"}}
PASS  the balance rose by the claim and the refund  999939520 → 1000039520
PASS  positions are empty after the exits  []
PASS  claiming again is already-claimed  already-claimed
PASS  DELETE /api/seat releases the lease and clears the cookie
PASS  the released cookie no longer reads the seat  401
PASS  a newcomer queues behind the visitor already waiting (FIFO)  {"kind":"pool-full","total":2,"inUse":1,"nextFreeAtMs":1790745897491,"position":2}
PASS  the first waiting visitor gets the recycled party  {"kind":"leased","leaseId":"308d5ffd-13c0-419e-956b-f6cd0c2077ca","address":"8nGa3uBjbQBuo96Lru6XVgaz87fAhn7FAeybBEHDwQi8","party":"seat-b-itmunnapje::1220…","leasedAtMs":1790744997845,"idleExpiresAtMs":1790745897845,"hardCapAtMs":1790759397845,"openLegs":0,"funded":true}
PASS  the recycled seat starts empty: only its own fresh funding, no positions  {"balance":"1000000000","positions":0}
6 CHECK(S) FAILED
```

</details>

## Commits

| Commit | What |
|---|---|
| `cce808c` | C2z.1: R1 DARs in `daml/released/` with `MANIFEST.md`; K-202 |
| `5a654c3` | C2z.2: `first-call.ts` and its unit tests (8: DevNet config, the drop proxy over real HTTP, row hygiene) |
| `51ef4e0` | C2z.3: no codegen noise above the bootstrap and preflight tables; "would create" in the maker's dry run |
| `441a19a` | C2z.4: a rehearsal (`--allow-local`) refuses to write the DevNet parties file without `--out` |
| `b2be55e` | C2z.5: views read right after each accept; the venue refunds its stale leg |
| `57ade20` | C2z.6: the drive's Windows start in the past; the void step accepts a void from either resolver session |
| `645363a` | C2z.7: `seat-routes-it` opens its fast Window when it uses it |

## Cleanup

Everything this lane started was stopped by pid: ops (4 processes), the web (3), and the sandbox (the `dpm` wrapper and its JVM). `pm_c2z` and `pm_c2z_it` were dropped, and `web/.next` (467 MB) was removed. The scratchpad keeps the logs.
