# Runbook: the hosted deploy on Coolify

Abu's Coolify server, beside Agari's apps (which stay up). **No Cloudflare** (K-003): the domain is registered at Namecheap, its A records point straight at the server, and Coolify's Traefik is the only proxy. It ends TLS with Let's Encrypt.

**What has been run.** Nothing on the server yet. On 6 Oct the C4e lane rehearsed it on a Mac (`docs/evidence/c4e-deploy.md`):
- the three images built exactly as Coolify builds them (its `ARG` injection reproduced), natively on arm64 and as linux/amd64 on a 2-CPU, 4 GB, no-swap builder;
- each booted from these env lists; then ops, web and docs ran behind Traefik v3.7 started with Coolify's own flags and labels, against a local Canton sandbox, for five hours.

Every number below marked "measured" comes from that note. Every probe in §6 becomes an acceptance row when it runs on the server. Never write a secret, a token or a party id into this file.

**Who does what.** Abu does the Namecheap records and anything that needs his Coolify login. The agent does the rest, if Abu gives it a Coolify API token for the session. Otherwise Abu clicks, following this page.

## 0. Before the first deploy: capacity (the 22 Sep lesson)

The server is a 2-vCPU VPS with a 38 GB disk. That disk filled on 22 Sep, and the full disk crash-looped Agari's database.

1. **Free disk.** Run `df -h /` and `docker system df` on the server. Record both.
2. **Budget (measured).**

   | App | Image on disk | Build caches it keeps | `next build` peak memory |
   |---|---|---|---|
   | pm-web | 1.1 GB unpacked; 1.5 GB in Docker 29's containerd store | pnpm store 0.7 GB (shared with ops), Next cache 0.4 GB, pnpm metadata 0.25 GB | 2.8 GiB on 2 CPUs (3.1 GiB on 10) |
   | pm-docs | 0.85 GB; 1.1 GB | pnpm store 0.5 GB, Next cache 0.15 GB, pnpm metadata 0.14 GB | 2.3 GiB on 2 CPUs |
   | pm-ops | 0.47 GB; 0.6 GB | the web's pnpm store | 0.5 GiB (no Next build) |

   - The first deploy of all three needs about **6 GB** of disk.
   - Each later deploy adds one image per app until the old one is pruned.
   - Postgres starts small. The apps create their own tables on first use, so there is no migration step.
   - Keep at least **10 GB free** before any build.
   - If the budget does not fit beside Agari's apps, stop and ask Abu. He can add a volume or a second small server. That is his call, recorded as a decision.
3. **Prune.** Run `docker image prune -a --filter "until=72h"` and `docker builder prune --filter "until=72h"`.
   - This removes only unused images, never a running app's.
   - Coolify's own Docker cleanup (Server → Settings) can do this on a schedule.
4. **One build at a time.** Server → Settings → **Concurrent builds = 1**. Two Next builds at once on 2 vCPUs is the swap-and-stall case.
5. **Memory.**
   - Running, measured: web about 490 MB, ops 440 MB, docs 125 MB, Postgres 80 MB.
   - The web build needs 2.8 GiB on top of whatever is running. It finished without swap in a 4 GiB cgroup with nothing else in it.
   - With Agari's apps running on a server of 4 GB or less, add 4 GB of swap once: `fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile`, plus the fstab line.
6. **Build times (measured, cold).** These are not a forecast for the server: amd64 ran under emulation on the Mac.
   - Native arm64 on 10 cores: web 3 min 20 s, docs 1 min 31 s, ops 55 s.
   - linux/amd64 on 2 CPUs: web 6 min 19 s, docs 2 min 44 s, ops 1 min 2 s.
   - A warm rebuild of web is under 2 minutes.

## 1. DNS at Namecheap (Abu)

Namecheap → Domain List → the domain → **Advanced DNS** → Add New Record. Each of these is an **A Record** with **Value = the server's IPv4** and TTL Automatic:

| Host | Serves | Coolify app |
|---|---|---|
| `@` | the web app | `pm-web` |
| `www` (optional) | redirect to `@` | `pm-web` |
| `ops` | price and ladder SSE, `/health` | `pm-ops` (port 8080) |
| `room` | the duel room's WebSocket | `pm-ops` (port 8787) |
| `docs` | the docs site | `pm-docs` |

- Remove Namecheap's default parking records for `@` and `www` (the CNAME to `parkingpage.namecheap.com` and the URL Redirect record), or they fight the A records.
- Add AAAA records only if the server's IPv6 path is known to work.
- A wildcard `*` A record also works, but explicit hosts are easier to read later.
- **Verify** each one from any machine: `dig +short <host>.<domain> A` returns the server's IPv4. Let's Encrypt cannot issue a certificate until it does.

## 2. TLS

Coolify's Traefik uses the Let's Encrypt **HTTP-01 challenge**. Port 80 must be reachable from the internet, and each domain must already resolve (step 1) **before the first deploy of the app that claims it**.

- Put `https://` on every domain in Coolify, so Traefik requests a certificate and redirects HTTP to HTTPS.
- Check it: `curl -sI https://<host>.<domain> | head -1` answers over TLS. `echo | openssl s_client -connect <host>.<domain>:443 -servername <host>.<domain> 2>/dev/null | openssl x509 -noout -issuer -dates` names Let's Encrypt.
- If a certificate does not come: check the Traefik logs in Coolify (Servers → Proxy → Logs) for `acme`, fix DNS, then redeploy.
- **The app needs HTTPS, not only for looks.** A visitor's seat is a non-extractable WebCrypto key, and `crypto.subtle` exists only in a secure context (HTTPS, or `localhost`). Measured on plain HTTP: `isSecureContext` was false, `crypto.subtle` was undefined, and `/markets` stayed on its loading skeleton. The same container served on `http://web.localhost` rendered a live Window.

## 3. The apps (one Coolify project, e.g. "canton-pm")

Every app is from the Git repository (GitHub App or deploy key), branch `main`. For the judged URL, it is instead the `live` worktree's snapshot tag (plan, "Submission snapshot").

| App | Type / build | Base dir | Dockerfile | Ports exposed | Domains | Storage |
|---|---|---|---|---|---|---|
| `pm-db` | Coolify-managed **PostgreSQL** 16 | — | — | — (internal only) | none; do not make it public | Coolify volume |
| `pm-ops` | Application, **Dockerfile** | `/` | `/services/ops/Dockerfile` | `8080,8787` | `https://ops.<domain>:8080,https://room.<domain>:8787` | Persistent volume at `/data` (deck journal); **file mount** `/data/parties.json` |
| `pm-web` | Application, **Dockerfile** | `/` | `/web/Dockerfile` | `3000` | `https://<domain>` (and `https://www.<domain>`) | **file mount** `/data/parties.json` |
| `pm-docs` | Application, **Dockerfile** | `/docs-site` | `/Dockerfile` | `3000` | `https://docs.<domain>` | none |

Settings that matter (the labels are Coolify v4's current ones; an older build shows the same switches as checkboxes):

- **pm-ops runs exactly one container.** Every actor is a single writer (AD-4). Set no replicas.
  - Advanced → Container → **Container naming: "Consistent name (no rolling updates)"** (older builds: "Consistent Container Names").
  - Coolify's deploy job then stops the old container before it starts the new one. Its default is a rolling update: start the new container, wait for health, then stop the old one. For ops that would double-open Windows.
- **pm-ops: Gzip off** (Advanced → Proxy → "Gzip compression: Disabled"; older: "Enable Gzip Compression").
  - Measured on Traefik v3.7: SSE arrived event by event with Gzip off.
  - With Gzip on it was gzip-encoded, but still flushed per event. So Gzip is not the cause if a burst appears (§6.4).
  - Keep it off anyway: compressing a stream buys nothing.
- **No "Ports Mappings" on any app.** Leave the field empty.
  - A host port bypasses Traefik. Measured: requests sent straight to the web container with a forged `X-Forwarded-For` each got a fresh rate-limit bucket.
  - A host port also turns off rolling updates.
- **Build settings (Advanced → Build), keep the defaults:**
  - "Build arguments: Inject build args automatically". Coolify adds `ARG <name>` after every `FROM` for each build-time variable; that is how `NEXT_PUBLIC_*` reach `next build`.
  - "Source commit availability: Runtime only". The other choice rebuilds every layer on every commit.
  - In Environment Variables, **"Build secrets" off**. With BuildKit secrets on, the Dockerfiles never see `NEXT_PUBLIC_*`.
- **pm-web health check:** leave Coolify's default (path `/`, 5 s timeout). The image has `curl`.
  - Not `/api/status`. It runs every probe, took 1–1.7 s measured, and can approach 5 s when ops hangs, so a deploy would roll back.
- **pm-ops health check:** the Dockerfile's own `HEALTHCHECK` (Coolify uses it when it finds one) is liveness only: any HTTP answer from `/health` counts. `/health` can report not-ok for a third-party feed (K-027), and restarting would not fix that.
- **Deploy order:** pm-db → pm-ops → pm-web → pm-docs.
  - Ops starts only when the ledger and Postgres answer. Otherwise an actor fails to start and ops exits 78 (D-098); the container restarts, and the deploy reports unhealthy. Measured with no ledger.
  - So pm-ops deploys after the ledger it points at is reachable: on DevNet, after R1.
  - The web refuses to boot in production without ops' URL and secret (`instrumentation-node.ts`).
- **Private network.** Coolify puts a project's apps on its Docker network. Use the internal hostnames it shows under each app for `OPS_INTERNAL_URL`, `AGARI_WEB_ORIGIN` and `DATABASE_URL`, so these hops never leave the server.
- **The web also reads ops through the public URL.**
  - `/status` and five server routes (prestocks, pyth-index, the OG ticker, leaderboard sessions, the reserve audit) fetch `NEXT_PUBLIC_PRICE_FEED_URL`, i.e. `https://ops.<domain>`, from inside the container.
  - So the server must reach its own public hostname (§6.1b). Measured: when that hop broke, 14 ops rows on `/status` went red while ops was healthy.
- **Do not route `/internal/*` publicly (C4d L4).**
  - Only the web calls ops' `POST /internal/*`, over the private network.
  - pm-ops → Configuration → General → "Container Labels". Coolify writes each router rule as ``Host(`ops.<domain>`) && PathPrefix(`/`)``. Append `` && !PathPrefix(`/internal`)`` to it, on both the `https-0-…` and the `http-0-…` router, then redeploy.
  - Measured with Traefik v3.7: a public `POST /internal/quotes` answered Traefik's `404`. The same call over the private network reached ops and was refused `401` without its HMAC.
  - Check: `curl -si -X POST https://ops.<domain>/internal/quotes | head -1` answers `404`, and the web still quotes.
  - The routes stay HMAC-signed with a single-use nonce either way; this only takes them off the internet. If Coolify regenerates the labels, repeat it.

## 4. Environment per app (names only; values in Coolify, never in Git)

Full lists with defaults: `web/.env.example`, `services/ops/.env.example`, `docs-site/.env.example`. `pnpm env:check` prints, per app, which of the names below are set (never their values).

**Build time or runtime.** Coolify marks every new variable **"Build time: yes"** by default.
- Every build-time variable becomes a `--build-arg`, and its value is written into the image's history in clear text. Measured: `docker history --no-trunc` shows `RUN |10 NEXT_PUBLIC_APP_ORIGIN=… COOLIFY_BUILD_SECRETS_HASH=…`.
- Any build-time value that changes also invalidates every layer from `apt-get` down.
- So: **only the `NEXT_PUBLIC_*` names of pm-web and pm-docs are build-time.** Set "Build time: no" on every other variable, secrets above all.
- pm-ops needs no build-time variable at all.

**Shared secrets.** Generate each once, with `openssl rand -hex 32`, and set the same value in both apps:

- `OPS_INTERNAL_SECRET`
- `ROOM_TOKEN_SECRET`
- `PUSH_DRAIN_SECRET`

**Ops only (C4d L4).** `OPS_ADMIN_SECRET` (same `openssl rand -hex 32`), set on pm-ops and never on pm-web: it signs the season admin's `season/distribute` and `season/withdraw`, which are closed without it. The admin runs `scripts/season-admin.ts` with it from their own machine.

**Ledger.**
- On DevNet: `LEDGER_AUTH_MODE=password` with the `LEDGER_OIDC_*` set, in **both** web and ops (K-035).
- Plan B, a hosted sandbox: `LEDGER_AUTH_MODE=none`.

**pm-db:** Coolify generates the credentials. Copy its internal connection URL into `DATABASE_URL` for web and ops.

**pm-ops** (all runtime):

| Group | Names |
|---|---|
| Required | `DATABASE_URL`, `DRY_RUN=0`, `OPS_INTERNAL_SECRET`, `AGARI_PARTIES_FILE=/data/parties.json`, `LEDGER_JSON_API_URL`, `LEDGER_AUTH_MODE` (+ `LEDGER_OIDC_*`) |
| Reaching the web | `AGARI_WEB_ORIGIN` (the web's internal URL, `http://<pm-web internal host>:3000`), `NEXT_PUBLIC_APP_ORIGIN=https://<domain>` (read at runtime here) |
| Network | optional `NEXT_PUBLIC_CANTON_NETWORK` (default `devnet`; `localnet` for a hosted sandbox) |
| Sources | `ALPACA_ENDPOINT`, `ALPACA_KEY_ID`, `ALPACA_SECRET_KEY`, `FINNHUB_API_KEY`, optional `PYTH_API_KEY`, `JUPITER_API_KEY`, `REDSTONE_GATEWAY_URLS` |
| Season admin | `OPS_ADMIN_SECRET` (ops only; unset = the admin routes are closed) |
| Games, push, agents | `ROOM_TOKEN_SECRET`, `GAME_DECK_KEY`, `PUSH_DRAIN_URL=https://<domain>/api/push/drain`, `PUSH_DRAIN_SECRET`, optional `OPENAI_API_KEY`, `AI_MODEL`, `X_HANDLE`, `X_RETTIWT_API_KEY` |
| Canton Coin rail | the `CC_*` names in `runbooks/cc-rail.md`, only when that runbook runs (`OPS_ACTORS=…,cc-rail`) |
| Set by the image | `OPS_HTTP_PORT=8080`, `GAME_ROOM_HOST=0.0.0.0`, `GAME_ROOM_PORT=8787`, `GAME_DECK_JOURNAL=/data/deck-journal.jsonl` |

About the indexer URL in ops: `NEXT_PUBLIC_AGARI_INDEXER_URL` may be left unset. Ops resolves a relative or absent value against `AGARI_WEB_ORIGIN`, then `NEXT_PUBLIC_APP_ORIGIN` (C10a). An absolute value still wins. C9c and C9d each lost a duel re-snapshot to a relative value.

Without the Alpaca keys there is no stock-session calendar. Measured: five `/status` rows stay red (the three "Print sources" rows, "RedStone gateway", "Cross-check"), each with "ops /session lists no session that has opened", and the overall reads "degraded".

**pm-web:**

| Group | Names |
|---|---|
| Required at boot | `DATABASE_URL`, `AGARI_SEAT_COOKIE_SECRET`, `OPS_INTERNAL_URL` (ops' internal URL on `:8080`), `OPS_INTERNAL_SECRET`, `AGARI_PARTIES_FILE=/data/parties.json` (a file mount on pm-web too, or `AGARI_VENUE_PARTY` + `AGARI_SEAT_PARTIES`), `LEDGER_JSON_API_URL`, `LEDGER_AUTH_MODE` (+ `LEDGER_OIDC_*`) |
| Proxy | `TRUSTED_PROXY=forwarded` (the image's default; set it anyway so it is visible) |
| Build variables (build time only) | `NEXT_PUBLIC_APP_ORIGIN=https://<domain>`, `NEXT_PUBLIC_SITE_URL=https://<domain>`, `NEXT_PUBLIC_DOCS_URL=https://docs.<domain>`, `NEXT_PUBLIC_PRICE_FEED_URL=https://ops.<domain>`, `NEXT_PUBLIC_LADDER_URL=https://ops.<domain>`, optional `NEXT_PUBLIC_CANTON_NETWORK`, `NEXT_PUBLIC_AGARI_VENUE_ID`, `NEXT_PUBLIC_SHARED_DESK_ID`, `NEXT_PUBLIC_X_HANDLE`, `NEXT_PUBLIC_X_EXECUTOR_PARTY`, `NEXT_PUBLIC_CIP56_HOLDINGS` |
| Features | `ROOM_TOKEN_SECRET`, `GAME_ROOM_PUBLIC_URL=wss://room.<domain>`, `PUSH_DRAIN_SECRET`, `EXPO_ACCESS_TOKEN`, `FINNHUB_API_KEY`, `AI_MODEL` + one of `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `AI_GATEWAY_API_KEY` (or `AI_BASE_URL` + `AI_API_KEY`), `X_API_KEY`, `X_API_KEY_SECRET`, `X_REDIRECT_URI=https://<domain>/api/x/callback`, `X_SESSION_SECRET`, `IOS_APP_ID` (the `apple-app-site-association` answer), `CIP56_SHARE_INSTRUMENTS` (holdings), `CC_LISTING_ID` + `CC_REGISTRY_URL` (the Canton Coin rail), `SEASON_*`, `AGARI_OPERATOR_WALLETS` |
| Optional | `AGARI_GEOIP_DB` (the image's table is the default), `AGARI_REGION_OVERRIDE`, `AGARI_INDEXER_INTERNAL_URL`, `AGARI_SEAT_IDLE_TTL_SEC`, `AGARI_SEAT_HARD_CAP_SEC`, `PROJECTOR_STREAM` |

**pm-docs:** `NEXT_PUBLIC_DOCS_URL=https://docs.<domain>` and `NEXT_PUBLIC_APP_URL=https://<domain>`, both build time only.

**Region hold.** The web build downloads DB-IP's IP-to-Country Lite table (about 4.5 MB, CC BY 4.0, credited on `/legal`) with `scripts/geo/fetch-dbip.mjs`.
- Measured: the image holds `/app/web/data/geo/dbip-country-lite.csv.gz`, and the boot log reads `[region] IP-to-country: 362122 IPv4 and 348712 IPv6 ranges`.
- If that download fails, the build still succeeds and the boot log says `[region] no IP-to-country database`. Every visitor then reads as open until a rebuild.
- `AGARI_REGION_OVERRIDE=US` forces the held state for a test, and a redeploy without it clears it.

## 5. First deploy, in order

1. pm-db: create it and note its internal URL.
2. pm-ops: create the file mount `/data/parties.json` with the parties file for this network. The DevNet one comes from `devnet-r1.md`. It holds party ids, not secrets, but keep it out of Git anyway. Set the env, then deploy.
   - Watch the log for `boot: … live, actors …`, the `ledger … parties 8/8` lines, the first `opened BTC-1m #…`, and the heartbeats.
   - A line `failed to start: … exiting 78` names the dependency that did not answer (ledger or Postgres).
3. pm-web: set the same file mount (or the party variables) and the env, then deploy.
   - The boot either passes the seat and ledger check or exits naming the missing variables (never their values).
   - The healthy boot log ends with the `[region] IP-to-country: …` line.
4. pm-docs: deploy.
5. Record in `acceptance.md`: the image digests, the free disk after the builds (`df -h /`), and every probe below.

## 6. Probes after each deploy (each an acceptance row)

1. **Health.**
   - `curl -s https://ops.<domain>/health | head -c 400` shows every venue actor.
   - `https://<domain>/status` is green from outside. Check it from a phone on mobile data, not the server.
   - "Canton ledger · ledger end" now reads the participant itself (C4e.2). Before, with no ledger, it showed "offset 0" in green.

   **1b. The server reaches its own public hostname.** Run, on the server, `docker exec <pm-web container> curl -s -o /dev/null -w '%{http_code}\n' https://ops.<domain>/health`.
   - It must print `200` or `503`, not `000`. The web's `/status` and several routes read ops this way (§3).
2. **Forwarded proto and host.** `curl -sI https://<domain>/api/x/start` should not redirect to `http://`.
   - The X OAuth start and the faucet's same-origin check both read `publicOrigin()`, which trusts `x-forwarded-proto` and `x-forwarded-host` only because `TRUSTED_PROXY=forwarded`.
3. **Forged `X-Forwarded-For`.** Does a visitor's own header reach the app?
   - Deploy the throwaway service `traefik/whoami` in Coolify (a one-click "Docker Image" app) on `https://whoami.<domain>`. It needs a temporary A record, or use the Coolify-generated sslip.io domain.
   - Run `curl -s -H 'X-Forwarded-For: 6.6.6.6' https://whoami.<domain> | grep -i x-forwarded-for`.
   - Measured on the Mac with `traefik:v3.7` and Coolify's flags: the line read only the real address. Traefik dropped the forged value, because the client is not in `forwardedHeaders.trustedIPs`.
   - If it reads `6.6.6.6, <your ip>`, Traefik appended instead. **Either way the app is safe.** With `TRUSTED_PROXY=forwarded`, `clientIp()` takes the **last** entry, which is the one Traefik added (C10a).
   - Record which of the two Traefik did, then delete the whoami app and its record.
   - If the line shows **no** real IP at all, stop: a second proxy sits in front. Change `TRUSTED_PROXY` only after knowing which proxy it is.
   - App-side confirmation:
     - Run `for i in $(seq 1 14); do curl -s -o /dev/null -w '%{http_code} ' -X POST -H "X-Forwarded-For: 10.0.0.$i" -H 'content-type: application/json' -d '{}' https://<domain>/api/seat; done`.
     - Measured through Traefik: twelve `400`, then `429 429` (12 lease attempts a minute per address). A forged header did not reset the count.
     - The same loop sent straight to the container answered fourteen `400`, which is why §3 forbids a host port.
     - This spends nothing: an empty body is refused before any lease.
4. **SSE through Traefik, unbuffered.** Run `curl -sN https://ops.<domain>/prices/stream | while read -r l; do printf '%s %s\n' "$(date +%T)" "${l:0:80}"; done`.
   - Events must print one by one, a few seconds apart, from the first second.
   - Measured through Traefik v3.7: the first chunk (a 3 KB snapshot) arrived at 0.14 s, then an event every 1–2 s.
   - If nothing prints and then a burst arrives, something is buffering. Check that no custom Traefik middleware is on the router; pm-ops' Gzip should be off (§3), though Traefik v3.7 flushed per event even with it on.
   - Repeat for `https://ops.<domain>/ladders/stream` while a Window is quoting. Measured: three ladders a second.
   - With no Window quoting, the stream sends only a keepalive every 15 s. Before C4e.4 it also held back its headers for those 15 s.
   - In the browser, the ticket's price ladder moves without a reload.
5. **Room WebSocket.** Test that `wss://room.<domain>` upgrades: `curl -si -H 'Connection: Upgrade' -H 'Upgrade: websocket' -H 'Sec-WebSocket-Version: 13' -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' https://room.<domain>/ | head -1`.
   - Expect `101` or a room-level refusal, not a 404 from Traefik. Measured: `401` from the room, which wants its token.
   - The room listens only once the games bootstrap has created the arena. Before that, ops logs "GameArena is not deployed on this network".
6. **Region hold.**
   - The web log shows `[region] IP-to-country: … ranges`.
   - From a US address (a VPN, or the `AGARI_REGION_OVERRIDE=US` redeploy), a funded route answers 451 and the ticket paints its held state.
   - Browsing still works.
7. **Certificates.** Every host answers over TLS with a Let's Encrypt issuer (step 2).
8. **Disk after the builds.** Run `df -h /` again. If free space dropped under 10 GB, prune before the next build.

## 7. Updating

- Push to the deployed branch, then Deploy in Coolify (or a webhook). Builds queue one at a time.
- Do not deploy pm-ops while a Window is settling if you can avoid it. Every actor reconciles from the ledger on restart (C3 gate), so this is courtesy, not safety.
- Traefik's rate-limit middleware is available if abuse appears during judging. The app's own per-IP limits already apply once the client IP is trusted.

## 8. A hosted URL before the domain: Coolify's sslip.io names (K-285)

When a server has no wildcard domain, Coolify generates `http://<app-id>.<server-ip>.sslip.io`. sslip.io answers any name that contains an IP with that IP, so no DNS record is needed (Coolify docs, "Domains"). Two ways to use it, with their exact limits:

**Plain HTTP: not usable for this app.**
- `http://…sslip.io` is not a secure context. The browser has no `crypto.subtle`, so no seat key can be made, and nobody can trade.
- Measured: `/markets` never left its loading skeleton.
- It also defeats the Secure flag on the seat cookie, which is set only over HTTPS.
- It is fine for checking that a container boots and Traefik routes to it (§6.1, §6.5 over `http://`).

**HTTPS on sslip.io: possible, not dependable.**
- Put `https://web.<server-ip>.sslip.io` (and `ops.`, `room.`, `docs.`) as the domains; Traefik then asks Let's Encrypt over HTTP-01.
- `sslip.io` is not on the Public Suffix List (checked: PSL version `2026-10-01_23-02-52_UTC`). Let's Encrypt therefore counts every `*.sslip.io` certificate in the world against one registered domain.
- The base limit is 50 certificates per registered domain every 7 days (letsencrypt.org/docs/rate-limits). The sslip.io/nip.io page says Let's Encrypt has raised theirs to 250,000. That pool is shared with every other user.
- Coolify's own docs say: "Do not change it to `https://`: Let's Encrypt rate-limits the entire shared `sslip.io` zone, so certificate issuance fails."
- The limits that are ours alone: 5 certificates per exact set of names per 7 days, 5 failed validations per name per hour, and 300 new orders per account per 3 hours.
- So it may work on a given day and fail on the next. Four names (web, ops, room, docs) need four certificates. A mixed setup (web on HTTPS, ops on HTTP) breaks: the browser blocks the HTTP price stream as mixed content.
- Not run on the server; no domain-free URL is promised from it.

**The dependable path is a domain** (§1, §2). It costs one Namecheap record per host and works on the first deploy.
