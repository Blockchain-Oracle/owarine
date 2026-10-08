# Owarine Docs

Step-by-step guides for Owarine on **Canton Network**: taking a seat, demo-credit Up/Down calls, tickets, strategies, the desk and games, and the architecture behind each path. It explains the product with screens of the Canton build, the Daml packages, the price paths and dated evidence.

**Evidence updated:** 8 October 2026. Fresh hosted captures and walkthroughs show the current shell, guest leasing, test CC mint/deposit, a BTC call through payout, proof and navigation. The broader review pin in `lib/site.ts` is retained; this pass does not claim that every intervening app change or hosted journey was accepted. See [Availability](content/docs/help/availability.mdx) for dated results and limits. The app is at `https://owarine.xyz`; docs deployment is a separate step.

The public [capability inventory](../.github/verification/capabilities.json) and [acceptance records](../.github/verification/acceptance.md) replace links into local planning folders. Hosted capture provenance records original PNG hashes, routes, capture times and pixel density. Historical acceptance references resolve immutable Git objects, so clone with full history.
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
| See how attested prints are made | [PreStocks and Pyth in Owarine](content/docs/architecture/prestocks-and-pyth.mdx) |
| Check prerequisites and open limitations | [Availability](content/docs/help/availability.mdx) |

Screenshots and recordings must come from the hosted DevNet product. The capture registry records their route, state and provenance; failed actions belong in the local evidence report, not in an invented success scene.

Seven theme-aware Mermaid diagrams cover system context, a trade, a seat, boundary resolution, visibility, X execution and deployment. Their pages name source files and distinguish implemented paths from hosted acceptance. Three downloadable SVG diagrams are generated from [architecture data](lib/architecture.json) with `node scripts/export-architecture.mjs`.

## Run locally

Use Node.js 22+ and `pnpm@11.24.0`:

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

Open [localhost:3153](http://localhost:3153). The docs render without a running app, seat, database or provider key. `NEXT_PUBLIC_APP_URL` sets where app links go; the default is `https://owarine.xyz`. `NEXT_PUBLIC_DOCS_URL` defaults to `https://docs.owarine.xyz`. Override them explicitly for a local app preview (see [Run Owarine locally](content/docs/builders/local-setup.mdx)).

```sh
pnpm check
```

`check` validates the docs links, navigation, media and app routes against the app source in the parent directory, then typechecks and builds. It fails if the reviewed revision (`site.revision` in `lib/site.ts`) is missing or not an ancestor of `HEAD`, and prints a warning listing app commits made since it. Those commits are the list to review: update the guides they affect, then advance the revision. [Contributing](CONTRIBUTING.md) explains the capture and review workflow. The repository's copy invariant (`pnpm invariants` at the root) also scans every page, string, diagram and caption here for the previous chain's words.

## Evidence and limits

Calls, tickets and games use **demo credits** with no cash value. The recorded guest flow shows no separate user network fee. Recorded states come from `.github/verification/capabilities.json` and its immutable historical evidence references. `local` means a dated local-sandbox run; `live` means a recorded DevNet run, not present service availability. The first-call and Canton Coin DevNet records are in `.github/verification/acceptance.md`. A practice desk moves no money. This pass does not establish a funded desk trade. Pyth valuation indices require an entitled key; the hosted status reported entitlement failures for OPENAI and ANTHROPIC during this review. Current feed and service health belongs to the app's Status page, not to this dated snapshot.
