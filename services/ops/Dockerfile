# The ops service — one long-running Node process (AD-8): the Canton venue (roller, oracle feeders, resolver, pricer,
# issuer, settler, sweeper), the projector, the duel room, the matchmaker and the keepers. Built from the repo root.
#   build:   install the workspace, bundle the service's own TypeScript (it and every @owarine package, plus the
#            generated Daml bindings) to JavaScript once (scripts/build.mjs), then `pnpm deploy` a production install.
#   runtime: the bundle, config/, the reply-card fonts and production node_modules, run by `node` as one process — it
#            was pnpm → sh → tsx → node, compiling TypeScript at runtime. The heap is capped under the container's limit.
#
#   docker build -f services/ops/Dockerfile .
#
# One instance only, ever: every actor is a single writer (AD-4), and two copies would double-open Windows and
# double-settle. On Coolify: one container, no replicas, no rolling overlap (docs/plan/runbooks/coolify-deploy.md).
FROM node:22-slim AS build
ENV NODE_ENV=production \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=1
RUN corepack enable && corepack prepare pnpm@11.24.0 --activate

WORKDIR /app

# Every workspace member's manifest, so the lockfile's importer set matches and the install layer is cached until a
# dependency changes. The Daml bindings' generated packages are linked by `@owarine/daml`, so they come first too.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY web/package.json ./web/
COPY mobile/package.json ./mobile/
COPY scripts/package.json ./scripts/
COPY packages/brain/package.json ./packages/brain/
COPY packages/core/package.json ./packages/core/
COPY packages/daml-clients/package.json ./packages/daml-clients/
COPY packages/daml-clients/generated ./packages/daml-clients/generated
COPY packages/db/package.json ./packages/db/
COPY packages/ledger/package.json ./packages/ledger/
COPY packages/markets/package.json ./packages/markets/
COPY services/ops/package.json ./services/ops/
# pnpm's registry metadata cache (~/.cache/pnpm) is a cache mount too, not 241 MB of registry JSON in the layer (C4e).
RUN --mount=type=cache,id=owarine-pnpm-store,target=/pnpm/store \
    --mount=type=cache,id=owarine-pnpm-metadata,target=/root/.cache/pnpm \
    pnpm install --frozen-lockfile --filter "@owarine/ops..."

# The sources the service runs: its own (with config/) and the packages it imports.
COPY packages/brain ./packages/brain
COPY packages/core ./packages/core
COPY packages/daml-clients ./packages/daml-clients
COPY packages/db ./packages/db
COPY packages/ledger ./packages/ledger
COPY packages/markets ./packages/markets
COPY services/ops ./services/ops

RUN pnpm --filter @owarine/ops build \
    && pnpm --filter @owarine/ops deploy --prod --legacy --config.node-linker=hoisted /out

FROM node:22-slim
ENV NODE_ENV=production
# curl is what Coolify's container health check runs; node:22-slim ships none, and without it a green build is
# rolled back as "unhealthy".
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app/services/ops
COPY --from=build /out/package.json ./package.json
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /out/dist ./dist
COPY --from=build /out/config ./config
COPY --from=build /out/src/actors/x-relay/reply-card-assets ./src/actors/x-relay/reply-card-assets

# Two listeners, one per Coolify domain: ops HTTP (/health, price and ladder SSE, /internal/* for the web) on 8080 and
# the duel room's WebSocket on 8787. The deck journal and the parties file live on the mounted volume (/data).
ENV OPS_HTTP_PORT=8080 \
    GAME_ROOM_HOST=0.0.0.0 \
    GAME_ROOM_PORT=8787 \
    GAME_DECK_JOURNAL=/data/deck-journal.jsonl
EXPOSE 8080 8787
# Liveness only: any HTTP answer from /health counts. Its body can read not-ok for a third-party feed (K-027), and a
# restart would not fix that; a process that stopped answering is what Coolify should restart.
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 CMD curl -s -o /dev/null http://127.0.0.1:8080/health || exit 1
# The heap is capped under the container's memory limit (Node does not read it): a leak restarts ops instead of
# swapping the whole server (16 Oct: ~2 GB and growing on the 8 GB host).
CMD ["node", "--max-old-space-size=1024", "dist/bundle/main.mjs"]
