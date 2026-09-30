# Contributing to Agari Docs

This Fumadocs site lives at `docs-site/` inside the Agari app repository. The app source it documents is the rest of the same checkout. Check the current source, `docs/plan/capabilities.json` and the evidence notes in `docs/evidence/` before changing product claims.

## Local work

Use Node.js 22+ and pnpm 11.24:

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
pnpm check
```

The docs app runs on port 3153. `NEXT_PUBLIC_DOCS_URL` sets canonical and sitemap URLs and `NEXT_PUBLIC_APP_URL` sets app links; both default to local servers (`http://localhost:3153`, `http://localhost:3000`) until a deploy sets `https://docs.<domain>` and `https://<domain>` as build variables.

`pnpm check` reads the app from the parent directory (`AGARI_SOURCE_DIR` overrides it). The one pin is `revision` in `lib/site.ts`: the check fails if that commit is missing or not an ancestor of `HEAD`, and warns with the app commits made since it. When the app advances, read those commits, their code and acceptance evidence, update the affected guides, then advance `revision` (and `reviewed`). Do not advance the pin just to silence the warning.

## Update a guide

1. Edit `content/docs/**/*.mdx` and add new pages to their folder's `meta.json`.
2. Trace behavior to the application code, the Daml packages, `docs/plan/capabilities.json` and the evidence notes. The [source map](content/docs/builders/source-map.mdx) is the starting inventory; verify the exact files for the page you change.
3. Keep a local-sandbox run, a DevNet run and a hosted deployment distinct, and paper desk practice apart from a live desk. `local` in the registry means a local-sandbox run with an evidence note; nothing is `live` until its DevNet acceptance row exists. A route or build is not proof of a run. Never name the previous chain's tokens, wallets or tools in copy: the copy invariant in `pnpm invariants` scans this whole folder.
4. Link docs pages with `/section/page` paths and app routes with `<AppLink href="/route">`. Run `pnpm check`, then inspect changed pages at desktop and phone sizes.
5. Record any new screenshot in a `public/captures/provenance-*.json` manifest (the Canton one is `provenance-canton-2026-09-30.json`): source file, route, crop, date, seat and network state, and what was actually exercised. Create and credit original Agari media.

The `GuideCapture` component expands a capture and states its condition and date. `TourVideo` and `ConnectedWalkthrough` provide captions, chapters and a transcript; their current clips were recorded on the build before the Canton port, so no guide embeds them. A recording of a call on the Canton build still needs its own capture and its ledger update ids; do not label an older clip as one.

## Deployment

The docs deploy to Coolify as `pm-docs` (`docs/plan/runbooks/coolify-deploy.md`), built by `docs-site/Dockerfile` and served at `https://docs.<domain>` once the domain exists. After a deploy, verify the root, a nested guide, search, captures, theme and sitemap at that URL.
