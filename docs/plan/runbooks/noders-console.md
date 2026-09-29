# Runbook: the Noders Console (DevNet)

The HackCanton shared participant run by Noders. Canton 3.5.18 (public `GET /v2/version`, 29 Sep). All building and testing happens on the local sandbox first (K-009); this runbook applies from the DevNet skeleton (C2x) on.

Source: `context/11-wallet-and-deployment/s3-materials-update-2026-09-21.md` in the knowledge base (the organizers' Materials tab and the Noders guide, 21 Sep). Never write a credential, token, party id or URL containing a secret into this file.

## What only Abu can do

These need Abu's own HackCanton login. An agent prepares, asks in plain words, and records the result in `acceptance.md`.

1. **Onboard (once, about 2 minutes):** Wallet → "Onboard yourself"; Console → **"Sign in with Authfactory"** (not email and password).
2. **Create the party set** (once): Console → Parties → "Create Party". Budget in `00-plan.md` ("Seats"): venue (primary), resolver, 3 oracles, auditor, liquidity provider, agent runner = 8; outsider and one demo persona = 2; 2 for drive scripts; about 8 visitor seats. The quota shows as "n of 20 parties used". Each created party gets can-act-as and can-read-as for the ledger user automatically.
3. **Upload each DAR release** (R1, R2 …): Console → Collections → Upload DAR (steps below).
4. **Ask Noders** (openly, never quietly) for a higher party quota or a second platform account if the seat pool runs short. Help: the hackathon Telegram, tagging the Noders team, with ledger user id, party id, package name and version, the full error with its trace id, and the request body without the token.

## What the agent records after onboarding

From Console → Participants → the HackCanton node: participant node id, endpoints, ledger user id, party namespace prefix. Party ids go into the bootstrap's env/`parties.json` (never into `docs/`). Each fact is an acceptance row; the seat split is a decision entry.

Then run the Noders probes (K-009), each an acceptance row: rights, `POST /v2/parties` (expected to be refused: the API user is not `participant_admin`), DAR validate, token life (3 h expected), concurrent sessions, deduplication period, `synchronizerId` from `/v2/state/connected-synchronizers`, pruning offset, ledger-time tolerance, whether the primary party counts toward the quota.

## DAR upload with a version bump

Package names are shared across the whole participant; every team can see every DAR; the Console cannot delete one. The same name and version with different content is rejected.

1. Bump `version:` in the package's `daml.yaml` (never re-use a version). The spike is never uploaded. C2x uses the throwaway `abu-pm-dev` 0.0.x; `abu-pm-main` first uploads at R1.
2. `cd daml && dpm build --all && (cd pm-tests && dpm test)`.
3. From R1 on: `dpm upgrade-check` against the last DAR in `daml/released/` (no removed fields; new fields Optional). Record its output.
4. Copy the DAR into `daml/released/` and commit it with the version bump.
5. **Needs Abu:** Console → Collections → Upload DAR → pick the node → choose the `.dar` → upload.
6. Confirm the package appears with its vetting state; record package name, version and vetting state in `acceptance.md`.
7. Reference templates as `#<package-name>:Module:Template`.

## When something fails

Errors return only a trace id (TID). Record the command, the TID and the time in `acceptance.md` as a failed row, then look the TID up in the node's Grafana if access is available (method was "TBD" in the guide).
