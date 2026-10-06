# C4e: the hosted deploy, rehearsed on this Mac, 2026-10-06

The goal was a boring first deploy on Abu's Coolify server: a 2-vCPU VPS with a 38 GB disk, which filled once on 22 Sep. Until this lane, no image had ever been built. This lane:
- built the three images the way Coolify builds them;
- booted each from the `.env.example` lists with throwaway values;
- checked the env lists against the code;
- ran ops, web and docs behind a Coolify-configured Traefik against a local Canton sandbox;
- worked out whether an sslip.io name can serve the app before there is a domain.

Nothing touched the server, Noders or any remote node. The only secrets were throwaway HMAC, cookie and Postgres values in the scratchpad, deleted with it. Party ids in the run were sandbox parties and appear nowhere here.

**Result.**
- All three images build and boot, on arm64 and on linux/amd64.
- Four defects were found and fixed:
  - 241 MB of pnpm metadata baked into each image (C4e.1);
  - a green ledger row with no ledger (C4e.2);
  - a stale `env:check` (C4e.3);
  - a ladder stream that sent no headers for 15 s (C4e.4).
- The runbook now matches what was measured, including six Coolify settings it did not name.
- Plain-HTTP sslip.io cannot serve the app. HTTPS on sslip.io may work, but it is not dependable.

## Setup

- **Host.** This Mac: 16 GB, 10 cores, OrbStack (Docker 29.4, containerd image store, its VM about 7.8 GB). Other lanes were running a Canton sandbox and Next dev servers throughout. The load average was 23–71, and swap use was 7–12.7 GB of 8.7–13.3 GB.
- **Worktree.** `slice/C4e-deploy` from `5e0d81c`.
- **Coolify, read from its source** (`coollabsio/coolify` v4.x, 6 Oct): `app/Jobs/ApplicationDeploymentJob.php`, `bootstrap/helpers/{proxy,docker}.php`, `app/Models/EnvironmentVariable.php`, the advanced-settings and env-var views.
  - A Dockerfile build is `docker build --network host -f <dockerfile> --build-arg <NAME>… <base dir>`.
  - Beforehand `add_build_env_variables_to_dockerfile()` inserts, after every `FROM`:
    - `ARG <name>` for each build-time variable;
    - `ARG COOLIFY_URL/FQDN/BRANCH/RESOURCE_UUID=<value>`;
    - `ARG COOLIFY_BUILD_SECRETS_HASH=<hash of the build-time values>`.
  - `scratchpad/coolify-dockerfile.sh` reproduced exactly that, and every build below used its output.
- **Traefik.** `traefik:v3.7` with the command list from Coolify's `proxy.php`: `--entrypoints.http.address=:80`, `encodequerysemicolons`, `maxConcurrentStreams=250`, the docker provider with `exposedbydefault=false`, and no `forwardedHeaders` setting.
  - Each app carried the labels `fqdnLabelsForTraefik()` writes: a router `Host(…) && PathPrefix(`/`)`, the `gzip` compress middleware, and the service port.
  - HTTP only, on host port 3200, with sslip.io hostnames.

## 1. The images (`d09900b`)

| Image | Build | Time, cold | Image (unpacked; containerd store) | Peak memory |
|---|---|---|---|---|
| web | arm64, 10 cores | 200 s (install 52.5 s, `next build` 81.4 s, export 29.4 s) | 1,374 MB; 1.82 GB → **1,144 MB; 1.52 GB** after C4e.1 | +3.1 GiB, VM-wide |
| ops | arm64 | 55 s (pnpm store warm from web) | 714 MB; 954 MB → **464 MB; 627 MB** | +0.8 GiB |
| docs | arm64 | 91 s (install 35.5 s, build 18.7 s) | 977 MB; 1.29 GB → **858 MB; 1.13 GB** | +2.7 GiB |
| web | linux/amd64 on 2 CPUs, 4 GiB, no swap (buildx `docker-container`, `cpuset-cpus=0-1,memory=4g,memory-swap=4g`), under Rosetta | 379 s (`next build` 199.2 s) | 1,126 MB (319 MB compressed) | **2.76 GiB** (cgroup) |
| ops | same | 62 s | 460 MB (141 MB compressed) | 0.52 GiB |
| docs | same | 164 s | 838 MB (228 MB compressed) | 2.26 GiB |

- **Warm rebuilds.** web 102 s, ops 39 s, docs 65 s.
- **Peak memory.** On arm64 it is the drop in the VM's `MemAvailable`, sampled every second by a sidecar container. On amd64 it is the builder cgroup, from `docker stats` every 2 s.
- **amd64 timings are emulated** and are not a forecast for the VPS. The memory figures are what a 2-CPU builder needed.
- **amd64 native dependencies load.** `sharp` 0.34.5 with libvips 8.17.3, `opentype.js`, `@next/swc-linux-x64-gnu`, `esbuild`, `lightningcss` and rolldown are all present as `linux-x64` builds.
- **The amd64 web and ops booted** under emulation and served `/`, `/status`, `/markets`, `/api/status`, `/opengraph-image` and ops `/health`.
- **Found and fixed (C4e.1).** Each install layer carried `/root/.cache/pnpm`: pnpm 11's registry metadata, 241 MB in web and ops and 130 MB in docs.
  - It is now a BuildKit cache mount (`agari-pnpm-metadata`, `agari-docs-pnpm-metadata`).
  - That took 230–250 MB off web and ops and 120 MB off docs.
- **Where the rest goes.** In web: `node_modules` 623 MB (of which `next` 199 MB, the SWC binary 86 MB, needed at start to load `next.config.ts`), `.next` 161 MB, the node:22-slim base 249 MB.
  - Next's standalone output was not adopted. The web reads files beyond its tree at runtime (`process.cwd()`-relative fonts and the geo table, `scripts/deploy`, `services/ops/config`). Turbopack itself warns "Dynamic filesystem access causes tracing of the whole project". The Dockerfile's whole-tree choice stands.
- **Build caches the server will keep.** pnpm store 0.68 GB (web and ops) and 0.53 GB (docs); Next caches 0.39 GB and 0.14 GB; pnpm metadata 0.25 GB and 0.14 GB.

## 2. Each container on its own, no ledger

- **Env.** Built from `web/.env.example` and `services/ops/.env.example`, with throwaway secrets, a Postgres 16 container (`pm-c4e-pg`) and a parties file with well-formed fake ids. The ledger URL pointed at a closed port.
- **Web.**
  - It booted in 189 ms and logged `[region] IP-to-country: 362122 IPv4 and 348712 IPv6 ranges from /app/web/data/geo/dbip-country-lite.csv.gz`.
  - `/`, `/status`, `/markets`, `/legal`, `/opengraph-image` and `/manifest.webmanifest` all answered 200.
  - `/markets` read "Not live on this network yet … Nothing was sent." The landing read "No Window has settled yet" under "EXAMPLES · HOW A SETTLEMENT READS".
- **What the web image holds.** The geo table (4,491,785 bytes, DB-IP Lite 2026-10), the OG face `Sora-SemiBold.ttf`, the 19 Yosuku stylesheets, the m6x11plus font, and the self-hosted `next/font` WOFF2s. `_next/static` answers with `public, max-age=31536000, immutable`.
- **Found and fixed (C4e.2).** `/status` painted "Canton ledger · ledger end" green with "offset 0", and SLOT 0, with no ledger at all.
  - Cause: the clock route falls back to the projection's cursor, and `syncClock` to 0.
  - `probeRpc` now reads the ledger end itself (`readLedgerEnd`, 5 s bound) and shows the reason when it cannot. Typecheck green, status and venue vitest 24/24.
- **Ops.** It booted the image's `tsx` and logged `boot: … actors …`. Then `canton-venue` reported "failed to start: /v2/state/ledger-end: fetch failed … exiting 78 so the supervisor restarts ops (D-098)".
  - That is by design, and now in the runbook: pm-ops cannot go healthy before its ledger answers.
  - With `OPS_ACTORS=http,relay,game-room`, `/health` answered with every heartbeat.
- **Docs.** Pages (`/start/quickstart`, `/architecture/overview`, `/help/glossary`), `/llms.txt` (10 KB), `/llms-full.txt` (148 KB), `/api/search?query=seat` (46 KB), `/sitemap.xml` and `/robots.txt` all answered 200.
  - The build-time `NEXT_PUBLIC_DOCS_URL` was inlined into `llms.txt` and the sitemap, which proves Coolify's ARG injection reaches `next build`.

## 3. The env

- **Found and fixed (C4e.3).** `pnpm env:check` listed Solana-era keys (`ROLLER_PRIVATE_KEY`, `SPONSOR_PRIVATE_KEY`, `DESK_OPERATOR_ADDRESS`, …) and none of the names a production boot needs. It now lists what the code reads, grouped boot / build / hosted / feature / optional, and names the missing boot names.
- **Compared** every `process.env.*` and env-schema key in `web/src`, `services/ops/src` and `packages/*/src` against the runbook.
- **Added to the runbook:**
  - web build variables `NEXT_PUBLIC_SHARED_DESK_ID`, `NEXT_PUBLIC_X_HANDLE`, `NEXT_PUBLIC_X_EXECUTOR_PARTY`, `NEXT_PUBLIC_CIP56_HOLDINGS`;
  - web features `IOS_APP_ID`, `CIP56_SHARE_INSTRUMENTS`, `CC_LISTING_ID`, `CC_REGISTRY_URL`, `SEASON_*`, `AGARI_OPERATOR_WALLETS`, and the AI provider names;
  - an "optional" row for the web;
  - ops' `NEXT_PUBLIC_CANTON_NETWORK` (runtime), `REDSTONE_GATEWAY_URLS`, `X_HANDLE`, `X_RETTIWT_API_KEY` and the `CC_*` rail names;
  - the parties-file mount on pm-web in the app table.
- **Found in Coolify: every new variable defaults to build time** (`EnvironmentVariable::$attributes`, `is_buildtime => true`).
  - A build-time value is written in clear into the image history. Measured: `docker history --no-trunc pm-c4e-web` shows `RUN |10 NEXT_PUBLIC_APP_ORIGIN=http://… COOLIFY_BUILD_SECRETS_HASH=… /bin/sh -c pnpm --filter web build`.
  - So a secret left at the default lands in every image on the server. The runbook now says: only `NEXT_PUBLIC_*` are build time (K-280).

## 4. The composed run

- **Room on the host.** Memory pressure was "normal" (50% free) at the start, with another lane's sandbox up.
- **Sandbox.** `dpm sandbox` (Canton 3.5.17) on 7650–7655, `JAVA_OPTS=-Xmx1536m`.
- **Bootstrap.** `bootstrap-local.ts --lanes crypto --users alice,bob,outsider --seats 8` with the five DARs from `daml/released/`. It made every write in 40 s.
- **Topology.** Ops ran with `DRY_RUN=0`, `ROLLER_SERIES=BTC-1m,ETH-1m,BTC-5m` and `NEXT_PUBLIC_CANTON_NETWORK=localnet`. Ops, web and docs reached the sandbox at `host.docker.internal:7654`, and sat behind the Coolify-flag Traefik on `{web,ops,room,docs}.<host-ip>.sslip.io:3200`. Postgres was `pm-c4e-pg`, database `pm_c4e_live`.

| Check | Result |
|---|---|
| A 1-minute Window opens | `opened BTC-1m #2 02:31–02:32Z v1 attested in 446 ms`, then a BTC-1m and an ETH-1m Window every minute; the projector `open · cursor 342 (end 344, behind 2) … lag 0.3 s` |
| `/status` | 25 required rows green: ledger end, projector, the three oracle freshness rows, resolver, settler, seats "8 seats · 8 free", database, every ops heartbeat, BTC and ETH prices. The overall read "degraded" only because of 5 rows that need the stock-session calendar (no Alpaca keys here): "ops /session lists no session that has opened" |
| SSE `/prices/stream` through Traefik, Gzip off | 200 `text/event-stream`; the first chunk (3 KB snapshot) at 0.14 s, then an event every 0–2 s for 20 s |
| The same, Gzip middleware on | `content-encoding: gzip`, still one flushed chunk per event (gaps 0.8–2.4 s): Traefik v3.7's compress does not buffer this stream |
| `/ladders/stream` | 27 chunks in 25 s through Traefik, 3 ladders a second, matching 75 events read straight from the container. With no Window quoting, headers came only after 15.2 s, the keepalive: fixed in C4e.4 (`flushHeaders()`, 19 ms) |
| Forged `X-Forwarded-For`, whoami behind Traefik | sent `6.6.6.6`; the backend saw `X-Forwarded-For: 192.168.158.1` only: **Traefik v3.7 with Coolify's flags drops a client's forged value** |
| `TRUSTED_PROXY=forwarded`, 14 lease calls with a fresh forged XFF each | through Traefik: twelve `400`, then `429 429`. Straight to the container: fourteen `400` (each forged address its own bucket) |
| `/internal` exclusion (``… && !PathPrefix(`/internal`)``) | public `POST /internal/quotes` → Traefik `404`; from the web container over the private network → ops `401` (no HMAC) |
| Room WebSocket upgrade | `401` from the room (no token), not a Traefik 404 |
| Runtime memory | web 489 MiB, ops 443 MiB, docs 124 MiB, Postgres 82 MiB, Traefik 43 MiB; the sandbox JVM 1.2 GB RSS |

- **The hairpin.** The web reads ops' `/health`, `/session`, `/prices`, `/prestocks`, `/pyth-index` and `/reserve` through `NEXT_PUBLIC_PRICE_FEED_URL`, from inside the container.
  - After the Mac's LAN address changed (`.2` → `.4`), that hop broke. 14 ops rows on `/status` went red while ops was healthy.
  - Adding `--add-host ops.<old-ip>.sslip.io:host-gateway` to the web container restored all 25.
  - On Coolify this hop goes out to the server's public IP and back through Traefik. The runbook now probes it (§6.1b), and K-286 records why it stays.
- **A secure context.** The same web container served on `http://web.127.0.0.1.sslip.io:3200` gave `isSecureContext: false`, `crypto.subtle: "undefined"`, no `serviceWorker`, and `/markets` stuck on its `aria-busy` skeleton.
  - On `http://web.localhost:3200` (a secure context) it rendered "ETH holds above $2,704.45?" with a live 1m Window.
- **Five hours unattended.** The session paused from 02:35 to 07:25 UTC with everything running.
  - The projector reached 657 Windows: 87 resolved, 563 voided, 7 open.
  - Every void from 03:01 to 07:12 UTC is `MissingPrint:OpenSlot`. The sandbox log shows the three oracle parties' last submission at 03:01:10 and the next at 07:12:50. Over the same span the roller kept opening Windows every minute, and other submissions continued at about 1,490 an hour.
  - The Mac's LAN address changed in that window, and the feeders fetch Coinbase, Kraken and Bitstamp over the internet. So a host network loss is the likely cause. It is not proven: the old ops container's log went with it when it was replaced.
  - The voids are the contract's refund path, and `/status`'s oracle-freshness rows would have shown red. A 4-hour feeder silence does not restart ops, because `/health` is liveness only (K-027). Worth a look on the server.

## 5. sslip.io before a domain

- **Plain HTTP.** Not usable: no secure context, so no seat key. Measured above.
- **HTTPS.** `sslip.io` is not on the Public Suffix List (`publicsuffix.org/list/public_suffix_list.dat`, version `2026-10-01_23-02-52_UTC`, commit `6cd82af`). Let's Encrypt groups certificates by PSL registered domain ("Up to 50 certificates can be issued per registered domain … every 7 days", letsencrypt.org/docs/rate-limits). So all of sslip.io shares one bucket.
  - The sslip.io/nip.io page (sslip.io now redirects to nip.io) says the limit was raised "from 50 to 250,000", and that a further request was refused.
  - Coolify's docs ("Domains") say generated sslip.io URLs "stay on HTTP" and "Do not change it to https://: Let's Encrypt rate-limits the entire shared sslip.io zone, so certificate issuance fails."
  - Per-account limits that are ours alone: 5 per exact set of names per 7 days, 5 failed validations per name per hour, 300 orders per 3 hours.
  - Name format checked: `x.1.2.3.4.sslip.io` and `x.1-2-3-4.sslip.io` both resolve to `1.2.3.4`.
- Written into the runbook (§8) as an option with those limits.

## Cleanup

- **Removed.** Every container (`pm-c4e-{web,ops,docs,pg,traefik,whoami,memwatch}`), the network `pm-c4e-net`, the volume `pm-c4e-ops-data`, the Postgres container's anonymous volume, the buildx builder `pm-c4e-vps` and its `moby/buildkit` image, the pulled `traefik:v3.7`, `traefik/whoami` and `node:22-slim` tags, and every superseded image.
- **Sandbox stopped.**
- **Build cache.** Every record these builds created was pruned leaf-first by id, except the 56 that are the final images' own layers. Records from before this lane were not touched. Volumes are back to 71.
- **Kept.** `pm-c4e-web:latest` (`sha256:195d1d31396a…`), `pm-c4e-ops:latest` (`6ab4e006b518…`, includes C4e.4), `pm-c4e-docs:latest` (`c1f5c612d97c…`), all arm64.
  - Their `NEXT_PUBLIC_*` values are this rehearsal's sslip.io hosts. Rebuild them for any other use.

## Decisions

### K-280 — Only `NEXT_PUBLIC_*` are build-time variables on Coolify
- **Date / owner:** 2026-10-06 · Claude (C4e).
- **Evidence:** this note §3. Coolify's `EnvironmentVariable` defaults to `is_buildtime => true`. Every build-time variable becomes a `--build-arg` and an injected `ARG`, and `docker history --no-trunc` showed the values in clear.
- **Rule:** on pm-web and pm-docs only the `NEXT_PUBLIC_*` names are "Build time: yes"; every other variable, secrets above all, is runtime only. On pm-ops nothing is build time. Keep "Inject build args automatically" and "Source commit: Runtime only"; keep "Build secrets" off, because the Dockerfiles read `NEXT_PUBLIC_*` as ARGs.
- **User-visible:** none.
- **Approval:** default; overrulable.

### K-281 — pm-ops deploys with Coolify's "Consistent name (no rolling updates)"
- **Date / owner:** 2026-10-06 · Claude (C4e).
- **Evidence:** `ApplicationDeploymentJob::rolling_update()`. By default it starts the new container, waits for health, then stops the old. With consistent naming it calls `stop_running_container(force: true)` before `start_by_compose_file()`.
- **Rule:** pm-ops sets Advanced → Container naming → consistent name, so two ops never overlap (AD-4). Web and docs keep rolling updates.
- **User-visible:** a deploy of ops pauses SSE and quoting while the old container stops and the new one boots. Here ops was listening 1.3 s after boot.
- **Approval:** default; overrulable.

### K-282 — No host port mappings on pm-web, pm-ops or pm-docs
- **Date / owner:** 2026-10-06 · Claude (C4e).
- **Evidence:** §4. Through Traefik a forged `X-Forwarded-For` could not reset the seat rate limit (`429` on calls 13–14). Straight to the container, every forged address got its own bucket.
- **Rule:** the apps are reachable only through Coolify's Traefik; "Ports Mappings" stays empty.
- **User-visible:** none.
- **Approval:** default; overrulable.

### K-283 — pm-web's health check stays on Coolify's default path `/`
- **Date / owner:** 2026-10-06 · Claude (C4e).
- **Evidence:** Coolify's defaults: path `/`, 5 s timeout, 5 s interval, 10 retries. `/api/status` took 1.0–1.7 s, runs every probe, and can approach its 5 s ops timeout when ops hangs.
- **Rule:** use the default path, not `/api/status`.
- **User-visible:** none.
- **Approval:** default; overrulable.

### K-284 — `/status` judges the ledger by reading the ledger itself
- **Date / owner:** 2026-10-06 · Claude (C4e).
- **Evidence:** §2. With no ledger the row read "offset 0" in green.
- **Rule:** the "Canton ledger · ledger end" row is green only when the participant answers `ledger-end` within 5 s. The clock route's projection fallback stays for the client clock, never for the verdict.
- **User-visible:** with the ledger down, `/status` names it red with the reason, as D-015 asks.
- **Approval:** default; overrulable.

### K-285 — No interim hosted URL on plain-HTTP sslip.io; HTTPS sslip.io is a documented, undependable fallback
- **Date / owner:** 2026-10-06 · Claude (C4e).
- **Evidence:** §4 (no secure context: no `crypto.subtle`, `/markets` stuck loading) and §5 (sslip.io off the PSL; the shared Let's Encrypt bucket; Coolify's own warning).
- **Rule:** the hosted URL is the domain. Runbook §8 states the sslip.io option with its limits. Nothing in the submission depends on it.
- **User-visible:** none.
- **Approval:** default; overrulable.

### K-286 — The web keeps reading ops through the public URL; the runbook probes the hairpin
- **Date / owner:** 2026-10-06 · Claude (C4e).
- **Evidence:** §4. `/status`, prestocks, pyth-index, the OG ticker, the leaderboard session and the reserve audit fetch `NEXT_PUBLIC_PRICE_FEED_URL` on the server. When that hop broke, 14 rows went red.
- **Rule:** not changed in this lane, because six modules would move and the hop works wherever the server reaches its own hostname. Runbook §6.1b checks it on every deploy. Preferring `OPS_INTERNAL_URL` on the server side is the fix if the probe fails.
- **User-visible:** none while the probe passes.
- **Approval:** default; overrulable.
