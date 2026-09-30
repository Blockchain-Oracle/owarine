# Decisions and open questions

The plan (`00-plan.md`) changes only through entries here. Format: `K-###`: date · owner · evidence · rule · user-visible consequence · approval.

Every choice that has a default is recorded here as a decision, and Abu can overrule any of them by saying so. Nothing waits on him to confirm a default.

**Numbering.** This repo's decisions use `K-` so they never collide with the reference's `D-` numbers (D-113, D-127, D-128, D-129 are cited throughout). Each stage owns a block so parallel lanes never collide:

| Stage | Block | Stage | Block |
|---|---|---|---|
| C0 | K-001–009 | C8 | K-085–099 |
| C1 | K-010–019 | C9 | K-100–114 |
| C2 | K-020–034 | C10 | K-115–124 |
| C3 | K-035–049 | C11 iOS | K-125–139 |
| C4 | K-050–059 | C13 | K-140–149 |
| C5 | K-060–064 | BitSafe | K-150–159 |
| C6 | K-065–074 | Grofty | K-160–169 |
| C7 | K-075–084 | Business | K-170–179 |
| | | Overflow | K-200 on |

A default recorded early for a later stage sits in that stage's block; its owner may amend it with a new entry.

## Decisions

### K-001 — Fork base: Agari `codex/mobile-takeover` @ `661a24ee`
- **Date / owner:** 2026-09-29 · C0 owner
- **Evidence:** the reference as checked 29 Sep (`00-plan.md`, "The reference as it stands today"): clean, contains all of `integration/w1` plus the native app. Baseline measured on the untouched tree before import (`acceptance.md`, 01:22–01:26Z): `pnpm install` 40 s; typecheck green in 9 projects; invariants 20/20; vitest 1,773 passed / 3 skipped (191 files: 190 passed, 1 skipped); web build green; mobile typecheck green. `expo export` was not part of that run.
- **Rule:** the repo starts from that tree, imported by `git archive` without `anchor/` (commit `6f3f3cf`, tag `hackcanton-s3-start`). Everything after the tag is HackCanton-window work.
- **User-visible:** none yet; the app is still the Solana app until C1.
- **Approval:** plan revision 5 (Abu, 2026-09-29).

### K-002 — The design system is used directly; no licence gating
- **Date / owner:** 2026-09-29 · Abu
- **Evidence:** Abu, 29 Sep: use the reference design system directly (Masayume/Agari); no licence gating. `94a0d65` had mounted `web/src/styles/yosuku/` from a private submodule; `2855af5` removed the submodule and restored the 18-part stylesheets byte-identical from `661a24ee`.
- **Rule:** the stylesheets live in the repo as they are. The lineage is recorded factually in `THIRD_PARTY_NOTICES.md` and `references.md`. No licence deadline and no re-expression lane. The same holds for the yosuku-derived literals in `mobile/src/theme/web/**`.
- **User-visible:** the app looks exactly like the reference.
- **Approval:** Abu, 2026-09-29.

### K-003 — Hosting: Coolify, Namecheap DNS straight to the server, no Cloudflare (a later deploy-stage item)
- **Date / owner:** 2026-09-29 · Abu (no Cloudflare) · C0 owner (defaults)
- **Evidence:** `00-plan.md`, Architecture §10. Abu, 29 Sep: the Canton product uses no Cloudflare. Agari sets `TRUSTED_PROXY=cloudflare` because `useagari.xyz` answers through Cloudflare; that does not carry over. `web/src/lib/client-ip.server.ts` already supports a proxy that owns `x-forwarded-for` (Traefik). Region detection reads `x-vercel-ip-country` (`web/src/lib/region-mark.ts:12`), which nothing sets on this host.
- **Rule:**
  - Web, ops and Postgres (and docs) run as new Coolify apps on Abu's server beside Agari's, from the reference's Dockerfiles. Namecheap A records for `@`, `docs`, `ops`, `room` point straight at the server; Traefik issues Let's Encrypt certificates.
  - `TRUSTED_PROXY=forwarded`. If a forged `X-Forwarded-For` reaches the app, Traefik gets explicit `forwardedHeaders` and the seven direct readers move onto `clientIp()`.
  - Region hold (D-095): country from a local IP-to-country database read in `proxy.ts`, default **DB-IP IP-to-Country Lite** (CC BY 4.0, attribution on `/legal`). MaxMind GeoLite2 is the alternative.
  - Domain choice, DNS records and host probes (disk, forged header, `x-forwarded-proto`, unbuffered SSE, certificates) come with the first hosted deploy. They block nothing before it.
- **User-visible:** the region hold keeps working without a CDN header; `/legal` credits DB-IP.
- **Approval:** Abu (no Cloudflare, hosting later), 2026-09-29; the DB-IP default stands unless he overrules it.

### K-004 — Decision ids use `K-`
- **Date / owner:** 2026-09-29 · C0 owner
- **Evidence:** the reference's `decisions.md` runs to D-129 and this plan cites D-015, D-036, D-066, D-081, D-095, D-101, D-113, D-120 … D-129 by number.
- **Rule:** this repo's decisions are `K-###`, in the stage blocks above. `D-` always means the reference's decision.
- **User-visible:** none.
- **Approval:** plan revision 5.

### K-005 — The reference's exclusions and removals carry over
- **Date / owner:** 2026-09-29 · C0 owner, recording Abu's earlier decisions
- **Evidence:** the 14 Excluded Yosuku-lineage rows (Abu, 13 Sep, reference Q-002/Q-003: Y-01…05, 07…13, 15, 18); Abu's mobile removals of 25 Sep (install strip, News, Pitch, Demo, Print proof, Stats, Market Surface, Download, and the /more and /notifications nav entries; `mobile/src/nav/items.ts`); friends/follows removed in the reference (`fb782348`); the sealed strategy memory market removed (`d4a693e5`, L-56); the "Strategies on X" strip removed from `/agents` (`d4a693e5`).
- **Rule:** all of these stay out (`parity.md` rows marked Excluded, and C-X01…X03). Nothing else is excluded.
- **User-visible:** the app has exactly the reference's current feature set.
- **Approval:** Abu's own dated decisions; he can reopen any of them.

### K-006 — `docs/plan/` is tracked in git
- **Date / owner:** 2026-09-29 · C0 owner (Abu's default)
- **Evidence:** the reference took its planning docs out of git on 23 Sep (`386d41ed`). Judges "open your repository… open your journal" (Opening Ceremony), and the rules require in-window work to be identifiable.
- **Rule:** `.gitignore` no longer ignores `/docs/plan/`; `/context/` stays ignored. No credential is ever written under `docs/plan/`.
- **User-visible:** the plan, decisions and evidence ledgers are public with the repo.
- **Approval:** default, 2026-09-29; Abu can overrule.

### K-007 — Product name stays neutral for now
- **Date / owner:** 2026-09-29 · C0 owner (plan default)
- **Rule:** a neutral scope until Abu names it, so a late name changes one constant each (`BRAND`, `SIGNED_MESSAGE_BRAND`, app display name, bundle id). The App Store name and subtitle avoid "prediction market" and "wallet".
- **User-visible:** a working name in the app until then.
- **Approval:** default; Abu can overrule.

### K-008 — Optional exclusions default to building the feature
- **Date / owner:** 2026-09-29 · C0 owner (plan default)
- **Evidence:** `00-plan.md`, "For Abu, optional exclusions".
- **Rule:** Blinks (A-3e) are built as a signed Window share link on the same URLs; BTC/ETH appear on the marquee (not read as Y-08's excluded multi-coin ticker). The "Strategies on X" strip is already recorded as removed (K-005).
- **User-visible:** share links open the ticket on web or in the app; the marquee shows BTC and ETH.
- **Approval:** default; Abu can overrule.

### K-009 — Local sandbox first; DevNet later
- **Date / owner:** 2026-09-29 · Abu
- **Evidence:** Abu, 29 Sep: Noders onboarding is not a blocker. Already known without onboarding: Noders `/v2/version` is public and reports Canton 3.5.18; CORS is open (`acceptance.md`).
- **Rule:** all building and testing runs on the local Canton sandbox (dpm 3.5.10 assembly, Canton 3.5.17). Just before the DevNet skeleton (C2x), Abu signs in to the Noders wallet and Console with his HackCanton account (about 2 minutes) and creates the party set; the Noders probes (rights, `POST /v2/parties`, DAR validate, token life, concurrent sessions, deduplication period, `synchronizerId`, pruning offset, ledger-time tolerance, primary-party quota, `abu-pm-dev` name collision) run then, each an acceptance row.
- **User-visible:** none until the DevNet demo.
- **Approval:** Abu, 2026-09-29.

### K-010 — Ticket direction under D-081 (C1 block)
- **Date / owner:** 2026-09-29 · C0 owner, recording the plan default
- **Rule:** 2–3 directions for StepProgress and the quote ring on the ticket are shown at `/dev/ticket-canton` by Thu 1 Oct. Abu picks one; without a pick, the option closest to today's ticket is used. The pick is recorded as a new entry before the ticket changes.
- **Approval:** default; Abu chooses.

### K-035 — The platform credential lives on both hosts (C3 block)
- **Date / owner:** 2026-09-29 · C0 owner, recording the plan default (Architecture §9, option A)
- **Rule:** `packages/ledger` takes a password grant per process, single-flight, re-granted at 80% of `expires_in`, and stores no refresh token. The credential is in the secret store of the web host and the ops host. If the realm limits concurrent sessions (probed with K-009's Noders probes), option B is forced: only ops holds it and serves short-lived tokens over `/internal/token`.
- **User-visible:** user exits keep working with the worker down.
- **Approval:** default; Abu can overrule.

### K-065 — Stock, token, basket and Pyth lanes use attested off-chain prints (C6 block)
- **Date / owner:** 2026-09-29 · C0 owner, recording the plan default
- **Rule:** the oracle feeders fetch Pyth Hermes, RedStone, Switchboard, PreStocks and the reference's other sources off-chain and post them onto the same attested `PriceQuote` path as crypto, with the original source named on every receipt (D-101's pattern). The Alpaca session calendar is a calendar, not a price.
- **Approval:** default (due Thu 1 Oct in the plan); Abu can overrule.

### K-066 — The Monday Gap lists through the span open (C6 block)
- **Date / owner:** 2026-09-29 · C6d lane
- **Evidence:** `services/ops/src/actors/window-roller/execute.ts` (+ `execute.test.ts`), `scripts/bootstrap-local.ts`, `docs/evidence/c6d-gap-events.md`.
- **Rule:**
  - A Gap Series (`<T>-gap`, the reference's nine launch tickers) opens its Window with `Series_OpenWindowSpan` at `nextIndex`, using the planner's own Friday close, Sunday 20:00 ET lock and Monday open. There is no grid, so there is no skip. The planner reads the Series' `lastExpiry` (else the grid start of `nextIndex`).
  - Bootstrap shape: cadence one week (`GAP_CADENCE_SEC`, it only names the lane), `lockLeadSec` 0, anchor floored to the week, and the ticker's dated versions with the open print admitted until the lock (the reference's `policyVersions(…, "gap")`).
  - The engine's refusals name the lane state instead of counting as failures: `bad-span`, `span-too-long`, `window-overlap` (refused: …), `no-policy` (paused), `bad-window-index` (already opened).
  - The pricer prices a Gap with the reference's `gap-fair.ts`: the xStock spot against Friday's print, blind 500 ± 150 without a reference, capped per side at `MM_GAP_MAX_CASH`, stopped 60 s before the lock.
- **User-visible:** the Gap lanes appear on `/session`, so the web's "not listed" plate goes. Without an Alpaca calendar they read "closed: no calendar", like the Regular lanes.
- **Approval:** default; overrulable.

### K-067 — The venue prices a committee event at even odds, wide (C6 block)
- **Date / owner:** 2026-09-29 · C6d lane
- **Rule:** while an event's `EventState` is live, the pricer puts 500 ± 150 (350/650, core `EVENT_FAIR_TICKS ± EVENT_HALF_SPREAD_TICKS`) on the board from the start until the Window stops taking quotes, under the per-market cap. The venue has no model of an event, so it takes the same stance as a blind Gap quote.
- **User-visible:** YES and NO both cost 650 per 1,000 ticks.
- **Approval:** default; overrulable.

### K-068 — Committee statement and resolve timing (C6 block)
- **Date / owner:** 2026-09-29 · C6d lane
- **Rule:**
  - A member's `statementHash` is the sha-256 of core `eventStatementText`. It binds `agari-event-v1`, the market, the question, the answer, the **named source** the member read, the member and the time, following the reference's attested-print message rule. A statement without a source is refused.
  - The resolver runs `Event_Resolve` once every member has answered, or 300 s after the close with a quorum, so that a dissent can still void the event as SourceDisagreement. It runs `Event_Void` after the deadline plus 2 s.
  - The old 1.0/2.0/0.5 price encoding is retired. The price path skips any terms that an `EventTerms` names.
- **Approval:** default; overrulable.

### K-069 — Receipts are history's ledger source; the board branches on product (C6 block)
- **Date / owner:** 2026-09-29 · C6d lane
- **Rule:**
  - The projection keeps every `SettlementReceipt`. `/api/index/wallet/<seat>/receipts` serves the seat's own receipts, scoped to its current lease from the lease's start offset (plan §4).
  - In history, a pair leg's receipts attach to the round the fills built, or make that round when no fill is attributed. Each ticket receipt is its own round, tagged with its product. The receipt sheet shows the ledger's breakdown.
  - A settled call publishes from its receipt (`Receipt_Publish`, this lease's receipts only). A ticket publishes by receipt id. Retract still retracts every publication of the lease on that Window.
  - Leaderboards: pair-leg publications (`product` null) keep the reference's fill replay, and every pair-leg read now filters on `product IS NULL`. A published ticket ranks on its receipt's settled figures (`tape/tickets`), beside the wallet's pair legs.
- **Approval:** default; overrulable.

### K-070 — Stock lanes with keys, two new attested sources, events on the board, one row per print (C6 block)
- **Date / owner:** 2026-09-29 · C6e lane
- **Evidence:** `services/ops/src/runtime/load-env.ts`, `services/ops/src/prices/attested-read.ts` (+ `attested-read.test.ts`), `services/ops/config/price-sources.json` `cantonVersions`, `packages/db/src/idx/prints.it.test.ts`, `packages/markets/src/server/publish.test.ts`, `web/src/features/markets/events/`, `mobile/src/features/markets/events/`, `docs/evidence/c6e-stocks-events.md`.
- **Rule:**
  - **Env.** Ops loads `services/ops/.env.local`, then the root `.env.local` (the reference's `ops:start`), as its first import in `main.ts`, `runner-main.ts` and `scripts/drive/ops-local.ts`. A variable already set is never overridden; `OPS_ENV_FILES=0` turns it off; only names are logged.
  - **QQQ and VOO** settle on `attested:alpaca:<T>`: the last IEX trade in `[T − 300 s, T]` from Alpaca market data with the ops keys (headers only), read from T + 5 s, admitted 900 s. It is appended as version 2 from 2026-09-29 (Regular and Gap) in the Canton-only `cantonVersions` block; the spot feed polls the same source for the pricer. The reference's own QQQ/VOO source was the Pyth trial, which ended 09-25.
  - **xStocks** settle on `attested:jupiter:<xStock>`: the median of Jupiter Price v3 samples at T − 40, T − 20 and T, the reference's own token-lane fallback (`jupiter-attest.ts`). It is appended as version 2 from 2026-09-29 because the ledger always takes the highest covering version and Switchboard Surge answers "IPFS fetch temporarily unavailable". A missing sample misses the print, and the Window voids. When Surge signs again, a Switchboard version is appended the same way (`Series_AddPolicyVersion`).
  - **Events on the board.** `LaneSet.events` carries live committee events beside the lanes, from the same market stream. `EventMarket.kind = "event"` trades from its start without an opening print (core `phase`) and reads 24/7. The board's §03 "Events" lists them as the reference's word card (`wq-*`), with Yes/No selecting the event into the hero and ticket. `/markets/<id>` shows an event hero (question, clock to the lock, how it settles), and the ticket reads Yes/No with no range band, leverage or chart. The phone's markets tab has the same §03 and event hero.
  - **Prints.** `idx_prints` keeps one row per `PriceQuote` contract. Per (oracle, symbol, boundary), `chosen` marks the quote an OpenPrint or Resolution cited (`evidence`), else the resolver's rule (earliest fetch, then lowest price, then contract id). The chart, proof and resolution-evidence reads take the chosen row, and `verify-projection` compares every contract.
  - **Retract** is per product: `{ marketId, product? }`, where null means the pair legs. A pair-leg retract never takes a ticket's publication on the same Window, and a ticket retract never takes the pair legs'.
- **User-visible:** the stock, QQQ/VOO, xStock and Gap lanes list on a keyed ops; QQQ/VOO receipts name "Alpaca (last IEX trade)" and the xStock receipts "Jupiter Price v3 (median of three samples)". Events have their own board section and page.
- **Approval:** default; overrulable.

### K-085 — The Canton desk's live leg trades our own markets (C8 block)
- **Date / owner:** 2026-09-29 · C0 owner, recording the plan default
- **Rule:** `DeskMandate` on `AgentGrant`; practice desks stay paper ledgers; the live leg trades this venue's markets with venue cash and is gated on C7b.
- **Approval:** default (due Fri 2 Oct in the plan); Abu can overrule.

### K-086 — Strategy registry and desk as built in `abu-pm-agents` 0.1.0 (C8 block)
- **Date / owner:** 2026-09-29 · C8b lane
- **Evidence:** `daml/abu-pm-agents` (`PM.Agents.Strategy`, `PM.Agents.Desk`); `Test.Agents.Strategy` and `Test.Agents.Desk`, 14 money-gate scripts; `dpm test` passes all 123 scripts.
- **Rule (deviations from the reference, each recorded):**
  - Subscribers fetch a venue-signed `StrategyListing`, never the creator-signed `Strategy`, because a fetch informs the fetched contract's signatories. The listing is kept in step only by the creator's own choices. The venue could still forge a listing, so this is venue trust, like the fee payout.
  - The spec seal is an `ensure` (`sha256 spec == specHash`), not a separate `creator_seal` step: a Daml create carries the whole text.
  - Fees are paid into a venue-only `StrategyFee` at subscribe. The creator receives a per-period `CreatorPayout` (total and count) and claims it; the reference paid the creator directly.
  - One active consent per (subscriber, strategy) lives in a bilateral `SubscriberBook`, because there are no contract keys. It relies on the venue issuing one `SubscriberInvite` per subscriber.
  - The engine's grants have no kinds, so any `AgentGrant` naming the runner and inside the envelope qualifies (the reference required kind STRATEGY). The runner is not a stakeholder of `Subscription`, and a self-hosting creator who is also the runner learns its subscribers through their grants.
  - Fade and mirror are recorded on the consent; the runner's direction is not enforced on ledger (as in the reference).
  - The desk's reference is a quorum of attestor `DeskMark`s (lower median). A trade fetches them, so an attestor learns that its mark was read.
  - Paused is a flag beside the live and shadow mode, so unpausing restores the mode. The operator may pause; only the owner unpauses.
  - The desk's daily window is the grant's calendar day from `dayZero` (K-024), not the reference's rolling 24 h window.
- **Approval:** default; overrulable.

### K-087 — Grants: a venue-signed grant desk, kinds read off the agent, one agent-runner party (C8 block)
- **Date / owner:** 2026-09-29 · C8f lane
- **Evidence:** `daml/abu-pm-agents/daml/PM/Agents/Vault.daml`; `Test.Agents.Vault` (open/fund refusals, counters kept, fund-vs-accept race in both orders, expired grant returns the whole budget, conservation).
- **Rule:**
  - `GrantDesk` (venue-signed, owner-controlled) opens a grant from the owner's cash and tops a live grant up. A top-up keeps the day, today's spend, open positions, caps and expiry, so it can never reset a cap (the reference's `fundGrant`). Revoke stays `Grant_Revoke`.
  - Grant kinds are not a ledger field. The agent-runner party is the house strategy runner, the X executor and the desk operator; a grant with the X "no monetary cap" caps is the executor grant, any other grant to a runner is a strategy grant, and there is no session grant (a seat already trades in one tap, L-27).
  - The X ceiling (2^64 − 1) does not fit a Daml `Int`; it travels as 9·10^18 and reads back as the ceiling.
  - Ids stay numeric for the screens: a grant's id hashes owner, agent, expiry and day zero (a trade or top-up keeps them); a strategy's hashes its registry id.
  - The trading balance is the seat's own `VenueCash`: there is no separate vault to deposit into or withdraw from.
- **User-visible:** the grant flows are unchanged; "deposit to the vault" steps are gone because the seat's cash already is the balance.
- **Approval:** default; overrulable.

### K-088 — The desk holds what it bought and sells it back (C8 block)
- **Date / owner:** 2026-09-29 · C8f lane
- **Evidence:** `PM.Agents.Desk` 0.2.0; `testDeskSellWithinMandate`, `testDeskSellRefusals`, `testDeskSellRevokedAndExpiredHoldings`, `testDeskSellConservation`.
- **Rule:** `DeskMandate.holdings` records lots per market side until the market's `refundAfter`. `Mandate_Sell` sells only lots the desk holds, on a venue buy-back quote, at no less than 92 % of the attested value, counted against the caps as the larger of proceeds and that value (the reference's sell floor and `counted`), and returns the proceeds to the budget. A fully sold position frees its open-position slot. Holdings are fungible with the owner's own legs on the same market side: the desk may sell any of them up to what it holds.
- **Approval:** default; overrulable.

### K-089 — A strategy's runner observes the consents that name it (C8 block)
- **Date / owner:** 2026-09-29 · C8f lane
- **Evidence:** `Subscription` gains `observer runner`; `testCreatorNeverSeesSubscribers` (the creator still sees none; the runner sees exactly its consents, copy and fade).
- **Rule:** the runner needs to know who fades. The house runner is the venue's own agent party; a self-hosting creator already learns its subscribers through their grants (K-086). A creator who does not run its strategy still never learns who subscribes. `dpm upgrade-check` warns on the changed observers; 0.1.0 was never uploaded.
- **Approval:** default; overrulable.

### K-090 — The live desk trades the pre-IPO names' hourly Windows with venue cash (C8 block)
- **Date / owner:** 2026-09-29 · C8f lane (records the K-085 default as built)
- **Rule:** a desk name maps to its pre-IPO series (60 m); a buy is Up lots on that name's current Window through `Mandate_Trade`, a sell is `Mandate_Sell` on the venue's buy-back. The reference is a quorum (2 of 3) of oracle-party `DeskMark`s at the Window's fair ticks. It trades demo venue cash, so it is not gated on C7b. A Window that settles pays the owner's seat, which the record shows as money leaving the desk.
- **User-visible:** the live desk's holdings are hourly positions on the names, not tokens.
- **Approval:** default; overrulable.

### K-091 — Practice desks price at the attested token print (C8 block)
- **Date / owner:** 2026-09-29 · C8f lane
- **Rule:** practice desks stay paper ledgers, filled at the PreStocks token print the lanes attest, less the reference's paper fee, one paper unit per token (no mint multiplier and no Jupiter route on Canton).

### K-092 — The maker vault (Earn's maker tab) needs three things `abu-pm-main` 0.4.0 does not have (C8 block)
- **Date / owner:** 2026-09-29 · C8e lane
- **Evidence:** `web/src/features/earn/MakerEarn.tsx` renders the reference's not-deployed state because `packages/markets/src/maker/{reads,writes}.ts` are stubs. What the ledger has: `PM.Reserve` gives any reserve id a `NavStatement`, `LpShare`s and firm `SupplyQuote`/`WithdrawQuote`s, so a `maker` reserve could take supplies today. What it lacks is a truthful NAV for a book that quotes pairs:
  1. **No on-ledger NAV for the pair book.** `Earn_PublishNav` (`PM.Tickets.Earn`) counts only ticket contracts (`NavInputs`: reserve cash, LP shares, withdraw quotes, range/parlay/boost quotes and tickets). The maker's capital sits in `Quote` locks (`Quote.daml`, the venue stake locked at issue), in the venue's own `Leg`s after an accept, and in `BuyQuote` locks. Nothing can count those into a statement.
  2. **The pair book's cash is not kept apart.** The issuer's pool locks from `shard` buckets (`services/ops/src/actors/quote-issuer/pool.ts`), and a venue-owned leg is paid into the `payout` bucket (`PM.Leg.payOut`) or `netting` (`Leg_Merge`). The same buckets carry the house side of boosts (`houseTakesSide`), exit buy-backs and seat funding. A venue leg carries `beneficiaryRef = None` (`Quote.daml:201`, `Leg.daml:109`), so a maker leg cannot be told from any other venue leg.
  3. **The issuer does not draw from the reserve.** Quotes lock from venue `shard` cash. For LP money to be what the maker quotes with, the issuer must lock from `reserve:maker` shards, and the proceeds must come back to that bucket.
- **Rule:** the maker tab stays in the reference's not-deployed state (`EARN.notDeployed`), which says so on screen. Nothing is claimed that the ledger cannot show (D-015). Because every missing piece is in `abu-pm-main` (`Quote`, `Leg`), this lane does not change main. **Superseded by K-200 (C2d): built in `abu-pm-main` 0.5.0.**
- **Design for `abu-pm-main` 0.5.0 (upgrade-compatible):**
  - `Quote` gains `book : Optional Text` (None = the venue desk, as now). `Desk_IssueQuote` takes the shard's bucket as the book when it is `reserve:<id>`. `Quote_Accept` creates the venue leg with `beneficiaryRef = book`.
  - `payOut` and `Leg_Merge` pay a leg whose `beneficiaryRef` is `Some "reserve:<id>"` into that bucket instead of `payout`/`netting`. `BuyQuote` locks from, and returns to, the same bucket.
  - `abu-pm-tickets` (or a new `abu-pm-maker`) adds `MakerDesk.Maker_PublishNav`. Like `Earn_PublishNav`, it fetches and checks each input: `reserve:maker` cash, open maker `Quote`/`BuyQuote` locks at their locked amount, and maker-tagged venue `Leg`s at their backing until resolved. The auditor observes the statement, as for the ticket reserves.
  - Ops: a second `ShardPool` over the `reserve:maker` bucket (the pool already takes a bucket filter, C8c). The pricer quotes the maker's lanes from it. `maker/{reads,writes}.ts` then read the maker statement and the seat's `LpShare`s, and route `maker-supply` and `maker-withdraw` through the existing Earn lane, the way the ticket reserves do.
- **User-visible:** until 0.5.0, the maker tab shows the reference's not-deployed Earn panel (`EARN.notDeployed`). The range, parlay and boost Earn tabs are live.
- **Approval:** default; overrulable.

### K-200 — The maker vault is a book inside the venue (`abu-pm-main` 0.5.0) (overflow block)
- **Date / owner:** 2026-09-30 · C2d lane
- **Evidence:** K-092's three gaps, built as designed there with two additions. `dpm upgrade-check --both` passes with no warnings for main 0.4.0 → 0.5.0, tickets 0.1.2 → 0.1.3, games 0.1.0 → 0.1.1 and agents 0.2.0 → 0.2.1 (the three dependents only re-point to main 0.5.0). `Test.Maker` has 10 money-gate scripts (K-201's split included); `Test.Conservation`'s random sequences now mint half their shards into the book. Evidence: `docs/evidence/c2d-maker-vault.md`.
- **Rule:**
  - **Books.** A book is a reserve bucket (`reserve:<id>`) that trades pairs. A `Quote` or `BuyQuote` issued from a book's shard carries `book`; the venue's leg of an accept (or a book buy-back) carries the bucket in `beneficiaryRef`, and a buy-back leg records what the book paid (`Leg.bookCost`). Expiry, withdrawal, settle, claim, merge, residual and stale refund all pay a book's money back into its bucket. `Leg_Merge` refuses to net two books (`book-mismatch`). Only a leg the venue owns is ever a book's: a user's own `beneficiaryRef` is the user's.
  - **Receipts.** Every book position that turns back into cash writes a venue-signed `BookReceipt` (`settled`, `merged`, `residual`, `refunded`: what the book paid, what came back). The vault's Window history is read from these, not from ops' memory.
  - **The statement.** `MakerDesk.Maker_PublishNav` counts reserve cash, withdraw locks, open book quote and buy-back locks at their amount, and book legs and residuals **marked conservatively**: a leg at the lesser of its cost and its backing, never above what a passed `Resolution` pays, and at 0 once its Window has expired without one; a residual at the lesser of its void and resolved values. `asOf` may be at most 5 minutes stale. So the NAV carries no unrealised gain, recognises a loss when the Window resolves, and every surface that shows it says it is counted at cost.
  - **Ops (`MAKER_MODE=vault`).** The issuer locks a pair quote from a `reserve:maker` shard when it is inside the vault's bounds (the reference's `MakerParams` and lanes, `MAKER_*` / `MM_ASSETS` / `MM_INTERVALS`), else the desk quotes as before; the exit issuer lets the book buy back what it sold. The reserve reporter publishes the statement. Supply and withdraw restate it first, and a withdrawal is locked from a book shard only. The merge and settle cranks are open to any seat, as the reference's `public_merge` / `public_settle` are.
  - Fees on a book's quotes stay the venue's (the vault earns the spread, as in the reference).
- **User-visible:** the maker tab is live: the vault's value, a provider's position, supply and withdraw, and the Windows it is on with merge and settle. Without `MAKER_MODE=vault` the panel says "Maker off · no new quotes" and the vault only restates and pays out.
- **Limits, stated:** a provider's lifetime supplied/withdrawn counters are not on the ledger (supplied reads as today's worth, as for the ticket reserves); a Window's opened and settled times are not either. If the book ever marks to 0 with shares outstanding, `NavStatement`'s unchanged precondition refuses the publish and the last statement stands.
- **Approval:** default; overrulable.

### K-201 — A book's legs split so the maker nets min(up, down) (`abu-pm-main` 0.5.0) (overflow block)
- **Date / owner:** 2026-09-30 · C2d lane
- **Evidence:** `Leg_Merge` nets only two legs of the same size (since 0.1.0). The first C2d drive held Down 8 / Up 11 and then Up 6 / Down 18 on one Window: the tab showed "6 sets paired · merge", and the merge crank answered "nothing to merge". The reference's `public_merge` nets min(up, down) of the vault's inventory.
- **Rule:** `Leg_Split` (new in 0.5.0, venue-held legs only, controller venue) cuts a leg into two legs on the same terms. Backing, fee and a recorded book cost split pro rata: the first part is rounded down and the second takes the rest. Nothing is created or lost, each part stays within its quantity, and the statement's mark of the parts never sums above the whole's. The maker's merge crank splits the larger of an unequal Up/Down to the smaller's lots, then merges (`planBookSplit`, command id `msplit:<cid>`). The money gate is `Test.Maker.testMakerSplitMerge`. The choice is added and no field or precondition changes, so `upgrade-check --both` 0.4.0 → 0.5.0 still passes.
- **User-visible:** "N sets paired · merge" is now what the merge does.
- **Approval:** default; overrulable.

### K-202 — Released DARs are tracked in Git (`daml/released/`, R1 on) (overflow block)
- **Date / owner:** 2026-09-30 · C2z lane
- **Evidence:** the four R1 DARs are 0.82–1.01 MB each, 3.7 MB together, and `.gitignore` does not exclude them. `bootstrap-devnet.ts` checks the package id read from `daml/released/<name>-<version>.dar` on the participant. So the file Abu uploads and the file the check reads must be the same bytes. A DAR rebuilt from the same source on another machine or another SDK patch can get a different package id. The plan's release train and gates name "the last DAR in `daml/released/`" as the old side of every `upgrade-check`. The Console cannot delete a DAR, so every released file stays live on the participant.
- **Rule:**
  - Each release commits its DARs to `daml/released/` as `<name>-<version>.dar`, beside `MANIFEST.md`. The manifest records the package id, the sha256, the build commit and the `upgrade-check --both` output.
  - The files are never rebuilt in place.
  - Older releases stay in the folder, as the record of what went up.
  - The next release's `upgrade-check` takes its old side from this folder.
  - The folder is tracked while each DAR is under 5 MB. A release with a larger DAR moves the folder to Git LFS, recorded as a new entry.
- **User-visible:** none. The judge-facing repo shows exactly what runs on DevNet: package ids in `MANIFEST.md` match `GET /v2/packages`.
- **Approval:** default; overrulable.

### K-093 — Every way a ticket ends leaves a receipt (`abu-pm-tickets` 0.1.2) (C8 block)
- **Date / owner:** 2026-09-29 · C8e lane
- **Evidence:** in 0.1.1, only settle and claim wrote a `SettlementReceipt` (K-030). The reference's portfolio History lists boosts that settled, knocked out or were cashed out, and its range and parlay screens keep ended tickets. `Test.Tickets.ExitReceipts` has 5 new money-gate scripts. `dpm test` passes all 160 scripts. `dpm upgrade-check --both` passes 0.1.1 → 0.1.2 with no warnings.
- **Rule:**
  - `Boost_KnockOut`, `BoostExit_Accept`, `Boost_RefundStale`, `Round_RefundStale` and `Ticket_VoidStale` each write the owner's receipt.
  - `detail.result` gains two words beyond won/lost/void: `"knocked-out"` and `"sold"`. A stale refund or stale void is `"void"` with `resolved = None`.
  - A stale parlay void is named by the first leg still undecided.
  - For a boost, `payout` is what the owner took; `fee` is the premium, or 0 on a void or refund; `toReserve` is the front reclaimed plus the fee.
  - `receiptDetailOk` (main) still names only the first three results. It is a helper, not a precondition, so main is unchanged.
  - The seat's `/api/ledger/tickets/mine` returns the receipts. `@agari/markets` maps them to the reference's ended states:
    - range, moonshot and parlay: `claimed`, `lost` or `void`;
    - boost and short: `settled`, `closed` (cashed out) or `knocked-out`.
- **User-visible:** a settled, voided, refunded, knocked-out or cashed-out ticket stays in "Your rounds", the parlay list and the portfolio's History, with the amounts it paid.
- **Approval:** default; overrulable.

### K-100 — Games wired on `abu-pm-games` 0.1.0 as built; no Daml change (C9 block)
- **Date / owner:** 2026-09-29 · C9b lane
- **Evidence:** `daml/pm-tests/daml/Test/Games/{Duel,Season,Gate}.daml`, 18 games scripts green (`dpm test --files …`); `scripts/drive/games-duel-it.ts`; `docs/evidence/c9b-games.md`.
- **Rule:**
  - The package needed no change, so it stays 0.1.0 (never uploaded). The added money gate (`Test.Games.Gate`: settle once, a mismatched reveal refunds both in full, the free tier, the pick rules) is test-only.
  - A pick is two seat commands, never one: `Quote_Accept` with `beneficiaryRef = duel:<arena>:<match>`, then `Duel_RecordPick`. One combined choice would make the opponent (a match signatory) a witness of the player's cash.
  - The deck commitment is `PM.Games.Deck.deckCommitment`: sha256 over the length-prefixed text preimage with the Windows' Daml market ids, committed under `ArenaTerms.policyVersion` (the version `Duel_Reveal` hashes). The TS encoder is pinned to the Daml golden vector by a differential test. Deck policy 6.
  - Deck candidates come from the venue's own price ladders (quoting both Up and Down), not the indexer, so ops deals without the web. The reference's rule that 5 m Windows are never dealt stands.
- **Approval:** default; overrulable.

### K-101 — No agent keys, arena credit or gas sponsor on Canton (C9 block)
- **Date / owner:** 2026-09-29 · C9b lane
- **Rule:** the seat key is the game key: it signs the room credential (wallet = key) and every pick is the seat's own command through the web's lease. `arena-authorize`, `arena-release-agent` and `arena-claim` answer a plain refusal (a decided pot is paid straight into each player's cash); `arena-reveal` is the deckmaster's (it alone holds the preimage). The Solana gas envelope, the arena gas check, the game sponsor hook and `/api/games/sponsor` are removed; the status probe reads the sponsor as not configured. No SOL, gas or lamport line remains in the duel on web or phone; the entry states that there is no network fee.
- **Approval:** default; overrulable.

### K-102 — The duel projection rides the main projector (C9 block)
- **Date / owner:** 2026-09-29 · C9b lane
- **Rule:** the projector calls an `onApplied` hook per applied venue transaction; `duel-projector/ledger.ts` translates arena choices into the reference's `ArenaEvent`s and `apply.ts` writes the rows, the ladder and the room deltas unchanged. There is no second stream or cursor. `arenaHeadBlock` / `listArenaEvents` keep their names and answer not-live with that reason (never an empty list). Seats map to parties through the web's `seat_pool`, read-only by ops and remembered per process; an unmapped party shows as a derived, stable id.
- **Approval:** default; overrulable.

### K-103 — Where the duel actors run (C9 block)
- **Date / owner:** 2026-09-29 · C9b lane
- **Rule:** a `games` Canton actor (the arena desk) serves `POST /internal/games/{state,match,season,open,season/distribute}` and runs the duel settler (reveal, lock, score, finalize, the three refunds) with stable `duel:<step>:<digest>` command ids. `game-room`, which constructs the matchmaker, joins the default venue actor set and idles without `ROOM_TOKEN_SECRET`. The old `duel-projector` and `duel-settler` actor names leave `main.ts`. Core's `RefundReason` gains `stale-settlement` for `Duel_RefundStale`.
- **Approval:** default; overrulable.

### K-104 — The season pool's payout and remainder (C9 block)
- **Date / owner:** 2026-09-29 · C9b lane
- **Rule:** `distributeSeasonPrizes` keeps its name and fields; on Canton it is the admin's HMAC-signed call to ops, which maps each winner's seat address to its `VenueAccount` and exercises `Season_Distribute` once. The remainder is withdrawn by the venue (`Season_WithdrawRemainder`) as an admin act; there is no route for it (superseded by K-105). The bootstrap creates `ArenaTerms` with core's `STAKE_TIERS` and a funded `SeasonPool`.
- **Approval:** default; overrulable.

### K-105 — The season remainder is an ops admin route; a closed season reads as paid out (C9 block)
- **Date / owner:** 2026-09-29 · C9c lane
- **Evidence:** `services/ops/src/actors/arena-desk/routes.ts` (`season/withdraw`), `routes.test.ts`; `scripts/season-admin.ts`; `docs/evidence/c9c-games-ux.md`.
- **Rule:**
  - Supersedes K-104's "there is no route for it". `POST /internal/games/season/withdraw {seasonId}` is HMAC-signed like every internal route and exercises `Season_WithdrawRemainder` once (`season:withdraw:<digest>`). Ops refuses it before the distribution. No web route forwards it or the distribute call; a test scans `web/src` for either path, so no seat reaches them. The admin runs `scripts/season-admin.ts` (the reference ran a deploy script).
  - The choice archives the pool. Ops records the closure in `season_closures` (season, end, deposited, withdrawn, update id), and in memory when there is no database. The arena desk's season read then answers the reference's drained pool (`distributed`, balance 0), so the rank's escrow line reads "the pool has paid out", not "no prize pool is deployed". The reference has no admin UI for either act, so none is added.
- **Approval:** default; overrulable.

### K-125 — iOS ships on public TestFlight from a new app record (C11 block)
- **Date / owner:** 2026-09-29 · C0 owner, recording the plan default
- **Rule:** a new App Store Connect app record on the same team, new bundle id, EAS project, scheme, App Group and extension ids; public TestFlight link, not Unlisted. The seat key holds no asset and is a demo-account key, not a wallet (supersedes D-128's practice-wallet restriction for this app).
- **Approval:** default; Abu creates the app record when the iOS build reaches it.

### K-126 — The app's identifiers live in one file; none is the reference's (C11 block)
- **Date / owner:** 2026-09-30 · C11a lane
- **Evidence:** the import still carried the Solana app's live identifiers in `mobile/app.json` and `eas.json` (its EAS project and update URL, `owner`, bundle id and package `xyz.useagari.app`, scheme `agari`, the App Store Connect app id and key paths). One `eas update` from this repo would have reached that app's TestFlight users. `mobile/app.config.js`, `mobile/app.identity.json`, `scripts/invariants/lib/mobile-identity.mjs`.
- **Rule:**
  - `mobile/app.identity.json` holds every identifier: display name, slug, bundle id, Android package, scheme, App Group, the widget and Live Activity extension id (expo-widgets hosts both in one target), the SecureStore key prefix and the MMKV id. `app.config.js` builds the Expo config from it, and `src/lib/identity.ts` and `src/lib/keys.ts` read it; `app.json` is gone.
  - Working values until Abu names the product (K-007): display name "Agari Canton", slug `agari-canton`, bundle id and package `xyz.useagari.canton`, scheme `agaricanton`, App Group `group.xyz.useagari.canton`, extension `xyz.useagari.canton.ExpoWidgetsTarget`, storage prefix `canton.`, MMKV id `canton`. The new version starts at 0.1.0 (Android versionCode 1).
  - There is no EAS project yet: `easProjectId` is null, so the config has no `extra.eas.projectId`, no `updates.url` and no `owner`. `eas.json` keeps its build profiles (Node 25.9.0) but has no `submit` block until the new app record's `ascAppId` exists. Push reports "no project" (the reference's own `no-project` path) until then.
  - The `mobile-identity` invariant fails if the reference's EAS project id (and with it its update URL) or its App Store Connect app id appears in any code or config file, if an identity value reuses a reference value, if `app.json` comes back, or if app source spells `agari://`.
- **TODO (Abu):** the product name and final ids. A rename edits `app.identity.json` only, before the App Store Connect record is created (a bundle id cannot change after that).
- **User-visible:** the home-screen name reads "Agari Canton"; deep links use `agaricanton://`.
- **Approval:** default; Abu can overrule the working name and ids.

### K-140 — A seat's own history is read under its lease; anyone else's only from its publications (C13 block)
- **Date / owner:** 2026-09-30 · C13a lane
- **Evidence:** the projector keys a seat's rows by party and never writes `owner_address` (`packages/db/src/idx/apply.ts`; `c9d-seats-games.md`), and a seat party is recycled to later visitors. Before C13a, `/api/index/wallet/<address>/{fills,actions,positions,orders}` matched nothing for a seat address, `/u/<address>` answered 403 for anyone else, and the activity inbox read publications even for the seat itself. Tests: `packages/db/src/idx/read-lease.test.ts` (Postgres, 8), `web/src/app/api/index/[...path]/queries-lease.test.ts`, `web/src/app/api/activity/route.test.ts`.
- **Rule:**
  - Every `wallet/*` index read runs under the caller's lease: a row of the leased party counts only from the lease's start offset (fills by `ledger_offset`, exits by the leg's `created_offset`, quotes by `issued_offset`, receipts by `created_offset`). An address with no lease reads nothing.
  - A position row sums one (Window, party), so under a lease it counts only when the party had no fill in that Window before the lease began; a Window the previous visitor also traded is withheld rather than merged. The visitor's receipts and live contracts still show it.
  - The seat's own inbox (`/api/activity` when the caller proves the seat) is its own fills and verdicts under the lease, published or not.
  - Anyone else's profile, record, badges and open calls come from opt-in `Publication`s only (`/api/index/published/<address>/*`). An open published call is marked at the Window's last price only where the venue shows it (k ≥ 5); below that its value is the stake and no P&L is claimed.
- **User-visible:** a recycled seat never shows the previous visitor's history; another trader's profile shows only what they published, and says so.
- **Approval:** default; overrulable.

### K-141 — Blinks answer with a signed Window share link (C13 block)
- **Date / owner:** 2026-09-30 · C13a lane (the plan's "Adapted" disposition, as built)
- **Evidence:** `packages/core/src/x/share-link.ts`, `share-link.test.ts`; routes `/actions.json`, `/api/actions/w/[marketId]`, `/api/actions/t/[symbol]/[cadence]`, `/api/share/window`, `/.well-known/apple-app-site-association`.
- **Rule:**
  - The URLs and the card stay (Up and Down, each with its amount field). The buttons are `external-link` actions; the `POST` runs the reference's pre-build checks (phase, stake floor, the 451 region answer) and answers `{ type: "external-link", externalLink, message }`. No chain id and no Actions version header.
  - The link is `<origin>/markets/<id>?dir=&stake=&exp=&sig=`: HMAC-SHA256 over the Window, side, stake and expiry (the Window's close), under a key derived from `AGARI_SEAT_COOKIE_SECRET` with its own label (no new variable). A valid link pre-fills the ticket's stake once through the reference's own stake preset (the hedge card's path), so the ticket is unchanged; an edited, foreign or expired link opens as a plain deep link (side only).
  - The app opens the same https path as a universal link and asks `/api/share/window` whether it verifies. The association file claims `/markets/*` for `IOS_APP_ID` (`<Team ID>.<bundle id>`) and answers 404 until it is set.
- **User-visible:** a shared Window card opens that Window's ticket, on the web or in the app, with the chosen side and stake; nothing is placed until the viewer confirms.
- **Needs (C11, not this lane):** `IOS_APP_ID` on the host and `ios.associatedDomains: ["applinks:<domain>"]` in the app config once the domain and app record exist.
- **Approval:** default; overrulable (Abu may still exclude Blinks by a dated word, plan "optional exclusions").

### K-142 — A desk's owner view needs the seat's proof (C13 block)
- **Date / owner:** 2026-09-30 · C13a lane (found through Sensei's desk read; the C8 desk owner may amend)
- **Evidence:** `/api/desk/[owner]{,/records,/records/[seq],/feed}` granted the owner view, with the owner's private notes and the mandate's live state, to any request whose `?viewer=` equalled the owner's address. `web/src/features/desk/proven-viewer.test.ts`.
- **Rule:** `provenViewer` takes `?viewer=` only when `seatCaller` proves the caller is that seat (web cookie or the phone's signed read header, which the desk client now sends). An unproven viewer is a visitor.
- **User-visible:** none for the owner; a typed address no longer opens someone else's unshared desk.
- **Approval:** default; overrulable.

### K-143 — The desk's timing prompt is `desk-timing.v2` on Canton (C13 block)
- **Date / owner:** 2026-09-30 · C13a lane
- **Rule:** v2 states the Canton desk (K-090, K-091): units on the venue's hourly pre-IPO markets bought with demo venue cash, or paper units; the 2-of-3 oracle reference; the ledger's own refusals (premium ceiling over the reference, 92 % sale floor, 15-minute reference age); cost as the quote's gap plus the practice ledger's 1 % fee. The four answers, the priorities and the rules for when are word for word v1's, so the decision logic is unchanged. v1 was only the reference's Solana prompt; no Canton record names it, so it is not carried. The evidence message speaks credits and units; its keys are unchanged.
- **Approval:** default; overrulable.

### K-144 — The X relay's public reply names Canton and links an absolute proof page (C13 block)
- **Date / owner:** 2026-09-30 · C13a lane
- **Rule:** the network label is `CLUSTER_LABEL` of `NEXT_PUBLIC_CANTON_NETWORK` ("Canton DevNet" by default); the receipt link is `<site>/proof?update=<id>`; a rejected command reads "The ledger rejected the trade. Nothing was booked and no fee was taken." The relay's placement path (C8f, `Grant_AcceptQuote` as the agent-runner party) is unchanged; a binding is the seat address, which resolves to a party only while it holds a lease.
- **Approval:** default; overrulable.

### K-145 — `/native-auth` is the X sign-in handoff into the app (C13 block)
- **Date / owner:** 2026-09-30 · C13a lane
- **Rule:** the app opens `/native-auth?state=<16-byte hex nonce>` in an auth session (`WebBrowser.openAuthSessionAsync`, ASWebAuthenticationSession on iOS) with a return URL on its own scheme read from the app config (never spelled in code). Not signed in, the page runs the ordinary X sign-in (`/api/x/start?return=/native-auth?state=…`); signed in, it redirects to `<scheme>://x-auth?session=<signed X session>&state=<nonce>`; a failure goes back as `error=<known word>`. The web's scheme is C11a's `APP_LINK_SCHEME`, which its `mobile-identity` invariant keeps equal to the app identity's. The app accepts only its own nonce, keeps the session in the Keychain and sends it back in `X_SESSION_HEADER`, which the X gate validates exactly like the cookie (HMAC, 30-day TTL). A request without a nonce never redirects into an app scheme. The seat still signs its own link text; the forwarded session only names an X account.
- **Built:** the gate's header and the handoff's decisions (`77b1a29`), then, with C11a on main, the page (redirecting on `APP_LINK_SCHEME`) and the app (`signInWithX` through `external.ts`'s `openXSignIn`, the one door the `mobile-no-web-handoff` invariant allows, returning on `appUrl("x-auth")`; session stored under `appKey("x.session")`).
- **User-visible:** "Sign in with X" works on the phone, in a sheet, and comes straight back.
- **Approval:** default; overrulable.

### K-020 — Quote issuance lives on a venue-only `VenueDesk`
- **Date / owner:** 2026-09-29 · C2 lane
- **Evidence:** Daml forbids import cycles: `VenueCash_IssueQuote` would create a `Quote` whose `Quote_Accept` consumes `VenueCash`. `daml/abu-pm-main/daml/PM/Quote.daml`.
- **Rule:** `Desk_IssueQuote` and `Desk_IssueBuyQuote` are nonconsuming on a venue-only desk. The venue cash shard passed in is consumed and its stake is locked in the quote. The plan's "`VenueCash_IssueQuote`" means this.
- **User-visible:** none.
- **Approval:** default; overrulable.

### K-021 — Resolution details fixed in the engine
- **Date / owner:** 2026-09-29 · C2 lane
- **Evidence:** `PM/Market.daml`; tests `testResolvesExactlyOnce`, `testVoidsExactlyOnce`, `testDeviationVoids`, `testLateQuoteIgnored`.
- **Rule:**
  - A missing open print voids by consuming `WindowState` (`BeforeOpen`); after the open print, void consumes `OpenPrint` (`AfterOpen`). Each is exactly once.
  - A quorum whose spread exceeds `maxDeviationBps` voids as `SourceDisagreement` automatically.
  - Ineligible quotes are ignored, not fatal. One quote per oracle is kept (the earliest fetch). The median of an even count is the lower middle.
- **User-visible:** void receipts name the reason and the slot.
- **Approval:** default; overrulable.

### K-022 — Money details fixed in the engine
- **Date / owner:** 2026-09-29 · C2 lane
- **Evidence:** `PM/Leg.daml`, `PM/Quote.daml`; tests `testFeeRecognisedOnlyAtSettle`, `testBuyBackThenPairMerge`, `testCloseOutAtCost`, `testStaleRefundLosingLegIsVenueRisk`, the conservation sequences.
- **Rule:**
  - Fee ≤ 25 % of quantity; `lots ≤ 10^12 / cashUnit`.
  - A buy-back recognises the escrowed fee at buy-back: the user closed at a price they accepted.
  - `Leg_CloseOut` needs a venue shard to re-back the pair.
  - `Leg_Settle` is valid strictly before `refundAfter`, so settle and stale refund are exact complements.
  - One merge rule: release `min(shareA + shareB, quantity)`, with equal lots.
  - Grants follow the reference's `caps.ts` order and admit at `expiresAt`.
- **User-visible:** none beyond the documented stale-refund venue risk.
- **Approval:** default; overrulable.

### K-023 — Still to build in C2 before R1
- **Date / owner:** 2026-09-29 · stage owner
- **Rule:**
  - `VenueCash_IssueTwoWay`, the batched `SettleBatch`, `PM.Reserve` (`LpShare`, `NavStatement`).
  - The full `caps.vectors.json` table, the grant revoke race, day-rollover races.
  - Policy coverage of both boundaries.
  - Privacy re-checked on the sandbox.
- **Approval:** stage plan.

### K-024 — Grants, reserve and two-way quotes as built in 0.2.0
- **Date / owner:** 2026-09-29 · C2b lane
- **Evidence:** `daml/abu-pm-main` 0.2.0; tests `testGrantCapsVectors` and `testReserve*`.
- **Rule:**
  - `Grant_AcceptQuote` takes `limitTicks` and `asOf`. The price cap applies to the agent's limit, and a quote above the limit refuses with `no-fill`.
  - A position counts against `maxOpenPositions` until its market's `refundAfter`. This is stricter than the reference, because the grant never sees settles.
  - Reserve NAV is venue-signed and auditor-visible, not verified by the ledger. An unaccepted withdraw returns its lock to the reserve bucket.
  - A two-way quote is Up at the ask and Down at 1000 − bid, from one shard.
- **User-visible:** an agent's open-position count frees a little later than on Solana.
- **Approval:** default; overrulable.

### K-025 — Oracle posting delay
- **Date / owner:** 2026-09-29 · C0
- **Evidence:** the candle-lag hour (acceptance): all three exchanges served the closed candle by T+5 s at 59 of 60 boundaries.
- **Rule:** feeders post each boundary's print at T+10 s, and the 1-minute demo lane resolves on that basis.
- **Approval:** measured.

### K-010a — Ticket direction B (D-081 choice)
- **Date / owner:** 2026-09-29 · **Abu**
- **Evidence:** the three directions at `/dev/ticket-canton` (`docs/evidence/ux/ticket-canton-*.png`).
- **Rule:** the held price gets its own row, with the 20 s `CountdownRing` beside it. While a write is open, `StepProgress` (Price → Sent → Confirming → Placed) takes the Buy button's place, so nothing can be pressed twice. The rest of the ticket stays the reference's.
- **Approval:** Abu, 2026-09-29.

### K-026 — One parties file for web and ops
- **Date / owner:** 2026-09-29 · stage owner (C3 gate finding)
- **Rule:** `AGARI_PARTIES_FILE` has one shape, the one ops and `scripts/bootstrap-local.ts` write: `{ network, parties: {venue, resolver, …}, users: {alice, bob, outsider, "seat-1", …} }`. The web takes the venue from `parties`, the personas from `users`, and the seat pool from every `seat-*` user, in numeric order. `bootstrap-local.ts --seats N` creates the seats. The web still accepts its older shape.
- **Evidence:** `web/src/lib/server-env.parties.test.ts`.
- **Approval:** default; overrulable.

### K-027 — Display-only price feeds never mark ops unhealthy
- **Date / owner:** 2026-09-29 · stage owner (C3 gate finding: PreStocks answers 429 to this host)
- **Rule:** `prestocks-spot`, `xstock-spot`, `pyth-index-spot` and `switchboard-spot` show prices on screen and never price, resolve or settle. `/health` lists them under `degraded` without turning `ok` false. The status page's relay-freshness rows read the three oracle feeders' heartbeats.
- **Evidence:** `services/ops/src/http/health.test.ts`.
- **Approval:** default; overrulable.

### K-028 — Publishing a settled call needs a settlement receipt (Daml 0.3.0, before R1)
- **Date / owner:** 2026-09-29 · stage owner (C5 finding)
- **Evidence:** `Leg_Publish` is nonconsuming on `Leg`, and `Leg_Settle`/`Leg_Claim` archive the leg, so there is nothing to publish from after settlement. The reference lets a call be shared after it settles.
- **Rule:** until 0.3.0, publishing works on live legs, and a settled, unpublished call shows an honest note. In 0.3.0, `Leg_Settle`/`Leg_Claim` create a bilateral `SettlementReceipt` (owner + venue) with `Receipt_Publish`. That removes the note and gives portfolio history a ledger source.
- **Approval:** default; overrulable.

### K-029 — Ticket products as built in `abu-pm-tickets` 0.1.0
- **Date / owner:** 2026-09-29 · C8a lane
- **Evidence:** `daml/abu-pm-tickets`, 37 new money-gate scripts; `dpm test` passes all 107 scripts with 0 failures.
- **Rule (deviations from the reference, each recorded):**
  - A Boost void returns the premium: fees are recognised only on a non-void settle (K-022).
  - Knock-out proceeds are pinned at issue, because there is no book mark.
  - Boost exits are whole-position only.
  - Cap locks release at prune after expiry, not at settle.
  - Parlay risk is booked against the last leg's expiry.
  - Pricing stays in `packages/core`; the ledger only bounds quotes.
- **For a later engine version:**
  - `Nav_IssueWithdraw` should require a reserve shard.
  - A general `SettlementReceipt` covering tickets.
  - An explicit close-admission field on `MarketTerms`.
- **Approval:** default; overrulable.

### K-030 — Engine 0.4.0 before R1: Gap windows, events, and the recorded engine follow-ups
- **Date / owner:** 2026-09-29 · stage owner (C6, K-028, K-029 findings)
- **Rule:** before R1 (the first DevNet upload), `abu-pm-main` gets one upgrade-compatible 0.4.0 carrying:
  - a Series open choice that takes a Window's own start, lock and expiry, so the Monday Gap (Friday close to Monday open, locking Sunday 20:00 ET) lists;
  - a dedicated yes/no event template with an attest choice, in place of the price encoding;
  - `Nav_IssueWithdraw` requiring a reserve shard;
  - a general `SettlementReceipt` that covers tickets;
  - an explicit close-admission field on `MarketTerms`.
- **Until then:** the Gap lane shows its honest not-listed state, and event markets reuse the price path.
- **Built (C2c, `abu-pm-main` 0.4.0, `abu-pm-tickets` 0.1.1):** `dpm upgrade-check --both` passes with no warnings for 0.3.0 → 0.4.0 and 0.1.0 → 0.1.1. No field or choice was removed or renamed, and no precondition changed. Tests: `Test.Gap`, `Test.Event`, `Test.Admission`, `Test.Tickets.Receipts` and new reserve refusals. `dpm test` passes all 155 scripts.
  - **Gap.** `Series_OpenWindowSpan {index, tradingStart, lockAt, expiry}` runs the same `nextIndex` and policy-coverage checks as `Series_OpenWindow`, over a span of at most four days. Refusals: `bad-span`, `span-too-long`, `window-overlap`. Both opens refuse a Window that starts before the last one's expiry. `Series.lastExpiry : Optional Time` is new, and `None` means the grid start of `nextIndex`.
  - **Events.** `Series_OpenEvent {index, question, tradingStart, lockAt, closeTime}` creates the ordinary `MarketTerms`, an `EventTerms` (the committee is the Series' oracles and quorum) and a single-use `EventState`. It creates no `WindowState`. Committee members create `EventAttestation {answer: Bool, attestedAt, statementHash}`.
    - `Event_Resolve` needs a quorum. Unanimous YES gives a `Resolution` Up, and unanimous NO gives Down. A mix of YES and NO voids as `SourceDisagreement CloseSlot`.
    - After the deadline, `Event_Void` names one of `MissingPrint`, `QuorumNotMet`, `SourceDisagreement` or `ResolverAbsent`.
    - An `EventVerdict` records the question and the attestations counted.
    - Legs settle unchanged.
  - **Reserve.** `Nav_IssueWithdraw` keeps its signature and refuses a shard outside `reserve:<id>` (`bad-shard`). It was tightened in place instead of being duplicated, because nothing is on a participant yet. `Earn_IssueWithdraw` now simply forwards the call.
  - **Receipts.** `SettlementReceipt` gains `product : Optional Text` (None = pair leg) and `detail : Optional ReceiptDetail`, and `Publication` gains `product`. Ticket settle and claim create the receipt; field meanings are in `PM/Publication.daml`.
  - **Close admission.** `MarketTerms.closeAdmissionSec : Optional Int` is set at every open. Readers use `closeAdmissionOf`, which falls back to closeDeadline − expiry. The Boost knock-out uses it.
- **Approval:** default; overrulable.

### K-203 — The desk page's shared desk is named per deployment (overflow block)
- **Date / owner:** 2026-09-30 · C8g (lane C8h)
- **Evidence:** `docs/evidence/c8g-agents-ux.md` §Desk. The reference hard-coded its own desk id (`49f67e4d…`), a row of its Solana-era database; on Canton `/desk` read "The shared desk could not be read right now" and "See a shared desk" led to an unreadable page.
- **Rule:** `NEXT_PUBLIC_SHARED_DESK_ID` (web) and `EXPO_PUBLIC_SHARED_DESK_ID` (phone) name the desk this deployment shares; its owner turns sharing on from the desk's own Share control. Unset, `/desk` shows the entry's no-shared-desk state, which the reference already has (`sharedId={null}`).
- **User-visible:** the entry's shared-desk card and link show a real desk on this network, or no card at all; never a dead link.
- **Approval:** default; overrulable.

### K-204 — A seat key maps to a party only through its live lease, joined keys included (overflow block)
- **Date / owner:** 2026-09-30 · C4c (lane C4c seat-link fixes)
- **Evidence:** `docs/evidence/c4c-seat-link-fixes.md` §1. C11a left four paths reading `seat_pool.address` alone (ops agents session, duel seats, desk discovery, web `agents.server.ts`), so a key joined by a seat link mapped nowhere there, and the duel directory answered a remembered party for a key whose lease had ended.
- **Rule:** every address → party resolution goes through `@agari/db` `seatPartyFor` / `seatLeaseRowFor` (and party → seat address through `seatHolders`). A key maps only while it holds the party's live lease or joined that same live lease; an ended, drained, freed or re-leased seat maps none of its old keys, and nothing remembered in a process stands in for the lease. The duel open checks the pairing's creator by party, so a joined phone queues and opens as its seat, and the room shows the key that queued. The Room gate admits a joined key for its lease's own bets.
- **User-visible:** a phone joined to a web seat can grant, duel and run a desk as that seat. A season payout to a player whose seat has since ended is refused (its party may belong to the next visitor) instead of crediting a recycled seat.
- **Approval:** default; overrulable.

### K-210 — A desk is its owner's only under the owner's current lease; its address names its opening (overflow block)
- **Date / owner:** 2026-09-30 · C4d security lane (review finding H2)
- **Evidence:** a desk's address was SHA-256(venue · owner party), and a seat party is recycled, so visitor A's index row pointed at visitor B's live desk on the same party: `GET /api/desk/<A>?viewer=A` returned B's desk, and the runner could trade A's record on B's mandate. Tests: `packages/markets/src/desk/lease-bound.test.ts`, `services/ops/src/actors/desk-runner/lease-bound.test.ts`, `web/src/features/desk/chain-lease.test.ts`, `packages/db/src/desk-lease.test.ts` (Postgres).
- **Rule:**
  - The web's `readChain` and the runner's `reconcileLive` look a row's mandate up only among the mandates of the party the row's owner leases NOW (`findLeasedMandate`); an owner with no lease gets nothing, and the runner closes that row ("the seat this desk belonged to was reset or passed on").
  - The seat drain closes the draining lease's index rows (the holder's, a joined key's, and any row on the party's pre-C4d address) with a `state_set` event (`closeLeaseDesks`).
  - A desk's address is SHA-256(venue · owner party · its opening), the opening being the embedded grant's expiry, which `DeskOffer_Open` sets once from the server's clock and every later choice keeps. **Trade-off:** the review asked for the lease id in the address; the ledger does not know lease ids, and every writer of a desk address (the operator's command ids, the discovery pass, a decision's history) derives it from the mandate alone. An opening always falls inside one lease (the drain must close the mandate before `readSeatHoldings` lets the party be freed), so the opening is a lease-bound identity the ledger can reproduce. A row written before C4d keeps the old address, which resolves only for the party's current lessee.
  - A desk's history is the live mandate's own hash chain walked back from its head, so an earlier lessee's decisions on the same party are never counted.
- **User-visible:** none for a visitor's own desk. A recycled seat's next visitor never sees, and is never traded through, the previous visitor's desk; the previous visitor's desk page reads "closed".
- **Approval:** default; overrulable.

### K-211 — A phone write carries its own one-request proof; the read header reads only (overflow block)
- **Date / owner:** 2026-09-30 · C4d security lane (review finding M2b)
- **Evidence:** the signed read header (`x-agari-seat-read`) was reused for four minutes and also passed `seatFromRequest({ write: true })`, so one captured header could `POST /api/seat/link` and take the seat over. Tests: `web/src/lib/seat-write-auth.test.ts`, `mobile/src/wallet/seat-key.test.ts` (the phone's key against the server verifier), `packages/markets/src/submitter/seat-lane.test.ts`.
- **Rule:** on the phone every write (any method but GET) carries `x-agari-seat-write: address.issuedAtMs.nonce.signature`, the seat key's signature over the method, the path with its query, the SHA-256 of the exact body bytes, a 16-byte nonce and the time (`@agari/core/auth` `seatWriteText`). The server takes it within 30 s (5 s skew), for that request only, once: it keeps each verified nonce until the proof goes stale. The read header is honoured for reads only. The web keeps its cookie with the same-origin and `x-agari-seat: 1` rule.
- **Trade-off:** the nonce cache is in the web process's memory (`globalThis`), which is every replica the single Coolify container has. A second web process would need a shared store (the database) before it scales out.
- **User-visible:** none; each phone write costs one local signature.
- **Approval:** default; overrulable.

### K-212 — The app's X handoff is a confirmed, one-time PKCE code, never the session in a URL (overflow block; amends K-145)
- **Date / owner:** 2026-09-30 · C4d security lane (review finding M2a)
- **Evidence:** `/native-auth?state=` redirected a signed-in browser's X session token straight to `<scheme>://x-auth?session=`, with no tap: any iOS app opening that page in its own ASWebAuthenticationSession (which shares Safari's cookies) and naming our scheme as its callback could collect it. Tests: `web/src/features/x/native-handoff.test.ts`, `web/src/app/api/x/native-code/route.test.ts`, `mobile/src/features/x/x-sign-in.test.ts`.
- **Rule:** the app opens `/native-auth?state=<nonce>&challenge=<S256 of its verifier>`. Signed in, the page asks "Continue in the app as @handle"; only that tap (a same-origin form post, `/api/x/native-code`, Origin and Sec-Fetch-Site checked, with the SameSite=Lax X cookie) answers 303 `<scheme>://x-auth?code=&state=`. The code is 32 random bytes, 60 s, one exchange, burned by a wrong verifier. The app POSTs `{ code, verifier }` to `/api/x/native-exchange` for the session and keeps it in the Keychain as before. A request without a nonce and a challenge still never redirects into an app scheme.
- **Trade-off:** codes live in the web process's memory, like K-211's nonces (one container). An app that starts its own handoff holds its own verifier, so PKCE alone does not stop it; the confirmation tap (and iOS's own "wants to use … to sign in" prompt) is what does.
- **User-visible:** one extra tap ("Continue in the app") on the phone's X sign-in sheet.
- **Approval:** default; overrulable.

### K-213 — Ops' internal calls are single-use; the season admin has its own secret (overflow block; amends K-105)
- **Date / owner:** 2026-09-30 · C4d security lane (review finding L4)
- **Evidence:** `/internal/*` accepted a captured call again within its 30 s window, a handler's crash answered with its own error text, the public `/health` served a failed pass's raw ledger error, and `season/distribute` was signed with the web's `OPS_INTERNAL_SECRET`. Tests: `services/ops/src/http/internal.test.ts`, `services/ops/src/runtime/actor-health.test.ts`, `packages/markets/src/server/ops-client.test.ts`.
- **Rule:** the web → ops signature is `v2` over `<ts>.<nonce>.<METHOD>.<path>.<body>` with `x-agari-ops-nonce` (16 random bytes); ops takes each verified nonce once and keeps it for twice the skew (in memory: ops is one container, AD-4). `season/distribute` and `season/withdraw` verify under `OPS_ADMIN_SECRET` (ops only, never the web; unset = closed), which `scripts/season-admin.ts` signs with. A handler's crash answers "ops could not complete this call (ref …)"; a failed pass reads "pass failed (ref …)" on `/health`; both texts go to the log under the reference. The runbook takes `/internal/*` off the public router (`!PathPrefix(/internal)`).
- **User-visible:** none. The season admin needs `OPS_ADMIN_SECRET` instead of the web's secret.
- **Approval:** default; overrulable.

### K-214 — A duel-room credential and an arcade score are seat writes (overflow block; joins K-204 and K-211)
- **Date / owner:** 2026-09-30 · lead, at the C4c + C4d merge
- **Evidence:** C4c made `/api/games/room-token` and `/api/games/arcade/score` check the seat (`seatFromRequest({ write: false })`) and sent the phone's read header with them; C4d then limited the read header to reads (K-211). A captured read header could still mint a room credential or post a score as the seat for up to five minutes.
- **Rule:** both routes call `seatFromRequest({ write: true })` and read the body through `jsonBody` (so the write proof hashes the same bytes); `seatAuthHeaders({ method, url, body })` sends the site header for the web's cookie path and the one-request write proof for the phone.
- **User-visible:** none; each mint, renewal and score costs the phone one local signature.
- **Approval:** default; overrulable.

### K-215 — Re-review follow-ups: a POST read takes the write proof; nonces are bounded; a verified X link stays public (overflow block)
- **Date / owner:** 2026-09-30 · lead, after the security re-review of main b22b1b0
- **Evidence:** the re-review found (1) the phone's ticket previews and range basis answered 401: the phone signs every POST with the one-request write proof (K-211), and a read looked only for the read header; (3) the write-proof nonce map swept every entry on every call and stored nonces from self-made keys; (4) `/api/x/status?wallet=` answers a wallet's verified X handle to anyone; (6) the link join could wait forever on a store fault.
- **Rule:** `seatFromRequest` accepts the write proof for a read as well as a write (never the read header for a write); `seatWriter` spends a nonce only for a key that holds a live lease, the sweep stops at the first live entry and the map is capped (ops' internal nonces too); the join waits at most the confirm window. (4) is kept as the reference has it: a verified X link is a public badge the visitor chose (`/u/[address]` shows it server-side), so the route stays open by wallet.
- **User-visible:** ticket previews work on the phone; nothing else changes.
- **Approval:** default; overrulable (Abu may ask for the X badge to be hidden unless the visitor opts in).

### K-220 — A desk names this deployment's Canton network, never "mainnet" (overflow block)
- **Date / owner:** 2026-09-30 · C8i lane
- **Evidence:** `docs/evidence/c8g-agents-ux.md` gap 2 and `docs/evidence/c8i-agents-gaps.md`. The web wrote every desk row, and every desk signed text's network line, as `mainnet` (a Solana-era constant); the runner defaulted to `mainnet` too, so a LocalNet runner could not see the desks it should run, and `DESK_MODEL_STUB` (localnet only) never reached them. `services/ops/src/actors/desk-runner/env.test.ts`.
- **Rule:**
  - The web's `DESK_CLUSTER` is `NEXT_PUBLIC_CANTON_NETWORK` (the same network the proof links name). The runner reads `DESK_CLUSTER`, else ops' `NEXT_PUBLIC_CANTON_NETWORK`, else DevNet, the same default as every other agent in ops.
  - `desks.cluster` allows `testnet` beside `mainnet`, `devnet` and `localnet`. The schema replaces the CHECK only while it lacks `testnet`, so a boot does not lock the desks table every time.
  - `DESK_MODEL_STUB` stays honoured only on a LocalNet deployment; it now reaches that deployment's desks.
  - A database an earlier build wrote desks into as `mainnet` (a LocalNet or DevNet drive) re-labels them once: `UPDATE desks SET cluster = '<network>' WHERE cluster = 'mainnet'`.
  - Identifiers inherited from the reference (`DeskMainnetSession`, `USDC_MAINNET`, `MAINNET_RPC_PATH`) keep their names; nothing a desk stores, signs or shows says mainnet.
- **User-visible:** a desk's signed texts name the deployment's network; the desk page and its runner agree on which desks exist.
- **Approval:** default; overrulable.

### K-221 — A creator claims its fees from its own strategy's desk (overflow block)
- **Date / owner:** 2026-09-30 · C8i lane
- **Evidence:** `docs/evidence/c8g-agents-ux.md` gap 1. The keeper pooled fees into a `CreatorPayout` and `Payout_Claim` had a route, but no screen called it, so a creator's fees waited on the ledger. `packages/markets/src/server/agents-payouts.test.ts`.
- **Rule:**
  - When the seat published the selected strategy, "Your strategies" shows "Your fees" in the desk's numbers row (the reference's LiveDesk kit): the waiting total, the fee count, and "Claim to your seat". Web and phone share `useCreatorFees` and `useDeskWrites().claimFees`.
  - `GET /api/ledger/agents/payouts` reads the seat's `CreatorPayout`s AS the leased party only. The claim is the `strategy-claim-fees` intent → `POST /api/ledger/agents/strategies/claim`, one seat command with a `Payout_Claim` per waiting payout, journaled by its command id.
  - A payout is a period's total and fee count for all the creator's strategies; it never names a subscriber (K-086, K-089). The card says so.
  - The reference paid creators at subscribe, so it had no claim; Y-18 (builder-code creator earnings) stays excluded and is a different thing.
- **User-visible:** a creator sees the fees waiting and moves them into its seat in one tap, with a receipt link.
- **Approval:** default; overrulable.

### K-222 — A live desk's figures count from going live (overflow block)
- **Date / owner:** 2026-09-30 · C8i lane
- **Evidence:** `docs/evidence/c8g-agents-ux.md` gap 3: after a 50-credit deposit the plate read "+$47.50 since your money went in" and "−95.0% since the first check". The runner compared the live desk with the last practice snapshot ($1,000 of paper), read the paper as money that had left, and scaled the loss baseline to 2.50; the chart ran on from the practice series. `packages/db/src/desk-golive.test.ts` (real Postgres).
- **Rule:**
  - A desk's snapshots count from its last `went_live` event: `latestSnapshot` (the runner's reconcile and the page's value) and `snapshotSeries` (the chart). The practice record stays readable in its own records.
  - Going live clears the loss baseline (`attachLiveDesk` already did; a practice row the runner discovers live now does too, once, with a `went_live` event). The first priced live valuation sets it afresh; a deposit then scales it as before.
  - A practice deferral ("would have", "wait") and a practice "did this minutes ago" do not bind the live desk: both count records from the desk's current life only. C8i's drive caught the live desk skipping its first buy as "the desk would already have bought OpenAI" from practice.
  - A live desk's plate speaks the seat's credits: no `$`, the move since the money went in in credits, and "Valued … at each Window's attested fair price" (K-090). A practice desk keeps dollars.
- **User-visible:** after going live with 50 credits the plate reads 50.00 credits and +0.00 credits since the money went in; the chart starts at going live.
- **Approval:** default; overrulable.

### K-223 — The strategy runner holds a Window the grant's caps would refuse (overflow block)
- **Date / owner:** 2026-09-30 · C8i lane
- **Evidence:** `docs/evidence/c8g-agents-ux.md` gap 4: the runner sent while a grant was at its open-position cap, the ledger refused `abu-pm/over-position-cap`, and the Window was marked "refused, not resending". The grant executor skipped the position check on purpose. `services/ops/src/actors/strategy-runner/reliability.test.ts` runs the runner's check over the reference's caps vectors.
- **Rule:**
  - Before reserving an attempt, the runner asks core `capsAtQuotePrice`: `simulateCaps` (the ledger's `capRefusal` in the same order, golden-tested on the reference's caps vectors) at the quote's own price. On Canton the agent accepts the owner's firm quote with its price as the limit, so the side price is the quote's cost per contract, not the reference's cushioned IOC limit. A cap the grant is at is a skipped Window, with the reason in the runner report, so the Window may be entered once a position closes.
  - The grant executor asks the same `capsAtQuotePrice` before it sends, so the two cannot disagree (C8i's drive caught one Window the executor refused on the cushioned limit after the runner passed it). It no longer lets the position check through: it counts `opensNew` exactly as the ledger does (no open position on this Window's side under the grant).
  - The ledger stays the guard; nothing here can move money.
- **User-visible:** the runner report says "the grant is at its open-position cap (N open); holding until one closes" instead of a ledger refusal.
- **Approval:** default; overrulable.

### K-224 — A recycled seat inherits no strategy, fee payout or runner of an earlier visitor (overflow block)
- **Date / owner:** 2026-09-30 · C8i lane (security review H1, L5)
- **Evidence:** the review found that the next visitor on a recycled seat party saw the previous visitor's strategies and creator payouts. It could claim those payouts (`POST /api/ledger/agents/strategies/claim`) and revise, re-run or deactivate the strategies. `POST /api/strategies/playbook` accepted it because the creator was labelled as the party's current lessee. `setRunner` took any party. Tests: `packages/markets/src/server/agents-payouts.test.ts`, `seat-holdings.test.ts`, `services/ops/src/actors/seat-funding/drain.test.ts`.
- **Rule:**
  - A seat's agents reads and writes are one lease's. A grant, consent, strategy or fee payout counts only if it was created at or after the lease's start offset (`seat_pool.start_offset`, the ledger end when the lease began). Claim, update, runner change and deactivate refuse anything older. The venue's standing offers and the seat's cash are the party's.
  - A creator is shown by its lessee's address only for strategies created in that lease. An older strategy on the same party shows the party, is not "yours", and its playbook cannot be written.
  - A seat is not recycled while it has a live strategy it published or a creator payout made to it. Before the cash sweep, the drain has the venue pay out the fees it still holds for the seat, deactivates the seat's live strategies and claims its payouts into its cash. A seat whose held fees cannot be paid out waits.
  - A strategy runs on the house runner (the agent-runner party) or on its creator's own seat; publish and runner changes refuse any other party.
- **User-visible:** a visitor on a recycled seat starts with no strategies and no fees. A creator's last fees are paid into its seat before the seat is freed.
- **Approval:** default; overrulable.

### K-225 — A live trade's cost is measured against its own price (overflow block)
- **Date / owner:** 2026-09-30 · C8i lane
- **Evidence:** C8i's drive (`docs/evidence/c8i-agents-gaps.md` §2): gpt-5.4 answered ACT_NOW (84%) for a 20-credit OpenAI buy and the desk blocked it as "more than 2.5% against the price". `services/ops/src/actors/desk-runner/market.test.ts`.
- **Rule:** on the live leg (K-090) a trade's cost is its fill against the Window's best ask (a buy) or best bid (a sell): the venue's 1% fee and any walk down the ladder, under the reference's 2.5% limit. The ask's distance from the Window's fair price is the premium, which the owner's premium ceiling bounds on the ledger. Measuring cost against fair counted the venue's half-spread twice, and a 30-tick spread (6% at 0.50) put every live buy over the limit. Practice desks are unchanged.
- **User-visible:** a live desk can buy when the model says act now and the premium is inside the owner's ceiling.

### K-245 — Canton Coin converts at a fixed, stated rate, exactly or not at all (overflow block; K-240 is C7c's)
- **Date / owner:** 2026-09-30 · C7b lane. (The lane brief said "from K-240"; K-240 was already C7c's resting call, so C7b's entries start at K-245.)
- **Evidence:** `daml/abu-pm-cc/daml/PM/CC/Units.daml`, `Test.CC.Deposit` (`testUnitsArithmetic`, `testDustRefused`, `testBoundsRefused`, `testOverflowBounds`), `packages/ledger/src/units.ts` and `units.test.ts` (the same vectors); `docs/evidence/c7b-canton-coin.md` §"The rate".
- **Rule:**
  - A `CcListing` states one rate, `unitsPerCoin`: cash base units (10^-6 credit) per one whole coin, fixed for the life of that listing. A different rate is a different listing (a new `listingId`), because cash credited at one rate is redeemed at that same rate. There is no price feed and no oracle: the rate is a unit of account the venue states, not a market quote, so no one can move it.
  - The rate must divide 10^10 (a CIP-56 `Decimal` is `Numeric 10`), so one cash unit is a whole number of atomic units and every conversion is exact. **The default is 100,000 units per coin: 1 Canton Coin = 0.10 credit, one cash unit = 0.00001 coin.** It is a placeholder for Abu to set from the price of the day real value first moves (`CC_UNITS_PER_COIN`); on DevNet the coin has no value and the number is arbitrary.
  - **Rounding never favours the venue because there is none.** A deposit that is not a whole number of cash units is refused as dust (the ops actor rejects the transfer back to its sender), never rounded down (the venue would keep the fraction) or up (the venue would credit cash it holds no coin for). A withdrawal converts cash units to coin exactly, always. The only rounding in the package is `unitsFloor`, on the assets side of a reserve statement, which rounds down so a statement can understate what the venue holds and never overstate it. A form may round the user's own typed amount DOWN to the step and says it did.
  - The one Decimal to Int conversion is `PM.CC.Units.toAtomic` (mirrored by `@agari/ledger` `units.ts`); every bound is checked by division before any product, so nothing overflows Int64: a whole-coin bound of 10^7 (an atomic amount stays below 10^17), `maxUnitsFor rate`, an `ensure` on each listing and receipt, and a 4 x 10^18 bound on every total.
  - Deposit limits per listing: default 1 coin (100,000 units) to 10,000 coins (10^9 units).
- **User-visible:** the funds screens state the rate and the step ("Amounts are exact, in steps of 0.00001 Canton Coin. Anything finer is sent back to you, never rounded"), and only once the path is live (K-248).
- **Approval:** default; overrulable.

### K-246 — The instrument set: Canton Coin, on the token standard's V1 interfaces, checked by who signed it (overflow block)
- **Date / owner:** 2026-09-30 · C7b lane
- **Evidence:** `daml/vendor/splice/README.md`; `daml/abu-pm-cc/daml/PM/CC/Listing.daml` (header); `packages/markets/src/ops/cc/policy.ts` (`planDeposits`) and `policy.test.ts`; `docs/evidence/c7b-canton-coin.md` §"What Daml cannot check".
- **Rule:**
  - The venue lists **Canton Coin** (admin: the DSO party, id `Amulet`) by default. Another CIP-56 instrument is another `CcListing` with its own `listingId`, admin, id and rate; an instrument no listing names is not accepted (`wrong-instrument` on the ledger, and the ops actor leaves the transfer alone).
  - The rail uses the token standard V1 (CIP-0056) interfaces only: `Holding`, `TransferFactory`, `TransferInstruction`. Every registry supports V1 and Canton Coin implements both V1 and V2; the transfer flow needs only the receiver's authority, and it is what a wallet's plain transfer already is. **The allocation (V2, CIP-0112) route is not built** in C7b: it is the route a wallet user outside our participant needs (executor-only settlement), and it needs the V2 test registry and a V2 driver, not a change to this design. It is the first item under "What waits" in the evidence note.
  - A deposit is the owner's own pending transfer to the venue, accepted and credited in one transaction (`Listing_SettleDeposit`); the credit is derived from the holdings the registry says it created for the venue, never from a number the venue types.
  - **An interface view is what the contract's own template says**, so Daml cannot tell the registry's instruction from a look-alike template on a shared participant. The ops actor therefore settles an instruction only if the listing's `instrumentAdmin` is among the created event's `signatories` (a look-alike cannot have the registry's party sign it) and, when configured, only if its template's package is on `CC_ALLOWED_PACKAGE_IDS`. Anything else is left alone, never accepted.
  - The token registry's off-ledger API is called through an injected client written from the OpenAPI and run only against fixtures in this lane.
- **User-visible:** none until the path is live.
- **Approval:** default; overrulable.

### K-247 — The reserve rule: coin held covers the coin owed, per owner, checked from the ledger's own contracts (overflow block)
- **Date / owner:** 2026-09-30 · C7b lane
- **Evidence:** `daml/abu-pm-cc/daml/PM/CC/Records.daml` (`CcAllowance`, `CcReserveStatement`), `Listing.daml` (`Listing_Attest`); `Test.CC.Reserve` (`testStatementCovered`, `testStatementShowsShortfall`, `testStatementRefusals`, `testRandomSequenceKeepsTheReserve` over two seeds); `docs/evidence/c7b-canton-coin.md` §"The reserve".
- **Rule:**
  - **What the venue owes in coin** is a `CcAllowance` per owner and listing: the cash units that owner deposited and has not taken back. A deposit raises it, a withdrawal lowers it, a refunded withdrawal restores it. **Winnings and demo credits never raise it.** This is the answer to the demo economy: the venue can mint demo cash and pays winners in credits, and none of that can be withdrawn as coin, so the coin the venue holds is claimed only by what was put in. A user can take back up to `min(allowance, cash)`, no more.
  - **The statement** (`Listing_Attest`, venue-signed, auditor observer, one live per listing) names the venue's unlocked holdings of the instrument (each fetched through the `Holding` interface, so each must exist and be the venue's; a foreign, locked or repeated holding is refused) and every allowance, and records `heldUnits >= liabilityUnits` as `covered`. `heldUnits` is the holdings rounded DOWN. A short statement is still publishable: it says `covered = false`, because hiding an insolvency helps no one. The ops actor raises an alert when it would publish one.
  - **What the ledger enforces per operation**: the credit equals the coin received; a withdrawal debits exactly its cash, lowers the allowance and instructs the transfer in one transaction, so cash is never debited without the transfer instructed and a transfer that fails at once leaves the owner whole; a pending transfer that is never accepted is taken back and refunded; one settle per instruction. **What it does not enforce**: that the venue names every holding and every allowance. The auditor, who observes every allowance, checks completeness; for Canton Coin the holdings are public on Scan.
  - The invariant, after every step of two seeded 40-step random sequences: coin the venue holds unlocked + coin in flight + coin the owners took = everything minted in; the venue's coin covers the sum of allowances to the unit; and with no trading each owner's cash equals their allowance.
  - Profit the venue makes on trades stays credits. Turning it into coin is a treasury decision outside the rail, and the statement stays conservative until then.
- **User-visible:** the funds screens show "The venue holds X of coin against Y owed. Covered." from the venue's own statement, once the path is live.
- **Approval:** default; overrulable.

### K-248 — The Canton Coin path is `not-live` in code, and real value never rides a pooled seat (overflow block)
- **Date / owner:** 2026-09-30 · C7b lane
- **Evidence:** `packages/core/src/cc/index.ts` (`CC_RAIL_CAPABILITY`), `packages/markets/src/server/cc.test.ts` ("refuses every write before journaling or signing while not-live"), `web/src/features/funding/cc-panel.test.ts` ("while not-live says so, offers nothing and invents no figure"), `packages/markets/src/server/seat-holdings.ts` (the `coin` kind); `docs/evidence/c7b-canton-coin.md`.
- **Rule:**
  - `CC_RAIL_CAPABILITY` is a constant, `not-live`, not an environment variable: a deployment cannot flip it by accident. The day DevNet proves a real deposit and a real withdrawal with a real wallet, one commit changes that line together with `docs/plan/capabilities.json` (C-DAML-06) and an acceptance row. Until then every seat write refuses before the registry is asked, the command is journaled or anything is signed, and every screen says "Not live" and why. The ops actor is opt-in (`OPS_ACTORS=cc-rail`), never on `all`. `capabilities.json` keeps C-DAML-06, C-MKT-12, C-S19b and C-N52 at `not-live`.
  - **Seats are pooled and recycled; real value must not ride one.** K-224 lets a party pass to the next visitor. The rail therefore treats a live lease as the identity: a transfer or a request created before the party's current lease is rejected back or declined; a seat holding a Canton Coin claim (an allowance, an unanswered request, a transfer in flight) is not recycled (the drain's `coin` kind); and with no database (no leases) the actor fails closed. Before real coin moves, the depositor must be a durable party the user owns (a wallet party such as Grofty's), credited through an explicit link; that is the next step and is not built. On DevNet the coin is worthless and the seat is the depositor, which is why the path can be proved there at all.
  - `/api/holdings` reads the seat's CIP-56 holdings as the leased party (never a query parameter); its client flag `NEXT_PUBLIC_CIP56_HOLDINGS` is off until DevNet proves the read with a real holder.
- **User-visible:** the funds dialog and the funds drawer carry a quiet "Canton Coin · Not live" card that says what the path will do and what it is waiting on, and offers nothing.
- **Approval:** default; overrulable.

### K-150 — The resolver is a governed party; approval by content; no engine change (BitSafe block)
- **Date / owner:** 2026-09-30 · B2 lane (BitSafe add-on)
- **Evidence:** `daml/abu-pm-governance` 0.1.0; `daml/pm-tests/daml/Test/Governance/` (14 Daml Script tests on BitSafe's vendored `governance-core-v1`); `docs/business/bitsafe.md`.
- **Rule:**
  - On LocalNet the market's `resolver` is a Decentralized Party whose committee (3 members, threshold 2) acts through BitSafe's `GovernanceRules`; every proposal implements BitSafe's released `GovernableAction` (`daml/vendor/bitsafe/`, byte for byte). On Noders the resolver stays an ordinary party (the shared sandbox cannot host a Decentralized Party), so the choice is per network and made before markets are listed.
  - Governed actions: record the open print, resolve or void a price Window or an event (the vote names the expected outcome); approve or retire a Series' rules; move the venue mode; appoint or revoke the ops delegate. Nothing on the hot path is governed.
  - Rules are approved by content, not by Series contract id (the roller consumes the Series every Window). The venue applies them with `Rules_Apply` (the engine's `Series_AddPolicyVersion`); a governed open or resolve needs the Window listed under approved rules, so a rotation the venue makes alone can only end in a void. Voids never need approval.
  - Routine price Windows go through a `ResolverDelegation` the committee grants; events never do; any single guardian can hold a market for the committee.
  - `abu-pm-main` stays 0.5.0: `VenueMode` is not read by `Desk_IssueQuote`; the issuer check is ops policy (C-DAML-02).
- **User-visible:** none until the LocalNet demo; a settled market reads the same either way (`Parity.testGovernedSettlesLikePlain`).
- **Approval:** default; overrulable.

## Open questions

None. Every pending choice in the plan has a default, recorded above. Abu overrules any of them by saying so, and the change becomes a new entry.
