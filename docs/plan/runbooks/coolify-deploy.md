# Runbook: the hosted deploy on Coolify

Abu's Coolify server, beside Agari's apps (which stay up). **No Cloudflare** (K-003): the domain is registered at Namecheap, its A records point straight at the server, and Coolify's Traefik is the only proxy. It ends TLS with Let's Encrypt.

Nothing in this runbook has been run yet. The first hosted deploy is a C4/M1 lane. Every probe below becomes an acceptance row when it runs. Never write a secret, a token or a party id into this file.

**Who does what.** Abu does the Namecheap records and anything that needs his Coolify login. The agent does the rest, if Abu gives it a Coolify API token for the session. Otherwise Abu clicks, following this page.

## 0. Before the first deploy: capacity (the 22 Sep lesson)

The server is a 2-vCPU VPS with a 38 GB disk. That disk filled on 22 Sep, and the full disk crash-looped Agari's database.

1. **Free disk.** Run `df -h /` and `docker system df` on the server. Record both.
2. **Budget.** Each Next.js image (web, docs) is about 1.5–2.5 GB with its build cache. Ops is about 1 GB. Postgres starts small. Keep at least **10 GB free** before any build.
   - If the budget does not fit beside Agari's apps, stop and ask Abu. He can add a volume or a second small server. That is his call, recorded as a decision.
3. **Prune.** Run `docker image prune -a --filter "until=72h"` and `docker builder prune --filter "until=72h"`.
   - This removes only unused images, never a running app's.
   - Coolify's own Docker cleanup (Server → Settings) can do this on a schedule.
4. **One build at a time.** Server → Settings → **Concurrent builds = 1**. Two Next builds at once on 2 vCPUs is the swap-and-stall case.
5. **Build memory.** `next build` wants about 3 GB. If the server has 4 GB of RAM or less, add 4 GB of swap once (`fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile`, plus the fstab line).

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

## 3. The apps (one Coolify project, e.g. "canton-pm")

Every app is from the Git repository (GitHub App or deploy key), branch `main`. For the judged URL, it is instead the `live` worktree's snapshot tag (plan, "Submission snapshot").

| App | Type / build | Base dir | Dockerfile | Ports exposed | Domains | Storage |
|---|---|---|---|---|---|---|
| `pm-db` | Coolify-managed **PostgreSQL** 16 | — | — | — (internal only) | none; do not make it public | Coolify volume |
| `pm-ops` | Application, **Dockerfile** | `/` | `/services/ops/Dockerfile` | `8080,8787` | `https://ops.<domain>:8080,https://room.<domain>:8787` | Persistent volume at `/data` (deck journal); **file mount** `/data/parties.json` |
| `pm-web` | Application, **Dockerfile** | `/` | `/web/Dockerfile` | `3000` | `https://<domain>` (and `https://www.<domain>`) | none |
| `pm-docs` | Application, **Dockerfile** | `/docs-site` | `/Dockerfile` | `3000` | `https://docs.<domain>` | none |

Settings that matter:

- **pm-ops runs exactly one container.** Every actor is a single writer (AD-4). Set no replicas. Turn off rolling updates if Coolify offers it for the app ("stop the old container before starting the new one"), because two copies overlapping for a minute would double-open Windows.
- **pm-ops: turn off Gzip compression** (Advanced → "Enable Gzip Compression" off). A compressing middleware can buffer an SSE stream (step 6).
- **pm-web health check:** path `/api/status`, or leave Coolify's default. The image has `curl`.
- **pm-ops health check:** the Dockerfile's own `HEALTHCHECK` is liveness only: any HTTP answer from `/health` counts. `/health` can report not-ok for a third-party feed (K-027), and restarting would not fix that.
- **Deploy order:** pm-db → pm-ops → pm-web → pm-docs. The web refuses to boot in production without ops' URL and secret (`instrumentation-node.ts`).
- **Private network.** Coolify puts a project's apps on its Docker network. Use the internal hostnames it shows under each app for `OPS_INTERNAL_URL`, `AGARI_WEB_ORIGIN` and `DATABASE_URL`, so these hops never leave the server. The public `https://ops.<domain>` also works for the web → ops call.

## 4. Environment per app (names only; values in Coolify, never in Git)

Full lists with defaults: `web/.env.example`, `services/ops/.env.example`, `docs-site/.env.example`. Mark every `NEXT_PUBLIC_*` in pm-web and pm-docs as a **Build Variable**, because Next inlines those at build time.

**Shared secrets.** Generate each once, with `openssl rand -hex 32`, and set the same value in both apps:

- `OPS_INTERNAL_SECRET`
- `ROOM_TOKEN_SECRET`
- `PUSH_DRAIN_SECRET`

**Ledger.**
- On DevNet: `LEDGER_AUTH_MODE=password` with the `LEDGER_OIDC_*` set, in **both** web and ops (K-035).
- Plan B, a hosted sandbox: `LEDGER_AUTH_MODE=none`.

**pm-db:** Coolify generates the credentials. Copy its internal connection URL into `DATABASE_URL` for web and ops.

**pm-ops:**

| Group | Names |
|---|---|
| Required | `DATABASE_URL`, `DRY_RUN=0`, `OPS_INTERNAL_SECRET`, `AGARI_PARTIES_FILE=/data/parties.json`, `LEDGER_JSON_API_URL`, `LEDGER_AUTH_MODE` (+ `LEDGER_OIDC_*`) |
| Reaching the web | `AGARI_WEB_ORIGIN` (the web's internal URL, `http://<pm-web internal host>:3000`), `NEXT_PUBLIC_APP_ORIGIN=https://<domain>` |
| Sources | `ALPACA_ENDPOINT`, `ALPACA_KEY_ID`, `ALPACA_SECRET_KEY`, `FINNHUB_API_KEY`, optional `PYTH_API_KEY`, `JUPITER_API_KEY` |
| Games, push, agents | `ROOM_TOKEN_SECRET`, `GAME_DECK_KEY`, `PUSH_DRAIN_URL=https://<domain>/api/push/drain`, `PUSH_DRAIN_SECRET`, optional `OPENAI_API_KEY`, `AI_MODEL`, `X_*` |
| Set by the image | `OPS_HTTP_PORT=8080`, `GAME_ROOM_HOST=0.0.0.0`, `GAME_ROOM_PORT=8787`, `GAME_DECK_JOURNAL=/data/deck-journal.jsonl` |

About the indexer URL in ops: `NEXT_PUBLIC_AGARI_INDEXER_URL` may be left unset. Ops resolves a relative or absent value against `AGARI_WEB_ORIGIN`, then `NEXT_PUBLIC_APP_ORIGIN` (C10a). An absolute value still wins. C9c and C9d each lost a duel re-snapshot to a relative value.

**pm-web:**

| Group | Names |
|---|---|
| Required at boot | `DATABASE_URL`, `AGARI_SEAT_COOKIE_SECRET`, `OPS_INTERNAL_URL` (ops' internal URL on `:8080`), `OPS_INTERNAL_SECRET`, `AGARI_PARTIES_FILE=/data/parties.json` (a file mount on pm-web too, or `AGARI_VENUE_PARTY` + `AGARI_SEAT_PARTIES`), `LEDGER_JSON_API_URL`, `LEDGER_AUTH_MODE` (+ `LEDGER_OIDC_*`) |
| Proxy | `TRUSTED_PROXY=forwarded` (the image's default; set it anyway so it is visible) |
| Build variables | `NEXT_PUBLIC_APP_ORIGIN=https://<domain>`, `NEXT_PUBLIC_SITE_URL=https://<domain>`, `NEXT_PUBLIC_DOCS_URL=https://docs.<domain>`, `NEXT_PUBLIC_PRICE_FEED_URL=https://ops.<domain>`, `NEXT_PUBLIC_LADDER_URL=https://ops.<domain>`, optional `NEXT_PUBLIC_CANTON_NETWORK`, `NEXT_PUBLIC_AGARI_VENUE_ID` |
| Features | `ROOM_TOKEN_SECRET`, `GAME_ROOM_PUBLIC_URL=wss://room.<domain>`, `PUSH_DRAIN_SECRET`, `EXPO_ACCESS_TOKEN`, `FINNHUB_API_KEY`, `AI_MODEL` + a provider key, `X_*` |

**pm-docs:** `NEXT_PUBLIC_DOCS_URL=https://docs.<domain>` and `NEXT_PUBLIC_APP_URL=https://<domain>`, both as build variables.

**Region hold.** The web build downloads DB-IP's IP-to-Country Lite table (about 4.5 MB, CC BY 4.0, credited on `/legal`) with `scripts/geo/fetch-dbip.mjs`. If that download fails, the build still succeeds and the boot log says `[region] no IP-to-country database`. Every visitor then reads as open until a rebuild. `AGARI_REGION_OVERRIDE=US` forces the held state for a test, and a redeploy without it clears it.

## 5. First deploy, in order

1. pm-db: create it and note its internal URL.
2. pm-ops: create the file mount `/data/parties.json` with the parties file for this network. The DevNet one comes from `devnet-r1.md`. It holds party ids, not secrets, but keep it out of Git anyway. Set the env, then deploy.
   - Watch the log for `boot: … live, actors …`, the env-file line, and the heartbeats.
3. pm-web: set the same file mount (or the party variables) and the env, then deploy.
   - The boot either passes the seat and ledger check or exits naming the missing variables (never their values).
4. pm-docs: deploy.
5. Record in `acceptance.md`: the image digests, the free disk after the builds (`df -h /`), and every probe below.

## 6. Probes after each deploy (each an acceptance row)

1. **Health.**
   - `curl -s https://ops.<domain>/health | head -c 400` shows every venue actor.
   - `https://<domain>/status` is green from outside. Check it from a phone on mobile data, not the server.
2. **Forwarded proto and host.** `curl -sI https://<domain>/api/x/start` should not redirect to `http://`.
   - The X OAuth start and the faucet's same-origin check both read `publicOrigin()`, which trusts `x-forwarded-proto` and `x-forwarded-host` only because `TRUSTED_PROXY=forwarded`.
3. **Forged `X-Forwarded-For`.** Does a visitor's own header reach the app?
   - Deploy the throwaway service `traefik/whoami` in Coolify (a one-click "Docker Image" app) on `https://whoami.<domain>`. It needs a temporary A record, or use the Coolify-generated sslip.io domain.
   - Run `curl -s -H 'X-Forwarded-For: 6.6.6.6' https://whoami.<domain> | grep -i x-forwarded-for`.
   - If the line reads only your real IP, Traefik stripped the forged value. If it reads `6.6.6.6, <your ip>`, Traefik appended to it.
   - **Either way the app is safe.** With `TRUSTED_PROXY=forwarded`, `clientIp()` takes the **last** entry, which is the one Traefik added (C10a). Record which of the two Traefik did, then delete the whoami app and its record.
   - If the line shows **no** real IP at all, stop: a second proxy sits in front. Change `TRUSTED_PROXY` only after knowing which proxy it is.
   - App-side confirmation:
     - Run `for i in $(seq 1 14); do curl -s -o /dev/null -w '%{http_code} ' -X POST -H "X-Forwarded-For: 10.0.0.$i" -H 'content-type: application/json' -d '{}' https://<domain>/api/seat; done`.
     - The last calls answer `429` (12 lease attempts a minute per address). A forged header must not reset the count.
     - This spends nothing: an empty body is refused before any lease.
4. **SSE through Traefik, unbuffered.** Run `curl -sN https://ops.<domain>/prices/stream | while read -r l; do printf '%s %s\n' "$(date +%T)" "${l:0:80}"; done`.
   - Events must print one by one, a few seconds apart, from the first second.
   - If nothing prints and then a burst arrives, something is buffering. Check that pm-ops' Gzip is off (step 3) and that no custom Traefik middleware is on the router.
   - Repeat for `https://ops.<domain>/ladders/stream`.
   - In the browser, the ticket's price ladder moves without a reload.
5. **Room WebSocket.** Test that `wss://room.<domain>` upgrades: `curl -si -H 'Connection: Upgrade' -H 'Upgrade: websocket' -H 'Sec-WebSocket-Version: 13' -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' https://room.<domain>/ | head -1`. Expect `101` or a room-level refusal, not a 404 from Traefik.
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
