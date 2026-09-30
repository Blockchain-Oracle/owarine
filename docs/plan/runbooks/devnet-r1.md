# Runbook: DevNet R1 on the Noders participant

This covers the first time the product runs on Noders DevNet: onboarding, parties, and the first DAR release (R1). The Console mechanics are in `noders-console.md`. This page is the exact click list for Abu and the agent's list after it. Never write a credential, a token, a party id or a URL that carries a secret into this file or anywhere in `docs/`.

**Status on 30 Sep:** not started. Everything so far ran on the local sandbox (K-009). Nothing has been uploaded to Noders. The only thing known is public: `GET /v2/version` reports Canton 3.5.18, and CORS is open.

## What Abu clicks (about 15 minutes, once)

Use the HackCanton account throughout. The agent is ready when Abu starts, and the DAR files are in `daml/released/` (see "Before Abu starts").

1. **Onboard the wallet.** Open the Noders wallet page from the HackCanton Materials tab and click **"Onboard yourself"**. Wait until it shows the wallet as onboarded.
2. **Sign in to the Console.** Open the Noders Console and click **"Sign in with Authfactory"**. Do not use email and password.
3. **Create the parties.** Go to Console → **Parties** → **Create Party**, once per row below, typing the hint exactly as written. That is 19 parties. The quota shows "n of 20 parties used". If it refuses before 19, stop and tell the agent: it can run with fewer seats.

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

4. **Copy the party ids to the agent.** Go to Console → Parties and copy the list (hint and full id per line) into the chat, or into a local file the agent names. Party ids are not secrets, but they never go into Git.
5. **Upload the DARs, in this order.** For each: Console → **Collections** → **Upload DAR** → pick the HackCanton node → choose the file → **Upload**. Wait for each to show as vetted before the next.
   1. `daml/released/abu-pm-main-0.5.0.dar`
   2. `daml/released/abu-pm-tickets-<version>.dar`
   3. `daml/released/abu-pm-agents-<version>.dar`
   4. `daml/released/abu-pm-games-<version>.dar`

   The agent names the exact file names when it hands them over. The order matters because tickets, agents and games are each built against main 0.5.0. Every DAR carries its dependencies, so uploading main first means the later uploads add nothing unexpected. Package names are shared across the participant, and the Console cannot delete a DAR, so there is no undo. If an upload says a package with that name and version already exists with different content, stop and tell the agent (it means a name collision, K-009).
6. **The platform credential.** Choose one of these and tell the agent which, in plain words:
   - **(A, the default, K-035):** paste the platform password into Coolify's secret store for **both** pm-web and pm-ops yourself, as `LEDGER_OIDC_PASSWORD`, with `LEDGER_OIDC_USERNAME`.
   - **(B):** paste it into pm-ops only.

   The agent never sees it in chat. It is rotated after judging.

That is all. Everything below is the agent's.

## Before Abu starts (the agent)

- **Engine 0.5.0 merged.** Slice C2d (maker vault) is merged to `main`, with `dpm test` green.
- **Satellites rebuilt.** Tickets, agents and games are rebuilt against `abu-pm-main-0.5.0.dar`: their `data-dependencies` are bumped and each version is bumped. `dpm test` runs green over all of them.
- **Upgrade check.** `dpm upgrade-check --both` passes for each package against its last local version (nothing is on Noders yet, so this is the local baseline).
- **Files in place.** The four DARs are copied into `daml/released/` and committed with the version bumps (`noders-console.md`, "DAR upload with a version bump").
- **Name collision.** Confirm no package named `abu-pm-*` already exists on the participant. The Console's package list is visible to every team.

## After Abu's clicks (the agent)

1. **Record the onboarding facts** from Console → Participants: participant node id, JSON API endpoint, ledger user id, and party namespace prefix. Each goes in an `acceptance.md` row, with values that are not secret.
2. **Write the DevNet parties file** outside the repo: `~/.config/agari/canton/parties.devnet.json`, and the Coolify file mount `/data/parties.json`.
   - The shape is the one `bootstrap-local.ts` writes: `{ network: "devnet", parties: { venue, resolver, "oracle-coinbase", "oracle-kraken", "oracle-bitstamp", auditor, lp, "agent-runner" }, users: { alice, bob, outsider, "seat-1" … "seat-8" } }`.
   - The web and ops both read it (K-026).
3. **Run the Noders probes (K-009), one acceptance row each, failures included, with the trace id:**
   - rights of the ledger user over the 19 parties;
   - `POST /v2/parties` (expected to be refused);
   - DAR validate;
   - token life (3 h expected);
   - concurrent sessions: two processes on one login. If the realm refuses, option B of K-035 is forced;
   - deduplication period;
   - `synchronizerId` from `/v2/state/connected-synchronizers`;
   - pruning offset;
   - ledger-time tolerance;
   - whether the primary party counts toward the quota.
4. **Confirm vetting.** Record each package's name, version and vetting state in `acceptance.md`.
5. **Bootstrap the venue on DevNet.** Create the VenueDesk, the cash shards, the Series per lane, the ticket reserves with their LP seed, the arena and the season pool.
   - `scripts/bootstrap-local.ts` refuses anything but an unauthenticated local sandbox, on purpose, because it allocates parties.
   - The DevNet variant (C2x) takes the parties from the file above, allocates nothing and uploads nothing, and otherwise makes the same contracts. It is idempotent, like the local one.
   - Every command it sends is an acceptance row with its update id.
6. **Four-viewpoint smoke on DevNet** (`first-call.ts`):
   - a market opens;
   - Alice gets a quote and accepts it;
   - three oracles post, the resolver resolves, and the venue settles;
   - Bob and the outsider see nothing of Alice's;
   - one void refunds cost plus fee.

   Failure bodies are recorded. Then run `contention.py 16` and a 10-minute cadence soak.
7. **Point the hosted apps at DevNet.** In Coolify, set `LEDGER_JSON_API_URL`, `LEDGER_AUTH_MODE=password` and the `LEDGER_OIDC_*` names Abu filled. Redeploy pm-ops, then pm-web, and run the probes in `coolify-deploy.md` §6.
8. **Update STATUS.md and capabilities.json.** A capability becomes `live` only with its DevNet acceptance row (the `capabilities-evidence` invariant enforces this).

## If something fails

- Errors come back with only a trace id. Record the command, the trace id and the time as a failed row in `acceptance.md`.
- Party quota short: ask Noders openly in the hackathon Telegram (`noders-console.md`, item 4). Meanwhile run with fewer seats: the seat pool is whatever `users.seat-*` lists.
- DevNet unusable: Plan B is a Canton sandbox on a VPS, switched by env var (plan "Risks"). The local sandbox remains the fallback for the demo recording.
