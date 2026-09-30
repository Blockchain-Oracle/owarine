# Runbook: DevNet R1 on the Noders participant

This covers the first time the product runs on Noders DevNet: onboarding, parties, and the first DAR release (R1). The Console mechanics are in `noders-console.md`. This page is the exact click list for Abu and the agent's list after it. Never write a credential, a token, a party id or a URL that carries a secret into this file or anywhere in `docs/`.

**Status on 30 Sep:** not started on Noders. Everything so far ran on the local sandbox (K-009), and nothing has been uploaded to Noders. The only thing known is public: `GET /v2/version` reports Canton 3.5.18, and CORS is open. The agent's side is ready:
- `pnpm devnet:preflight` and `pnpm devnet:bootstrap` (C2y);
- the R1 DARs in `daml/released/`, with `MANIFEST.md` (K-202);
- `scripts/drive/first-call.ts` (C2z).

Steps 2–4 and 6 below (the bootstrap and the smoke) were rehearsed on one local sandbox, with a local ops and web standing in for step 5 (C2z, `docs/evidence/c2z-r1-rehearsal.md`).

## What Abu clicks (about 20 minutes, once)

Use the HackCanton account throughout. The agent is ready when Abu starts, and the DAR files are in `daml/released/` (see "Before Abu starts").

1. **Onboard the wallet.** Open the Noders wallet page from the HackCanton Materials tab and click **"Onboard yourself"**. Wait until it shows the wallet as onboarded.
2. **Sign in to the Console.** Open the Noders Console and click **"Sign in with Authfactory"**. Do not use email and password.
3. **Create the parties.** Go to Console → **Parties** → **Create Party**, once per row below, typing the hint exactly as written. That is 19 parties. The quota shows "n of 20 parties used". If it refuses before 19, stop creating seats: the run works with fewer seats (at least `pm-seat-1`).

| # | Party hint | Role |
|---|---|---|
| 1 | `pm-venue` | the venue (market maker, settler) |
| 2 | `pm-resolver` | records resolutions |
| 3 | `pm-oracle-coinbase` | oracle 1 |
| 4 | `pm-oracle-kraken` | oracle 2 |
| 5 | `pm-oracle-bitstamp` | oracle 3 |
| 6 | `pm-auditor` | sees the reserves' NAV statements |
| 7 | `pm-lp` | seeds the ticket reserves |
| 8 | `pm-agent-runner` | acts for agents through grants |
| 9–11 | `pm-alice`, `pm-bob`, `pm-outsider` | the demo's three viewpoints |
| 12–19 | `pm-seat-1` … `pm-seat-8` | visitor seats (the lease pool) |

   Each party should show the **Act-as on** badge. If one does not, click **Assign can-act-as** on it.
4. **Put the party ids in a file on this Mac.** Either way works. Party ids are not secrets, but they never go into Git, so the file lives in `~/.config/agari/canton/`:
   - **Easiest:** Console → Parties, select the whole list, copy it, and paste it into a new text file `~/.config/agari/canton/parties.devnet.txt`. The script finds each party by its hint.
   - **Or:** copy `docs/plan/runbooks/devnet-parties.example.json` to `~/.config/agari/canton/parties.devnet.json` and paste each full id (`pm-venue::1220…`) into its slot. Leave unused seats as `""`.
5. **Upload the DARs, in this order.** For each: Console → **Collections** → **Upload DAR** → pick the HackCanton node → choose the file → **Upload**. Wait for each to show as vetted before the next.
   1. `daml/released/abu-pm-main-0.5.0.dar`
   2. `daml/released/abu-pm-tickets-0.1.3.dar`
   3. `daml/released/abu-pm-agents-0.2.1.dar`
   4. `daml/released/abu-pm-games-0.1.1.dar`

   These four files are R1. Their package ids and sha256 hashes are in `daml/released/MANIFEST.md`. Before uploading, `shasum -a 256 daml/released/*.dar` must print the manifest's hashes. The order matters because tickets, agents and games are each built against main. Package names are shared across the participant, and the Console cannot delete a DAR, so there is no undo. If an upload says a package with that name and version already exists with different content, stop and tell the agent (a name collision, K-009).
6. **Put the platform credential in two places. The agent never sees it.**
   1. On this Mac: copy `docs/plan/runbooks/devnet.env.example` to `~/.config/agari/canton/devnet.env`. Fill the two empty lines (`LEDGER_OIDC_USERNAME` and `LEDGER_OIDC_PASSWORD`, the HackCanton login). Then run `chmod 600 ~/.config/agari/canton/devnet.env`. The agent's commands load this file and never print it.
   2. In Coolify (K-035 option A, the default): paste the same names and values into the secret store of **both** pm-web and pm-ops. If the preflight says the realm keeps only one session per login, put them in pm-ops only (option B), and tell the agent.

   The password is rotated after judging.
7. **Tell the agent "done"**, and say which of the two party files you made.

That is all. Everything below is the agent's.

## Before Abu starts (the agent)

- **Engine merged.** Done 30 Sep: `abu-pm-main` 0.5.0 is on `main` (`5cf2dff`), and `dpm test` passes 186 scripts.
- **Satellites rebuilt.** Done: tickets 0.1.3, agents 0.2.1 and games 0.1.1 each carry main `076dbb92…`.
- **Upgrade check.** Done: `dpm upgrade-check --both` passes against main 0.4.0, tickets 0.1.2, agents 0.2.0 and games 0.1.0, with 0 warnings. Nothing is on Noders yet, so this is the local baseline; the output is in `daml/released/MANIFEST.md`.
- **Files in place.** Done: the four DARs are committed in `daml/released/` (K-202). `bootstrap-devnet.ts` compares the package ids inside exactly these files with what the participant holds. The files Abu uploads must therefore be these bytes: never rebuild them in place.
- **Public preflight.** Run `pnpm devnet:preflight https://ledger-api-json.participant.hackcanton-01.devnet.naas.noders.services` before the credential file exists. It prints the `/v2/version` and CORS rows; every other row says "not run".
- **Name collision.** Confirm that no package named `abu-pm-*` already exists on the participant. The Console's package list is visible to every team.

## After Abu's clicks (the agent, one command at a time)

Every command below prints a table, then its results as `docs/plan/acceptance.md` rows (stage C2y), failures included, with the trace id. Paste the rows as printed. No row carries a full party id or a credential: the scripts print hints only (`pm-venue::…`).

1. **Preflight with the credential** (read-only):

   ```
   pnpm devnet:preflight https://ledger-api-json.participant.hackcanton-01.devnet.naas.noders.services \
     --origin https://<web domain> --parties ~/.config/agari/canton/parties.devnet.txt
   ```

   It prints one row per check:
   - `/v2/version`.
   - CORS for the web's origin. This is a note, not a failure: the product calls the ledger from its servers.
   - The token grant and its lifetime (3 h expected).
   - **Concurrent sessions.** A second grant on the same login must leave the first token valid. If it does not, K-035 option B is forced: stop and tell Abu.
   - The ledger user id.
   - Act-as over all of our parties.
   - The connected `synchronizerId`.

   It never lists `/v2/parties` or `/v2/users`.
2. **Bootstrap, checks only:** `pnpm devnet:bootstrap --parties ~/.config/agari/canton/parties.devnet.txt --check-only` (or `parties.devnet.json`, whichever file Abu made).
   - Each party is looked up by id (`GET /v2/parties/{party}`) and checked against the user's act-as rights.
   - Each DAR's main package id must be in `GET /v2/packages` and registered.
   - Any FAIL stops the run here. A party without act-as is fixed with **Assign can-act-as** in the Console. A missing package id means the upload is missing or came from another build.
3. **Bootstrap, dry run:** the same command with `--dry-run` instead of `--check-only`.
   - Every independent write is prepared against live state (`/v2/interactive-submission/prepare`), and nothing is executed. That covers the desk, the shards, each Series, the EarnDesk, the reserve statements and books, the LP invite, the arena and the season pool.
   - The writes that need an earlier write's contract are named but not prepared: the LP accept, the supplies, the first NAV statement and the season funding.
4. **Bootstrap:** `LEDGER_SUBMIT_TIMEOUT_MS=300000 LEDGER_REQUEST_TIMEOUT_MS=120000 pnpm devnet:bootstrap --parties ~/.config/agari/canton/parties.devnet.txt`. The two timeouts give a slow first transaction time to land instead of being re-sent. They are not secrets and go on the command line; `devnet.env` stays Abu's.
   - The options are the same as local:
     - `--seats 8` is the default, the plan's budget. If fewer seats are filled, the pool is smaller.
     - `--shards 16`
     - `--lanes crypto,regular,gap,token,preipo,basket`
     - `--reserve-seed 10000`
     - `--no-tickets`
     - `--no-games`
   - It creates whatever is missing and writes `~/.config/agari/canton/parties.devnet.json` (mode 600), the K-026 file that ops and the web read.
   - Each write is an acceptance row with its update id.
   - Re-running is safe: a second run finds everything and sends nothing ("0 executed"). The rehearsal measured it: 139 writes in 4 min 17 s, then a re-run with 0 executed in 40 s.
   - The run prints its id at the start (`run devnet-…`). Every write's commandId ends in it.
   - **A slow write pauses the run; it does not fail it (C3f).** On a slow participant a write's first attempt can outlast its timeout. The client then re-sends it under the same commandId, and the participant answers `409 SUBMISSION_ALREADY_IN_FLIGHT`. The client stops re-sending at that answer and waits for the first attempt's completion, then carries on with that transaction. The wait is capped by `LEDGER_INFLIGHT_WAIT_MS` (default 3 minutes). This is the expected path, and there is nothing to do.
   - **If the pending write was rejected**, the run stops with that write's own rejection, usually `MEDIATOR_SAYS_TX_TIMED_OUT` or `NOT_SEQUENCED_TIMEOUT`: the participant was too slow to confirm it. Nothing landed for that write. The fallback is to wait a minute and run the same command again, adding `--run <the printed id>`. The rehearsal hit this twice on a swapped-out sandbox, before C3f, when it still showed as `SUBMISSION_ALREADY_IN_FLIGHT`.
   - **If the wait runs out**, the error says `commandId …: outcome unknown`, and the write may still land. Re-run with `--run <the printed id>`. The pending write is then resolved under its own commandId (deduplicated if it landed, waited on if it is still in flight). A run with a fresh id would re-send it under a new commandId. For a very slow node, prefix `LEDGER_INFLIGHT_WAIT_MS=600000`.
5. **Point the hosted apps at DevNet.** This comes before the smoke: `first-call.ts` drives the hosted web and ops, and DevNet has one writer, so no local ops may run against it.
   1. Mount `parties.devnet.json` in Coolify as `/data/parties.json` for pm-ops and pm-web, with `AGARI_PARTIES_FILE=/data/parties.json`.
   2. Set `LEDGER_JSON_API_URL`, `LEDGER_AUTH_MODE=password` and the `LEDGER_OIDC_*` names Abu filled. The names are listed in `web/.env.example` and `services/ops/.env.example`.
   3. Redeploy pm-ops, first with `DRY_RUN=1` and then with `0`. Then redeploy pm-web.
   4. Run the probes in `coolify-deploy.md` §6.
6. **Four-viewpoint smoke on DevNet** (`scripts/drive/first-call.ts`). Rehearsed locally in C2z; the DevNet path is unit-tested only until this step.

   ```
   pnpm --filter @agari/scripts exec tsx --env-file=$HOME/.config/agari/canton/devnet.env drive/first-call.ts \
     --network devnet --web https://<web domain> --only main,void
   ```

   - **main.** Seat A (Alice) and seat B (Bob) lease. A quotes and prepares (a dry run showing cost and traffic), then accepts. B's accept response is dropped and re-sent under the same commandId: B must hold one Leg. A's owner view, B's view, the personas and the outsider are read (the outsider's literal query body is printed). Then ops' three oracles attest, the resolver resolves, and the venue settles.
   - **void.** Three disagreeing opens void a Window, and A gets cost plus fee back.
   - Then stop pm-ops in Coolify and run the same command with `--only stale --ops-stopped`: after `refundAfter`, A takes backing plus fee back with nothing but the web. Start pm-ops again.
   - The drive takes its own token grant on the platform login. That is safe only if the preflight found concurrent sessions allowed (K-035 option A). Under option B a new grant could end pm-ops' session mid-run, so stop and tell Abu first.
   - With pm-ops stopped, a newly leased seat is not funded. For `--only stale` the venue and the seat sign 10 demo credits into the seat directly, and the row says so.
   - The drive creates two Series on the venue once, `first-call-void` and `first-call-stale` (symbols `FCVOID`, `FCSTALE`). They are not registry tickers, so ops' roller never rolls them. Each run adds one Window to each. The Console cannot delete them.
   - Every step prints its acceptance row with update ids, failures included. Locally one run took 1 min 43 s to 2 min 43 s on the 1-minute lane (`--lane BTC-1m`, the default). If the hosted lanes are slow to open, `--lane BTC-5m` gives each quote more time, and the run takes about 6 minutes longer.
   - Then run `contention.py 16` and a 10-minute cadence soak.
7. **The remaining Noders probes (K-009)**, one acceptance row each:
   - `POST /v2/parties`, expected to be refused. Run it only with Abu's go-ahead, since a success spends quota.
   - DAR validate.
   - The deduplication period.
   - The pruning offset.
   - The ledger-time tolerance.
   - Whether the primary party counts toward the quota.

   Also record the participant node id and the party namespace prefix from Console → Participants.
8. **Update STATUS.md and capabilities.json.** A capability becomes `live` only with its DevNet acceptance row (the `capabilities-evidence` invariant enforces this).

### Rehearsal on the local sandbox

`bootstrap-devnet.ts --allow-local` runs the same path against an unauthenticated sandbox (`LEDGER_AUTH_MODE=none`), on parties and DARs that are already there. Party lookups and package ids are checked. Rights are not, because there is no user token. The auth path itself is tested over HTTP against a fake Keycloak and a fake participant (`scripts/bootstrap/devnet-http.test.ts`).

The C2z rehearsal (`docs/evidence/c2z-r1-rehearsal.md`) ran the whole sequence on one sandbox, standing in for Abu's clicks with the same inputs:
1. Upload `daml/released/*.dar` in the step-5 order (`POST /v2/dars`).
2. Allocate the 19 parties with the step-3 hints.
3. Write the id list as text into a scratch file, the way the Console's list is pasted.
4. Run `bootstrap-devnet.ts --allow-local --parties <scratch>/parties.devnet.txt --out <scratch>/parties.devnet.json`: first `--check-only`, then `--dry-run`, then for real, then once more to see "0 executed".
5. Start `drive/ops-local.ts` and `next start` on the file it wrote.
6. Run `drive/first-call.ts --network local --parties <that file> --ops-pid <the ops node's pid>`.

A rehearsal must pass `--out`. The default for a text input is `~/.config/agari/canton/parties.devnet.json`, the DevNet file, and with `--allow-local` the script now refuses to write there.

## If something fails

- Errors come back with only a trace id. Record the command, the trace id and the time as a failed row in `acceptance.md`.
- Party quota short: ask Noders openly in the hackathon Telegram (`noders-console.md`, item 4). Meanwhile run with fewer seats: the seat pool is whatever `users.seat-*` lists (`--seats N` caps it).
- A party FAIL in the bootstrap's checks: "cannot act as it" means Console → Parties → **Assign can-act-as**; "not known to this participant" means the id was mistyped or comes from another node.
- DevNet unusable: Plan B is a Canton sandbox on a VPS, switched by env var (plan "Risks"). The local sandbox remains the fallback for the demo recording.
