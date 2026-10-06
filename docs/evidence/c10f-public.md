# C10f — the public story: landing, pitch, download, demo, sponsors, how it works, docs (2026-10-06)

Lane C10f (`slice/C10f-public`, from main `5e0d81c`). K-block K-250–K-259 (used K-250–K-256). No Canton sandbox in this lane: every public page was checked with **no ledger, no ops and no index behind it** (web `next dev` on :3150, docs `next start` on :3151, both my own processes, stopped afterwards), so what is shown below is the honest state a judge sees before DevNet.

## What changed, by parity row

| Row | What a visitor sees now | Evidence |
|---|---|---|
| L-11 `/` | Hero re-pointed to private calls ("Call the move. Keep it private."). New **01 Your position stays yours**: the problem (cited trackers), who it is for (desk traders; the licensed dealer as operator; not-for), why Canton (two-signatory Leg, outsider query empty). New **07 From sandbox to MainNet**: roadmap Now / Next (DevNet) / After the hackathon (MainNet: own validator, Foundation approval, sponsoring SV), first users, who pays, October targets labelled as targets. Built-on band (C-S25) and lanes' unreachable state below. Cover section unchanged (the reference's example card). | `ux/c10f/landing-{390,768,1440}-{light,dark}.jpg`; `web/src/features/landing/{story-copy.ts,LandingWhy.tsx,LandingNext.tsx}` |
| L-14 `/pitch` | 17 slides in the order a judge asks: cover, problem, ICP, answer, why Canton, engine (prior work disclosed), proof (labelled a driver run), usage (live from the venue; third figure a labelled interview target), GTM, revenue (fee curve, spread, operator licence), onboarding, mobile, agents, X, team, roadmap (MainNet the post-hackathon step), close. No slide says LIVE. | `ux/c10f/pitch-01-cover-*`, `pitch-{02,03,04,05,08,09,10,16}-*`; `web/src/features/pitch/{copy-story.ts,slides-c.tsx}` |
| L-18 `/download` | Each native card names what it waits on; with the config set it becomes the reference's card (QR drawn in the page, button, SHA-256 row). Stage: the film if configured, else a dated Canton capture in the reference's phone frame. The pre-Canton launch film, poster and APK QR are deleted. | `ux/c10f/download-*`, `ux/c10f/dev-release-*` (both states); `web/src/lib/release.ts` + `release.test.ts` (4 tests) |
| L-13 `/demo` | The film frame says it waits on the film re-shot on the Canton build (config point). The four pre-Canton screenshots are replaced by crops of Canton evidence captures; section 03 is "Who can see this". | `ux/c10f/demo-*`; `web/public/demo/*-canton.jpg` (sources: docs-site captures provenance, `ux/c4b/08-view-outsider-1440-dark.png`) |
| C-S25 | Band row "Built on" (Canton Network, Noders, BitSafe, each its own mark, what it does today), then the live print mix under "Prices from". Per-price source line names the attested source and "signed on Canton". Footer carries Canton's attribution line. Docs page `architecture/built-on`. | `ux/c10f/landing-*`, `docs-built-on-1440-*`; `source-label.test.ts` (11 tests); `THIRD_PARTY_NOTICES.md` "Sponsor marks" |
| C-ADD-11 | `/who-sees-what`: contract × party tables with T where Test.Privacy asserts, the other packages in sentences, five limits, three runnable commands. Trust-boundary half was already on /proof. | `ux/c10f/who-sees-what-*`; `web/src/features/privacy-matrix/` |
| L-12, C-N34 | How It Works gains "The Leg and Who Sees It" and "Built On", web and a literal React Native port; fee words corrected to the Daml. | `ux/c10f/how-it-works-*`; `mobile/src/features/how-it-works/SectionsC.tsx`; mobile typecheck and `expo export --platform ios` green (5,572 modules, the three sponsor marks bundled) |
| L-23, Y-14 | Every preview reads "Built on Canton Network · test network · demo credits"; site card takes the new headline. | `ux/c10f/og-site.png`, `og-ticker-tsla.png`, `og-window-unindexed.png` |
| L-20, C-DOC-01, Y-06 | Docs: 43 pages (42 + built-on), `check-content` 0 failures at `site.revision` ecf948f; build green (94 static pages); `/llms.txt` (44 entries), `/llms-full.txt`, `/raw/*`, `/api/search`, `/sitemap.xml`, `/opengraph-image` all 200. `/docs` in the app still redirects to the docs site (Y-06). | commit `be348ac` |

## Found broken and fixed

1. **Listed stocks and crypto had no per-price source line on Canton.** `listedLabel` matched only `pyth`/`redstone`, and every Canton print is `attested`. `EventMarket` now carries the policy text (`printSourceText`) and the line names what the oracle parties read.
2. **How It Works described the reference's fee.** It said the fee was "a skim on winning contracts at redemption" and a win paid "1 credit less the settlement fee". `Leg.daml`: the fee is escrowed at the fill, kept only at a non-void settle, refunded on a void; the winner gets the full quantity. Steps, quote fields, fee cards, settlement, FAQ and example corrected.
3. **The landing's lane cards said "Reading the session…" for ever** with no ops. The unreachable copy existed but was never shown; `useSessionAnswered` wires it.
4. **The pitch claimed LIVE** for the seat, key, Sensei and "all four" edge cells (capabilities: not-live), "native builds are blocked until native source exists" (the app is ported), and a roadmap whose NEXT items are built. All re-stated.
5. **/download and /demo showed pre-Canton footage** (the launch film; screenshots with a "Solana devnet" banner). Removed.
6. **Docs pages behind the app**: four packages (now five plus governance), Lucky "never placed" (placed, `ux/c8j`), creator fees "no screen claims" (claimed, C8i.1), the welcome map's "Separate mainnet live step".

## Not done, and why

- **No TestFlight link, APK or Canton film exists**, so `/download` and `/demo` show their waiting state. They flip by setting `AGARI_TESTFLIGHT_URL`, `AGARI_ANDROID_APK_URL` + `AGARI_ANDROID_APK_SHA256`, `AGARI_DEMO_VIDEO_URL` on the web server and restarting. `web/.env.example` is owner-only: **the owner should add these four names**.
- **The rest of the app still uses the "settlement fee" model** (verdict "net of the settlement fee", share card, `/surface` slippage, Lucky "before the settlement fee", `packages/core/src/claims/payout.ts`). If the venue's fee bps is read and deducted from a payout, displayed returns are understated on Canton. Outside this lane's surfaces; flagged for the ticket/verdict owner.
- **Live figures** (Built-on counts, settled Windows, usage slide) read "not answering" here by design: no index ran in this lane.
- **The phone's How It Works** is typechecked and exported, never run on a device (C11 never runs on a simulator in this repo). `expo-image` renders BitSafe's supplied SVG, which has no `viewBox`; how it scales on a device is unverified.
- **Asset marks** (Tesla, Nvidia, Apple and the other ticker discs, a reference-authority surface) are outside K-250; see its last line.

## Checks run

- Fast gate at `c326717`: `pnpm typecheck` green (all projects, web and mobile included); `pnpm invariants` 0 errors, 0 warnings. Vitest on the touched paths (`web/src/lib`, landing, price-source, how-it-works, install, demo, pitch, `packages/markets/src/provider`, `packages/core/src`): 107 files, 1,220 tests passed, 17 skipped.
- Phone: `pnpm --filter @agari/mobile typecheck` green; `expo export --platform ios` (Node 25.9.0, `EXPO_OFFLINE=1`, output in the scratchpad, deleted) green, 5,572 modules.
- Docs: `node scripts/check-content.mjs` 43 pages, 0 failures; `pnpm typecheck` and `pnpm build` green.
- `21st review` on the 39 changed `.tsx`/`.css` files: 45 info findings, all `design-hardcoded-color` on pre-existing lines of `web/src/styles/shell.css` and `docs-site/app/global.css`; none on lines this lane wrote; nothing to fix.
- Every changed route at 390, 768 and 1440 in light and dark, full page, `scrollWidth − innerWidth = 0` on all 30 captures (headless Chrome via playwright-core from the scratchpad, reduced motion). The only console errors were Next dev's own `Performance.measure` warning on two `/download` loads (dev-only).

## Decisions

### K-250 — Third-party marks: a logo only where the brand's own published kit allows it
- **Date / owner:** 2026-10-06 · C10f lane
- **Evidence:** [Canton brand kit and trademark use](https://www.canton.network/brand-kit-trademark-use) (logos for download; may not be modified, recoloured or combined with other marks; attribution line asked for); [Noders brand assets](https://noders.team/brandkit); [BitSafe brand kit](https://bitsafe.finance/brand-kit) ("for partner listings, editorial use, and ecosystem integrations. Use the files exactly as supplied."); no written permission for any other mark in `docs/plan` (STATUS "Known gaps").
- **Rule:** Canton Network, Noders and BitSafe are drawn from their kits' own files (light- and dark-ground variants, switched by theme, never recoloured, each alone in its cell) on the landing band, How It Works (web and phone) and the docs `built-on` page. The site footer and the docs page carry Canton's attribution line. Every other third party (Coinbase, Kraken, Bitstamp, RedStone, Alpaca, Jupiter Price v3, PreStocks, AppsFactory) is plain text everywhere, web and phone; no PreStocks mark is drawn (already true since C10d/C10e; STATUS's "Known gaps" line about PreStocks marks is now stale). Ticker asset discs (company logos as instrument identifiers) are a reference-authority surface and are not changed by this decision.
- **User-visible:** three sponsor logos and an attribution line; all other sources by name.
- **Approval:** default; overrulable.

### K-251 — One runtime config point for the TestFlight link, the APK and the demo film
- **Date / owner:** 2026-10-06 · C10f lane
- **Evidence:** `web/src/lib/release.ts`, `release.test.ts`; `/dev/release`.
- **Rule:** `/download` and `/demo` read `AGARI_TESTFLIGHT_URL`, `AGARI_ANDROID_APK_URL`, `AGARI_ANDROID_APK_SHA256`, optional `AGARI_ANDROID_APK_VERSION` and `AGARI_DEMO_VIDEO_URL` on the server per request (`connection()`), so a value and a restart flip them with no rebuild. Not `NEXT_PUBLIC_*`, not secret. Only `testflight.apple.com/join/…` links count; an APK needs an https `.apk` URL and a 64-hex SHA-256 or it is not offered; the film is a YouTube link (embedded via youtube-nocookie) or an https `.mp4`/`.webm`. Anything malformed counts as unset.
- **User-visible:** each card names what it waits on until its value is set.
- **Approval:** default; overrulable.

### K-252 — No footage or screenshot from before the Canton port on a public page
- **Date / owner:** 2026-10-06 · C10f lane
- **Evidence:** deleted `web/public/media/agari-launch.{mp4,-poster.jpg}`, `web/public/demo/{markets,reel,sensei,bet-screen}.png`, `web/public/download/agari-android-qr.svg`; `features/demo/DemoFilm.tsx`.
- **Rule:** until the Canton film exists, `/demo` shows its waiting frame and `/download` a dated Canton capture. Screenshots are crops of `docs/evidence/ux` Canton captures, captioned with their date. `/demo` section 03 shows "Who can see this" (no Canton capture of the Room or Sensei exists); both stay linked.
- **User-visible:** no pre-port video; Canton frames only.
- **Approval:** default; overrulable.

### K-253 — The public story follows the B1 drafts; traction only from the venue projection or labelled as a target
- **Date / owner:** 2026-10-06 · C10f lane
- **Evidence:** `docs/business/{brief,gtm,metrics}.md`, `materials/01`–`06`; `features/landing/story-copy.ts`, `features/pitch/copy-story.ts`.
- **Rule:** positioning is "a private event-risk desk", for desk traders, with a licensed dealer as operator. Live counts come from the venue projection only; the C3 run's figures are labelled a driver run on a local sandbox, not users; interview and usability numbers appear only as October targets; status words follow `capabilities.json` (LOCAL SANDBOX, never LIVE before a DevNet row); MainNet is the post-hackathon step. The pitch is ordered problem → ICP → answer → why Canton → work → evidence → GTM → money.
- **User-visible:** landing sections 01 and 07; the reordered 17-slide deck.
- **Approval:** default; overrulable.

### K-254 — The privacy matrix is a web page; the phone carries its summary
- **Date / owner:** 2026-10-06 · C10f lane
- **Evidence:** `/who-sees-what`; `features/privacy-matrix/matrix.ts`; plan C1 "privacy-matrix and trust-statement surfaces stay web-only".
- **Rule:** the full matrix with commands lives at `/who-sees-what`, linked from the landing, `/demo`, How It Works and the docs. The phone's How It Works shows the five-line summary from the same module, without the link.
- **User-visible:** a new web route; a summary card on the phone.
- **Approval:** default; overrulable.

### K-255 — An attested price line says where it was signed
- **Date / owner:** 2026-10-06 · C10f lane
- **Evidence:** `features/markets/price-source/source-label.ts` + tests.
- **Rule:** a Window's line reads "Settles on <source> · <pair or token> · signed on Canton" from its policy text; a committee attestation or unreadable text yields no line. Pre-IPO and basket lines say "signed on Canton" and no longer show the PreStocks token mint, which lives on another network.
- **User-visible:** the hero and hub source captions.
- **Approval:** default; overrulable.

### K-256 — How It Works states the fee the Daml charges
- **Date / owner:** 2026-10-06 · C10f lane
- **Evidence:** `daml/abu-pm-main/daml/PM/Leg.daml` (payout table, `refundAfter`); `docs/business/gtm.md` "Economic flows".
- **Rule:** the fee is charged with the fill and held in the leg, kept only at a non-void settle, returned on a void; a win pays the full 1.00 per contract; the stale refund after the refund time is named. Other surfaces that still compute "net of the settlement fee" are listed under "Not done" for their owner.
- **User-visible:** How It Works steps, fees, settlement, FAQ, example.
- **Approval:** default; overrulable.
