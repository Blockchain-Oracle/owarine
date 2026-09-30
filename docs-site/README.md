# Agari Docs

Step-by-step guides for Agari on **Canton Network**: taking a seat, demo-credit Up/Down calls, tickets, Earn, strategies, the desk and games, and the architecture behind each path. It explains the product with screens of the Canton build, the Daml packages, the price paths and dated evidence.

**Source reviewed:** the Canton build at app commit `a4d2e2d` on 30 September 2026. The site lives in the app's own repository at `docs-site/`. Everything the guides describe runs on a **local Canton sandbox**; nothing is on Canton DevNet or a hosted URL yet, and the guides say so where it matters. The screens come from the local-sandbox evidence in `docs/evidence/ux/`.

## Start with the right guide

| Goal | Guide |
| --- | --- |
| Make a demo-credit call | [Quickstart](content/docs/start/quickstart.mdx) |
| Understand a seat and its demo credits | [Your seat](content/docs/start/wallet.mdx) |
| Understand the five PreStocks groups | [Baskets](content/docs/trading/baskets.mdx) |
| Draft a practice desk | [Build a desk](content/docs/agents/desk.mdx) |
| Read your balance, positions and receipts | [Portfolio](content/docs/trading/portfolio.mdx) |
| See the Daml packages and what they enforce | [The Daml packages](content/docs/architecture/programs.mdx) |
| Read the drawn architecture | [Venue](content/docs/architecture/overview.mdx), [Desk](content/docs/architecture/desk.mdx), [Price paths](content/docs/architecture/price-sources.mdx) |
| Audit a settled print | [Proof](content/docs/trading/proof.mdx) |
| Trace claims to code and proof | [Source map](content/docs/builders/source-map.mdx) |
| See how attested prints are made | [PreStocks and Pyth in Agari](content/docs/architecture/prestocks-and-pyth.mdx) |
| Check prerequisites and open limitations | [Availability](content/docs/help/availability.mdx) |

The guides' screenshots are cropped from the lanes' own local-sandbox screenshots; the [Canton capture manifest](public/captures/provenance-canton-2026-09-30.json) names each file's source, route and crop. Earlier captures and three walkthrough recordings of the build before the Canton port remain in `public/captures/` and `public/videos/` with their own manifests; no guide embeds them, because they show that build's screens.

The three diagrams are rendered from [Agari architecture data](lib/architecture.json) with `node scripts/export-architecture.mjs`; the live diagrams also expose each stage's authority boundary.

## Run locally

Use Node.js 22+ and `pnpm@11.24.0`:

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

Open [localhost:3153](http://localhost:3153). The docs render without a running app, seat, database or provider key. `NEXT_PUBLIC_APP_URL` sets where app links go; the default is the local web app at `http://localhost:3000` (run it from the repository root, see [Run Agari locally](content/docs/builders/local-setup.mdx)).

```sh
pnpm check
```

`check` validates the docs links, navigation, media and app routes against the app source in the parent directory, then typechecks and builds. It fails if the reviewed revision (`site.revision` in `lib/site.ts`) is missing or not an ancestor of `HEAD`, and prints a warning listing app commits made since it. Those commits are the list to review: update the guides they affect, then advance the revision. [Contributing](CONTRIBUTING.md) explains the capture and review workflow. The repository's copy invariant (`pnpm invariants` at the root) also scans every page, string, diagram and caption here for the previous chain's words.

## Evidence and limits

Calls, tickets and games use **demo credits** with no cash value; Canton charges no network fee. Each state a guide gives comes from `docs/plan/capabilities.json` and the evidence notes in `docs/evidence/`: `local` means proven end to end on a local Canton sandbox with the real venue operations, and no capability is `live` yet. A practice desk moves no money, and a live desk has been opened but has not traded. Pyth is not used: there is no entitled key, so the valuation lanes are not listed. Current feed and service health belongs to the app's Status page, not to this dated snapshot.
