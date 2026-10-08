# Contributing to Owarine Docs

This Fumadocs site lives at `docs-site/` inside the Owarine app repository. The app source it documents is the rest of the same checkout. Check the current source, `.github/verification/capabilities.json` and the acceptance records and historical evidence references in `.github/verification/` before changing product claims.

## Local work

Use Node.js 22+ and pnpm 11.24:

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
pnpm check
```

The docs app runs on port 3153. `NEXT_PUBLIC_DOCS_URL` sets canonical and sitemap URLs; its default is `https://docs.owarine.xyz`. `NEXT_PUBLIC_APP_URL` sets app links and defaults to `https://owarine.xyz`. Override these variables explicitly when previewing a local app.

`pnpm check` reads the app from the parent directory (`OWARINE_SOURCE_DIR` overrides it). The one pin is `revision` in `lib/site.ts`: the check fails if that commit is missing or not an ancestor of `HEAD`, and warns with the app commits made since it. When the app advances, read those commits, their code and acceptance evidence, update the affected guides, then advance `revision` (and `reviewed`). Do not advance the pin just to silence the warning.

## Update a guide

1. Edit `content/docs/**/*.mdx` and add new pages to their folder's `meta.json`.
2. Trace behavior to the application code, the Daml packages, `.github/verification/capabilities.json` and its evidence references. The [source map](content/docs/builders/source-map.mdx) is the starting inventory; verify the exact files for the page you change.
3. Keep a local-sandbox run, a DevNet run and a hosted deployment distinct, and paper desk practice apart from a live desk. `local` in the registry means a local-sandbox run with an evidence note; nothing is `live` until its DevNet acceptance row exists. A route or build is not proof of a run. Never name the previous chain's tokens, wallets or tools in copy: the copy invariant in `pnpm invariants` scans this whole folder.
4. Link docs pages with `/section/page` paths and app routes with `<AppLink href="/route">`. Run `pnpm check`, then inspect changed pages at desktop and phone sizes.
5. Capture the hosted DevNet product and record its route, date, seat state and actual outcome. Keep source pixels unchanged. Failed actions belong in the ignored evidence report; do not publish a staged success.

## Hosted captures and walkthroughs

Use an isolated browser for `https://owarine.xyz`. Do not capture localhost, fixture routes or mocked data. Guest DevNet seats and a few test-credit actions are allowed; never type a password, private key or token. Stop X setup at the sign-in boundary. Product recordings and local docs previews are separate.

`node scripts/record-walkthrough.mjs --serve` starts the isolated Chromium recorder and a loopback control bridge. Its `Recorder` methods record real actions, measured control boxes, cursor paths and timestamped lossless PNGs at 1600×1000 CSS pixels and 2× density. Raw recordings live in ignored `evidence/raw-video/<name>/`; raw screenshots live in `evidence/raw-captures/`. Stop the recorder process after use so its browser closes.

For screenshots, maintain `evidence/raw-captures/catalog.json` with each capture's name, raw PNG stem, hosted origin, title, alt text, state, capture date and measured annotations. Run:

```sh
node scripts/publish-captures.mjs
```

This copies unchanged PNGs to `public/captures/`, generates `lib/captures.ts` and writes `provenance-devnet-2026-10.json` with dimensions, density and SHA-256. `<GuideCapture name="…" />` supplies the numbered overlay, full-size view and dated state.

For videos, add `chapters.json` beside the raw manifests. Each chapter names its source-second time, title, two or three short panel lines, caption text and recorded action index. `targetStart` and `targetEnd` restrict arrows to frames where the control is actually visible. Use `annotation: false` for a transition with no visible target. Inspect source frames around loading, scrolling, menus and request states; a measured box alone does not prove the target is unobscured.

```sh
node scripts/render-walkthroughs.mjs --input evidence/raw-video/<name> --chapters evidence/raw-video/<name>/chapters.json
```

The renderer writes a 2560×1440, constant-60-fps H.264 High MP4, WebVTT, provenance JSON and poster. It draws arrows and other overlays separately from the source. Normal speed is the default. Only declared ×4 waits are allowed, with a visible badge and caption disclosure. Declare any retained source segments and their omission reasons; identify the result as an edited excerpt. Keep each output between 20 and 60 seconds.

Inspect the encoded output, its populated poster and the target at chapter transitions. Record what was reviewed and each final file's SHA-256 in ignored `evidence/media-review.md`; distinguish sampled-frame checks from continuous playback. The generated registry exposes completed recordings through `<Walkthrough name="…" />`, with keyboard chapters, default captions, transcript and downloads. No autoplay is used. Run `pnpm check` after the final render; it verifies media hashes, dimensions, encoding, timing, registry references and provenance as well as docs links and types.

## Deployment

The docs deploy to Coolify as `pm-docs` (see `Dockerfile`), built by `docs-site/Dockerfile` and served at `https://docs.owarine.xyz`. After a deploy, verify the root, a nested guide, search, captures, theme and sitemap at that URL.
