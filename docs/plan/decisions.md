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

### K-087 — The maker vault (Earn's maker tab) needs three things `abu-pm-main` 0.4.0 does not have (C8 block)
- **Date / owner:** 2026-09-29 · C8e lane
- **Evidence:** `web/src/features/earn/MakerEarn.tsx` renders the reference's not-deployed state because `packages/markets/src/maker/{reads,writes}.ts` are stubs. What the ledger has: `PM.Reserve` gives any reserve id a `NavStatement`, `LpShare`s and firm `SupplyQuote`/`WithdrawQuote`s, so a `maker` reserve could take supplies today. What it lacks is a truthful NAV for a book that quotes pairs:
  1. **No on-ledger NAV for the pair book.** `Earn_PublishNav` (`PM.Tickets.Earn`) counts only ticket contracts (`NavInputs`: reserve cash, LP shares, withdraw quotes, range/parlay/boost quotes and tickets). The maker's capital sits in `Quote` locks (`Quote.daml`, the venue stake locked at issue), in the venue's own `Leg`s after an accept, and in `BuyQuote` locks. Nothing can count those into a statement.
  2. **The pair book's cash is not kept apart.** The issuer's pool locks from `shard` buckets (`services/ops/src/actors/quote-issuer/pool.ts`), and a venue-owned leg is paid into the `payout` bucket (`PM.Leg.payOut`) or `netting` (`Leg_Merge`). The same buckets carry the house side of boosts (`houseTakesSide`), exit buy-backs and seat funding. A venue leg carries `beneficiaryRef = None` (`Quote.daml:201`, `Leg.daml:109`), so a maker leg cannot be told from any other venue leg.
  3. **The issuer does not draw from the reserve.** Quotes lock from venue `shard` cash. For LP money to be what the maker quotes with, the issuer must lock from `reserve:maker` shards, and the proceeds must come back to that bucket.
- **Rule:** the maker tab stays in the reference's not-deployed state (`EARN.notDeployed`), which says so on screen. Nothing is claimed that the ledger cannot show (D-015). Because every missing piece is in `abu-pm-main` (`Quote`, `Leg`), this lane does not change main.
- **Design for `abu-pm-main` 0.5.0 (upgrade-compatible):**
  - `Quote` gains `book : Optional Text` (None = the venue desk, as now). `Desk_IssueQuote` takes the shard's bucket as the book when it is `reserve:<id>`. `Quote_Accept` creates the venue leg with `beneficiaryRef = book`.
  - `payOut` and `Leg_Merge` pay a leg whose `beneficiaryRef` is `Some "reserve:<id>"` into that bucket instead of `payout`/`netting`. `BuyQuote` locks from, and returns to, the same bucket.
  - `abu-pm-tickets` (or a new `abu-pm-maker`) adds `MakerDesk.Maker_PublishNav`. Like `Earn_PublishNav`, it fetches and checks each input: `reserve:maker` cash, open maker `Quote`/`BuyQuote` locks at their locked amount, and maker-tagged venue `Leg`s at their backing until resolved. The auditor observes the statement, as for the ticket reserves.
  - Ops: a second `ShardPool` over the `reserve:maker` bucket (the pool already takes a bucket filter, C8c). The pricer quotes the maker's lanes from it. `maker/{reads,writes}.ts` then read the maker statement and the seat's `LpShare`s, and route `maker-supply` and `maker-withdraw` through the existing Earn lane, the way the ticket reserves do.
- **User-visible:** until 0.5.0, the maker tab shows the reference's not-deployed Earn panel (`EARN.notDeployed`). The range, parlay and boost Earn tabs are live.
- **Approval:** default; overrulable.

### K-088 — Every way a ticket ends leaves a receipt (`abu-pm-tickets` 0.1.2) (C8 block)
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
