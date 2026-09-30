# Runbook: DevNet R1 on the Noders participant

This covers the first time the product runs on Noders DevNet: onboarding, parties, and the first DAR release (R1). The Console mechanics are in `noders-console.md`. This page is the exact click list for Abu and the agent's list after it. Never write a credential, a token, a party id or a URL that carries a secret into this file or anywhere in `docs/`.

**Status on 30 Sep:** not started. Everything so far ran on the local sandbox (K-009). Nothing has been uploaded to Noders. The only thing known is public: `GET /v2/version` reports Canton 3.5.18, and CORS is open. The agent's side is ready (C2y): `pnpm devnet:preflight` and `pnpm devnet:bootstrap`.

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
   1. `daml/released/abu-pm-main-<version>.dar`
   2. `daml/released/abu-pm-tickets-<version>.dar`
   3. `daml/released/abu-pm-agents-<version>.dar`
   4. `daml/released/abu-pm-games-<version>.dar`

   The agent names the exact file names when it hands them over. On 30 Sep the `daml.yaml` versions are main 0.4.0, tickets 0.1.2, agents 0.2.0 and games 0.1.0; R1 ships whatever `daml/released/` holds by then. The order matters because tickets, agents and games are each built against main. Package names are shared across the participant, and the Console cannot delete a DAR, so there is no undo. If an upload says a package with that name and version already exists with different content, stop and tell the agent (a name collision, K-009).
6. **Put the platform credential in two places. The agent never sees it.**
   1. On this Mac: copy `docs/plan/runbooks/devnet.env.example` to `~/.config/agari/canton/devnet.env`. Fill the two empty lines (`LEDGER_OIDC_USERNAME` and `LEDGER_OIDC_PASSWORD`, the HackCanton login). Then run `chmod 600 ~/.config/agari/canton/devnet.env`. The agent's commands load this file and never print it.
   2. In Coolify (K-035 option A, the default): paste the same names and values into the secret store of **both** pm-web and pm-ops. If the preflight says the realm keeps only one session per login, put them in pm-ops only (option B), and tell the agent.

   The password is rotated after judging.
7. **Tell the agent "done"**, and say which of the two party files you made.

That is all. Everything below is the agent's.

## Before Abu starts (the agent)

- **Engine merged.** The engine version R1 ships is merged to `main`, with `dpm test` green.
- **Satellites rebuilt.** Tickets, agents and games are rebuilt against the released `abu-pm-main` DAR. Their `data-dependencies` and their own versions are both bumped. `dpm test` runs green over all of them.
- **Upgrade check.** `dpm upgrade-check --both` passes for each package against its last local version. Nothing is on Noders yet, so this is the local baseline.
- **Files in place.** The four DARs are copied into `daml/released/` as `<name>-<version>.dar` and committed with the version bumps (`noders-console.md`, "DAR upload with a version bump"). `bootstrap-devnet.ts` compares the package ids inside exactly these files with what the participant holds. The files Abu uploads and the files in `daml/released/` must therefore be the same build.
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
4. **Bootstrap:** `pnpm devnet:bootstrap --parties ~/.config/agari/canton/parties.devnet.txt`.
   - The options are the same as local:
     - `--seats 8` is the default, the plan's budget. If fewer seats are filled, the pool is smaller.
     - `--shards 16`
     - `--lanes crypto,regular,gap,token,preipo,basket`
     - `--reserve-seed 10000`
     - `--no-tickets`
     - `--no-games`
   - It creates whatever is missing and writes `~/.config/agari/canton/parties.devnet.json` (mode 600), the K-026 file that ops and the web read.
   - Each write is an acceptance row with its update id.
   - Re-running is safe: a second run finds everything and sends nothing ("0 executed").
5. **Four-viewpoint smoke on DevNet** (`first-call.ts`, the M1 script; on 30 Sep it does not exist on `main` yet):
   - a market opens;
   - Alice gets a quote and accepts it;
   - three oracles post, the resolver resolves, and the venue settles;
   - Bob and the outsider see nothing of Alice's;
   - one void refunds cost plus fee.

   It runs with the same credential file: `pnpm --filter @agari/scripts exec tsx --env-file=$HOME/.config/agari/canton/devnet.env drive/first-call.ts`. Failure bodies are recorded. Then run `contention.py 16` and a 10-minute cadence soak.
6. **The remaining Noders probes (K-009)**, one acceptance row each:
   - `POST /v2/parties`, expected to be refused. Run it only with Abu's go-ahead, since a success spends quota.
   - DAR validate.
   - The deduplication period.
   - The pruning offset.
   - The ledger-time tolerance.
   - Whether the primary party counts toward the quota.

   Also record the participant node id and the party namespace prefix from Console → Participants.
7. **Point the hosted apps at DevNet.**
   1. Mount `parties.devnet.json` in Coolify as `/data/parties.json` for pm-ops and pm-web, with `AGARI_PARTIES_FILE=/data/parties.json`.
   2. Set `LEDGER_JSON_API_URL`, `LEDGER_AUTH_MODE=password` and the `LEDGER_OIDC_*` names Abu filled. The names are listed in `web/.env.example` and `services/ops/.env.example`.
   3. Redeploy pm-ops, first with `DRY_RUN=1` and then with `0`. Then redeploy pm-web.
   4. Run the probes in `coolify-deploy.md` §6.
8. **Update STATUS.md and capabilities.json.** A capability becomes `live` only with its DevNet acceptance row (the `capabilities-evidence` invariant enforces this).

### Rehearsal on the local sandbox

`bootstrap-devnet.ts --allow-local` runs the same path against an unauthenticated sandbox (`LEDGER_AUTH_MODE=none`), on parties and DARs that are already there. Party lookups and package ids are checked. Rights are not, because there is no user token. The auth path itself is tested over HTTP against a fake Keycloak and a fake participant (`scripts/bootstrap/devnet-http.test.ts`).

## If something fails

- Errors come back with only a trace id. Record the command, the trace id and the time as a failed row in `acceptance.md`.
- Party quota short: ask Noders openly in the hackathon Telegram (`noders-console.md`, item 4). Meanwhile run with fewer seats: the seat pool is whatever `users.seat-*` lists (`--seats N` caps it).
- A party FAIL in the bootstrap's checks: "cannot act as it" means Console → Parties → **Assign can-act-as**; "not known to this participant" means the id was mistyped or comes from another node.
- DevNet unusable: Plan B is a Canton sandbox on a VPS, switched by env var (plan "Risks"). The local sandbox remains the fallback for the demo recording.
