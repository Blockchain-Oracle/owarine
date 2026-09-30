# C13a: assistant and community on Canton (evidence)

Date: 2026-09-30 · lane C13a (`slice/C13a-community`, from main `afc7b3b`, main `5cf2dff` merged) · decisions K-140 to K-145

## What each surface was on Canton, and what it is now

| Surface | Before C13a | Now | Where |
|---|---|---|---|
| A seat's own history (`/api/index/wallet/<address>/*`: Portfolio, Trader Edge, badges, CSV, Sensei's streak) | Fills, exits, positions and quotes matched `owner_address`, which the projector never writes, so they came back empty. Only receipts were lease-scoped | Every wallet read runs under the caller's lease: the leased party's rows from the lease's start offset. A position the previous visitor also traded is withheld, never merged. An address with no lease reads nothing (K-140) | `packages/db/src/idx/read.ts` (`seatRowsOf`), `web/src/app/api/index/[...path]/queries.ts` |
| `/u/<address>` for anyone else | Broken: every seat read answered 403, so Record, Edge and Open calls showed "couldn't be read" | Reads only that seat's opt-in publications: `/api/index/published/<address>/{fills,receipts}`, replayed by the same history code. An open published call is marked only where the venue shows a price (k ≥ 5); below that, value = stake and no P&L. The copy says which record is shown | `packages/db/src/idx/read-published.ts`, `packages/markets/src/provider/published.ts`, `web` and `mobile` `features/profile` |
| Activity inbox (`/api/activity`, LifecycleWatcher, `/activity`) | Publications only, even for the seat itself, so a seat that never published got no verdicts | The seat itself (web cookie or the phone's signed read header) reads its own fills and verdicts under its lease, published or not. Anyone else reads publications only | `packages/db/src/idx/seat-activity.ts`, `web/src/app/api/activity/route.ts`, `web/src/features/activity/useActivity.ts` |
| `/api/sentiment` | Live over publications with the k = 5 floor (C5). The privacy note existed only in comments | Unchanged reading. The crowd cell carries the privacy note on hover (web `title`; read aloud on the phone) | `web/src/components/shell/{useMarqueeItems.ts,Marquee.tsx}`, `mobile/src/components/shell/Marquee.tsx`, `web/src/features/news/copy.ts` |
| Takes | Live: seat-key signature, and the "backed" badge from the author's own publications | Unchanged (verified) | `web/src/app/api/takes/route.ts` |
| Reels | Live over lanes and takes. Holdings stubbed until C7b | Unchanged. Its desk card now needs the seat's proof (below) | — |
| Leaderboards | Live over publications (C5) | Unchanged | — |
| Achievements | Keyed by the visitor's address. The duel projector maps party to the leasing address at projection time | Unchanged (verified visitor-specific) | `web/src/features/games/achievements.server.ts` |
| Share cards, OG images, `/news`, alerts | Canvas drawn in the browser; the index row, Finnhub, and local rules | Unchanged | — |
| Sensei and the Brake | Data already from the seat: positions from `/api/ledger/me`, history from the index (now lease-scoped). The desk card was the exception: `/api/desk/<owner>?viewer=` gave the owner view (private notes, live mandate) to any typed address | Desk reads need the seat's proof (`provenViewer`, K-142). Copy says "seat" and "demo credits". The Brake's line and the pace cue diff clean against the reference, and a test now pins the line | `web/src/features/desk/auth.server.ts`, the four desk read routes, `web/src/features/sensei/*` |
| X bind, receipts, status | Keyed by the seat address (the visitor's own key), signed by the seat key | Unchanged (verified). The forwarded X session header is new (below) | `web/src/app/api/x/*` |
| X relay | Places through `AgentGrant` (C8f). Its public replies said "Solana devnet", "reverted on-chain", "network fee may still have been spent", and linked a relative `/proof` path | Placement unchanged (verified chain below). Replies name the Canton network, link `<site>/proof?update=…`, and a rejection reads "The ledger rejected the trade. Nothing was booked and no fee was taken." (K-144) | `services/ops/src/actors/x-relay/*` |
| X grammar (`<btc|eth>`) | Parsed; no test that routing is correct; "credits" after a stake was refused | Accepts "credit(s)"; a BTC mention is tested to take its 24/7 lane, never Regular | `packages/core/src/x/parse.ts`, `window.test.ts` |
| Blinks | GET card with `X-Blockchain-Ids: solana:…`; every POST refused `not-deployed` | Same URLs and card (Up and Down, each with an amount field) as `external-link` actions. The POST answers a signed Window share link to the ticket (web, or the app through the same https path). No chain id. The three `no-solana-copy` allowlist lines are gone (K-141) | `packages/core/src/x/{actions,share-link}.ts`, `packages/markets/src/x/action-order.ts`, `web/src/app/{actions.json,api/actions,api/share,markets/[id],.well-known}`, `mobile/src/app/(tabs)/markets/[id].tsx` |
| Desk timing prompt | "PreStocks tokens on Solana", USDC and tokens | `desk-timing.v2`: the Canton desk (K-090, K-091) with the same answers, priorities and rules for when. The allowlist line is gone (K-143) | `packages/core/src/desk/prompt.ts` |
| `/native-auth` | The reference's blocked plate | The web half is built: the X gate accepts the app's forwarded session header, and the handoff's decisions are written and tested. The page and the app's pill wait on C11a's `APP_LINK_SCHEME` (below; K-145) | `web/src/features/x/{gate.server,native-handoff,session.server}.ts`, `packages/core/src/x/link.ts` |

The `no-solana-copy` allowlist is now empty.

## The X relay places through `AgentGrant` (verified, not redone)

`services/ops/src/actors/x-relay/index.ts:48` builds the executor session from `agentSessionFrom({ authority: "x-executor", partyEnv: "X_EXECUTOR_PARTY" })`, which defaults to the parties file's `agent-runner`. `execute.ts` submits `route: { kind: "vault-grant", grantId }`. `agents/session.ts` refuses any other route and calls `executor.place`. `packages/markets/src/ops/agents/executor.ts` sends `actAs: [agent]` with `commands.ts` `Grant_AcceptQuote`. C8f's drive proved this path on the sandbox (`c8f-agents.md`).

The binding resolves a seat address to a party only while that address holds a lease (`agents/session.ts`: `seat_pool WHERE state='leased' AND address=…`). A recycled seat therefore never inherits another visitor's X link, and `seat-recycle.ts` clears `address` when it frees a seat.

## Commits

| Commit | Step |
|---|---|
| `20cb981` | C13a.1 desk prompt `desk-timing.v2` |
| `e12bc5c` | C13a.2 lease-scoped seat history |
| `a6a7f3e` | C13a.3 others' profiles from publications |
| `d3cab0a` | C13a.4 relay replies (network, absolute proof link, rejection copy) |
| `f89fc59` | C13a.5 Blinks as signed Window share links |
| `2034be4` | merge of main `5cf2dff` (C2d) |
| `4c1b368` | C13a.6 the seat's own inbox |
| `5863077` | C13a.7 sentiment privacy note and k-floor test |
| `f626598` | C13a.8 Sensei: desk proof, copy, Brake pinned |
| `f3055b9` | C13a.9 X grammar: credits, BTC/ETH lane routing |
| `77b1a29` | C13a.10 forwarded X session header and handoff decisions |

## Tests added

- **`packages/db/src/idx/read-lease.test.ts`.** Real Postgres, run with `SEAT_PG_URL=postgres://localhost/pm_c13a`, in its own namespace; skipped without the variable. 8 tests. Alice leases a party and trades; the party is freed; Bob leases it. The test checks:
  - Bob's fills, exits, quotes, receipts and positions are his alone, and the Window both traded is withheld;
  - Alice reads nothing after she left;
  - another reader sees only Bob's published call and receipt, and nothing after a retraction;
  - Bob's own inbox holds his fills and verdict, and none of Alice's;
  - crowd flow is withheld at 1 and 4 publishers and read at 5.
- **`web/src/app/api/index/[...path]/queries-lease.test.ts`.** Every wallet resource asks for the lease and hands it to the reader.
- **`packages/markets/src/provider/published.test.ts`.** The open-call mark rule.
- **`web/src/app/api/activity/route.test.ts`.** Own versus published versus no lease.
- **`packages/core/src/x/share-link.test.ts`.** The share link round trip; edits, a foreign key or Window, and expiry; the card; the POST's refusals; no chain header.
- **`web/src/features/desk/proven-viewer.test.ts`**, **`web/src/features/sensei/brake.test.ts`**.
- **`web/src/features/x/native-handoff.test.ts`**, **`web/src/features/x/gate-forwarded.test.ts`**.
- **Updated:** `desk/copy.test.ts`, `desk-decide.test.ts`, the relay's `reply-format`/`reply-card`/`receipt-outcome` tests, `sensei/turn.test.ts`, `x/parse.test.ts`, `x/window.test.ts`.

## Gates

The run on `77b1a29` plus this lane's docs gave 261 test files and 2,136 tests passed, and 1 invariants warning in C8's file. After main `4831a49` (C8g) was merged (`e04584f`), the tree was gated again:

| Gate | Result |
|---|---|
| `pnpm typecheck` (all projects, including `@agari/mobile`) | pass |
| `pnpm invariants` | 0 errors, 0 warnings. C8g removed the `Number(priceE8` warning |
| `pnpm test` | 264 files passed and 7 skipped (271); 2,147 tests passed and 33 skipped; 0 failed. The known load timeouts in `api/venue/routes.test.ts` and `reply-card.test.ts` did not occur |
| `read-lease.test.ts` on Postgres (`SEAT_PG_URL=postgres://localhost/pm_c13a`) | 8 passed |

No sandbox drive was run. The host load was 25–65 all session, and each re-pointed read is covered by a Postgres test against the real schema SQL (`SCHEMA_SQL`) or a route unit test.

## Pending on C11a: `/native-auth` (ready to apply)

The web half is committed (`77b1a29`). Two pieces wait for `APP_LINK_SCHEME` (`web/src/features/canton-ux/seat/link.ts`, C11a) to reach main. Per the brief, no scheme is spelled here and C11a's branch was not merged.

1. **`web/src/app/native-auth/page.tsx`** replaces the blocked plate. It reads the X session cookie and asks `nativeHandoffStep` for the next step:
   - `begin`: `redirect(step.to)`;
   - `app`: `redirect(\`${APP_LINK_SCHEME}://${step.path}\`)`;
   - `page`: an `EmptyState` saying the page is the app's sign-in, with "Sign in on the web instead" linking to `/trade-from-x`.

   The draft is about 30 lines. `readXConfig(process.env.NEXT_PUBLIC_APP_ORIGIN ?? "")` is only the configured check.
2. **The app:**
   - `mobile/src/features/x/x-session.ts` keeps the forwarded session in SecureStore under `${APP_KEY_PREFIX}x.session` (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`) and supplies `xSessionHeaders()`.
   - `mobile/src/features/x/x-sign-in.ts` has `signInWithX()`. It makes a 16-byte hex nonce with `crypto.getRandomValues`, then calls `WebBrowser.openAuthSessionAsync(\`${SITE_URL}/native-auth?state=…\`, appUrl("x-auth"))` (C11a's helper; `Linking.createURL("x-auth")` reads the same config). It checks the nonce, then stores the session or maps the error.
   - `useXLink` sends `xSessionHeaders()` on `/api/x/status|bind|unlink` and gains `signIn`/`signOut`.
   - The X pill in `LinkStep.tsx` and `recovery/ClaimFlow.tsx` calls `link.signIn()`. `X_SIGN_IN_ON_PHONE` becomes "Opens X's sign-in in a secure sheet, then brings you straight back here."

After `git merge main`, applying these is a two-import change plus the files above. The gate is mobile typecheck, the X tests, and one simulator run once C11 has a build.

## Gaps and notes for other owners (named, not hidden)

- **C11 (universal links).** Set `IOS_APP_ID` (`<Team ID>.<bundle id>`) on the host, and add `ios.associatedDomains: ["applinks:<domain>"]` to the app config. Until then `/.well-known/apple-app-site-association` answers 404 and share links open on the web.
- **C11a (push drain).** Its `socialActivityReader.seatFills`/`seatSettlements` filter on `owner_address`, which nothing writes. `seatActivityReader` (this lane) reads the same shapes by lease. Main has been told.
- **C11a merge.** C11a's one-line comment edit in `packages/core/src/x/actions.ts` will conflict with this lane's rewrite; keep this lane's version.
- **Stage owner.**
  - `capabilities.json` and `parity.md` are not advanced here: they advance at gates.
  - Capability A-3e still reads "Blinks: every Window as a Solana Action".
- **Not changed.**
  - The X link and unlink texts still say `Wallet: <address>`. They are signed silently by the seat key and never shown, and changing them would invalidate in-flight signatures.
  - Sensei's line "a live desk is planned" follows the desk's honest state (C8).
  - Holdings stay stubbed until C7b.
- **A position withheld under a lease.** When a Window was traded by both a party's previous visitor and its current one, that position row is withheld from the new visitor, not merged. Their receipts and live contracts still show it (K-140).
