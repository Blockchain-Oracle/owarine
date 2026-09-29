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

## Open questions

None. Every pending choice in the plan has a default, recorded above. Abu overrules any of them by saying so, and the change becomes a new entry.
