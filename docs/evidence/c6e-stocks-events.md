# C6e stock lanes, events on the board, prints and retract, 2026-09-29

Decision: K-070. The keys are in `services/ops/.env.local`, which is gitignored and mode 600. It holds `ALPACA_ENDPOINT`, `ALPACA_KEY_ID`, `ALPACA_SECRET_KEY` and `FINNHUB_API_KEY`. Values never appear here or in a log.

## 1. Ops loads its env files

`services/ops/src/runtime/load-env.ts` is the first import of `main.ts`, `runner-main.ts` and `scripts/drive/ops-local.ts`. It loads `services/ops/.env.local`, then the root `.env.local`, which is the file the reference's `ops:start` passed with `--env-file-if-exists`. A variable that is already set is never overridden, even an empty one. Ops logs the file and the number of names it took, never the values. Test: `load-env.test.ts`.

## 2. Stock lanes with the calendar, and the sources that were missing

### Source check in session (no ledger)

Run: `pnpm --filter @agari/scripts exec tsx drive/c6e-sources.ts`, at 16:21Z on Tue 09-29. It uses the session service, the roller's Gap planner and the lane feeders' own reader.

```
env files: services/ops/.env.local (4 names)
calendar: calendar 2026-09-22..2026-10-13: 11 sessions ahead
session now: Closes 16:00 ET
  2026-09-29 13:30Z → 20:00Z · 09-30 · 10-01 · 10-02 · 10-05 (13:30Z → 20:00Z each)
gap TSLA: wait · 10-02 20:00Z–10-05 13:30Z · waiting: lists 09-30 20:00Z for 10-02 20:00Z–10-05 13:30Z
gap QQQ:  wait · 10-02 20:00Z–10-05 13:30Z · waiting: lists 09-30 20:00Z for 10-02 20:00Z–10-05 13:30Z
gap VOO:  wait · 10-02 20:00Z–10-05 13:30Z · waiting: lists 09-30 20:00Z for 10-02 20:00Z–10-05 13:30Z
print attested:alpaca:QQQ     @16:22:00Z: 736.8100 (IEX trade at T−11s; payload sha-256 6a323efe6c02e8df…)
print attested:alpaca:VOO     @16:22:00Z: 701.5250 (IEX trade at T−17s; payload sha-256 015a55080f285736…)
print attested:redstone:TSLA  @16:22:00Z: 353.3938 (RedStone median of 5; payload sha-256 3a914c3eca0ff5c1…)
print attested:jupiter:TSLAx  @16:22:00Z: 353.7956 (median of 3 samples; payload sha-256 4050e3e92a1896d8…)
print attested:jupiter:NVDAx  @16:22:00Z: 230.1148 (median of 3 samples; payload sha-256 e3916b8a3312a0a6…)
print attested:jupiter:SPYx   @16:22:00Z: 763.1736 (median of 3 samples; payload sha-256 42a5cac8bf02e820…)
print attested:jupiter:QQQx   @16:22:00Z: 737.5518 (median of 3 samples; payload sha-256 3b2fa57c2c3d16b5…)
```

- **Calendar.** Alpaca's calendar agrees with the Pyth schedule, with no disputed dates. Before C6e, every Regular and Gap lane read `closed: no calendar`.
- **Monday Gap.** The planner names the real next weekend, 10-02 20:00Z → 10-05 13:30Z, locking 10-05 00:00Z. It lists at 09-30 20:00Z, 48 h ahead. QQQ and VOO take the new Alpaca version, so their Gap is no longer paused.
- **QQQ and VOO** now settle on Alpaca, the last IEX trade in [T − 300 s, T]. Their reference source, the Pyth trial, ended 09-25.
- **xStocks** now settle on the Jupiter median. Switchboard Surge still answers `IPFS fetch temporarily unavailable for CID bafkreieg5kwr…` (checked 15:08Z).

### Still unavailable (recorded, not hidden)

- **Valuation OPENAIV / ANTHROPICV.** These need a `PYTH_API_KEY` entitled to `pyth-indices` (D-125). No such key exists, and Alpaca and Finnhub carry no private-company index. The lanes stay unregistered, as in C6.
- **Switchboard Surge.** Still down. The token lanes' v1 stays on the Series, and a Switchboard version is appended when Surge signs again (K-070).

### On one sandbox, in session (16:59–18:20Z)

The stack was a Canton sandbox 3.5.17 (dpm 3.5.10 assembly), JSON API :7545, with `abu-pm-main-0.4.0.dar` and `abu-pm-tickets-0.1.1.dar` built in this worktree (Daml unchanged). Postgres `pm_c6e` held the projection and was dropped after the run.

- **Bootstrap:** `bootstrap-local.ts --seats 4 --users alice,bob,outsider --lanes regular,gap,token,crypto --no-games`, with a lane-local parties file.
- **Ops:** the real `services/ops/src/main.ts`, default actors, `DRY_RUN=0`, HTTP :8747. **No key was passed on the command line.** The boot log reads `env file …/services/ops/.env.local: 4 variable(s) taken (explicit env wins)`.
- **Web:** `next build` + `next start` on :3140.

**Sources (`/session.sources.attested`):** redstone ok · alpaca ok · jupiter ok · switchboard down (IPFS) · pyth down (no key) · pyth-index down · prestocks and basket down (PreStocks answered 429 to this host at boot, as in C6).

**`/session`, first roller pass (17:05Z).** Label "Closes 16:00 ET". Every Regular lane and every token lane was open:

- `AAPL/AMZN/GOOGL/META/MSFT/NVDA-5m/15m/60m`: `open #1 17:00–… v1 attested` (RedStone).
- `TSLA-*`: v2 (RedStone).
- `QQQ-*` and `VOO-*`: **v2 (Alpaca)**.
- `TSLAx/NVDAx/SPYx/QQQx-*`: **v2 (Jupiter)**.
- The nine `*-gap` lanes: `waiting: lists 09-30 20:00Z for 10-02 20:00Z–10-05 13:30Z`.

Before C6e these read `closed: no calendar` (Regular and Gap) and `paused: no signed source` (xStocks, QQQ, VOO).

**Resolved on attested prints.** Three oracles posted each print. Resolutions are signed by the resolver and the venue.

| Window | Source | Open → close | Result | Resolution update |
|---|---|---|---|---|
| QQQ-5m:1 17:00Z | `attested:alpaca:QQQ` | 736.16 → 735.895 | Down | `1220d7b79d4a68e04f4056e2eec06ac9984cf2d66cbe41c0687e70aaf809dd250c47` |
| VOO-5m:1 17:00Z | `attested:alpaca:VOO` | 701.35 → 701.06 | Down | `1220ce786a91e6f72f12013b988fc4e8d6f77b23a12091b7d25b08278582f1f18186` |
| QQQ-5m:2 17:05Z | `attested:alpaca:QQQ` | 735.895 → 735.965 | Up | `1220ec30b6c77729ae8334e974bbe72dbd47dbd8c85294e02ece6652885cab8e9b98` |
| TSLA-5m:1 17:00Z | `attested:redstone:TSLA` | 352.0908 → 352.2968 | Up | `1220255fedeeee905331a982fc03b2242bbe8e75b539814770cde9b801947eafa4f9` |
| NVDA-5m:1 17:00Z | `attested:redstone:NVDA` | 229.5513 → 229.3706 | Down | `12203218fb0facdd1d048ec6a791fbae391051803d3f13c7c0af602e0dbe15f834e0` |
| TSLAx-5m:2 17:05Z | `attested:jupiter:TSLAx` | 352.4292 → 352.1862 | Down | `12205891bd5d56148668159453a6691c040d7579f78ceea17999a4f62ddff0fc01bf` |
| QQQx-5m:2 17:05Z | `attested:jupiter:QQQx` | 735.4549 → 735.7764 | Up | `122009216480fc588f7e64b5a8c1fed289f46606cdf9acad696f9c4d6f4b8988b87a` |
| SPYx-5m:2 17:05Z | `attested:jupiter:SPYx` | 762.5043 → 762.5729 | Up | `12203cb4e2a71bddf4635e5ef02286ecf3d8f46055b215c00673fc33c08d87c39326` |
| NVDAx-5m:2 17:05Z | `attested:jupiter:NVDAx` | 229.4152 → 229.3415 | Down | `1220dce56f220c17cd3d562f347d413b3bc467fe0f5cf8da96feea1ac87f084d0332` |

AAPL, AMZN, GOOGL, META and MSFT resolved the same way at 17:05Z and 17:10Z. Their updates are in the projection's `idx_markets.resolved_update_id`.

The xStock Windows starting 17:00Z **voided** `MissingPrint(OpenSlot)`. Ops had started at 16:59:57, so the Jupiter feed held no sample at T − 40. This is the honest outcome: a missing point is never attested. Every xStock Window from 17:05Z printed and resolved.

**The real Monday Gap on the ledger.** The roller lists a Gap 48 h ahead, which is 09-30 20:00Z. To list it inside this run, ops was restarted once with the roller's own `ROLLER_GAP_LEAD_SEC=345600`. Every actor resumed from the ledger. The roller then opened all nine through `Series_OpenWindowSpan` at the real calendar's boundaries: **10-02 20:00Z → lock 10-05 00:00Z → 10-05 13:30Z**.

| Gap | Version | Open update |
|---|---|---|
| TSLA-gap:0 | v2 `attested:redstone:TSLA` | `1220a8884d6718471b617970a29ab21f9f69ba31366d25440ab52c36469d39f332db` |
| QQQ-gap:0 | v2 `attested:alpaca:QQQ` | `1220e4d313afafbe0c36e545b65785ab634bbc2a178b651ade4676c24703a304b906` |
| VOO-gap:0 | v2 `attested:alpaca:VOO` | `12202b52d5ea439dbdf6d0a9a385c7483bf20eb9c4199efe2e4bd4a660377c256c69` |
| NVDA-gap:0 | v1 `attested:redstone:NVDA` | `122038abef247399ebd3a79e2e4326e8e5f11ba108084f3ee07673f09c53880ea36a` |
| AAPL-gap:0 | v1 `attested:redstone:AAPL` | `122045fe0a1dbc4d2bbbb81fac509944363e84eadb5b286791812178cc6a00a8f842` |
| MSFT / META / AMZN / GOOGL-gap:0 | v1 RedStone | `122087b5…a70d`, `1220d726…84dd`, `12205de9…cc8f`, `122049ee…3d4a` |

**Earnings and halts.** The earnings actor read Finnhub with the key, 7 stocks, with no report in 09-29..10-13 (`/session.earnings = []`, known "none" rather than null "unknown"). No halts were recorded (`/session.halts = {}`).

## 3. Committee events on the board

- **Listed:** `committee-event.ts create`.
  - `EVT-C6E-QQQ:0` "Will QQQ end today's session (Tue 29 Sep) above 735?", 17:04Z → 20:11Z, lock 20:01Z. Update `12205d1170be9a0947c84721c7931e1786b1958de5c0e74cb212ed9d432720e1ea89`.
  - `EVT-C6E-TSLA:0` "Will TSLA trade above 350 when this event closes?", 17:04Z → 17:24Z. Update `1220c13e8d8ce7a996db9d89452fa8611e05b3b8f51cc88bbb2f95c5ae391ccc459d`.
- **Board.** `/markets` §03 "Events" lists both events from the lane set's `events`, the same market stream as the lanes. Each is a word card (`wq-*`) with YES 65¢ / NO 65¢ from the pricer's even-odds ladder (K-067). The phone shows the same §03 with its own word-card kit, `mobile/src/features/markets/events/`; it is typechecked but not run on a device here.
- **Placed from the board (browser, guest seat `8wso…nMeY`).**
  - Tapping **YES** on the QQQ card selected the event into the hero and the ticket.
  - The ticket read Yes/No, with range and leverage off.
  - One requote ("fills up to 9.78 credits at this size") was taken as "use all the book can fill".
  - **Call placed:** 14 lots YES, stake 9.13, 14.00 if it lands. Leg update `1220a083d1ec07cacb9769fbb7efea79ca3890cf1787887d6f76a8433ff8246e183a`.
  - The placed card reads "▲ CALLING YES · <question> · Wins if the committee attests YES."
- **Its own page.** `/markets/<id>` renders the event hero (question, clock to the lock, how it settles) with the same ticket: `ux/c6e/05` and `07` at 1440, `06` at 390.
- **Resolved.** After the TSLA event closed, the three members attested YES. Each statement names its source, "Alpaca market data, TSLA last IEX trade at or before 2026-09-29T17:24:00Z: 352.33". Attestation updates: `122036cc…abb4`, `1220d430…8b18d`, `12200eb8…c92f`. The resolver logged `resolved event EVT-C6E-TSLA:0 YES (YES,YES,YES)`, with Resolution update `1220bb9ace355e6e8d5996d34607ed409a4ffe92f89453f2b3792e9376d39f08d9f7`.

Found and fixed during the run:

- **Selecting an event fell back to a price Window.** `findMarket` searched the lanes only, so the hero took the fallback and the ticket's no-entry advance rewrote the URL. It now searches `LaneSet.events`.
- **The event page crashed** (`reading 'xstock'`). A 24/7 event reached `tokenLaneAsset`, `spotSymbolOf`, `laneListable`, `corporateActionFor` and the source-line helpers, which index the registry. They now treat an asset outside the registry as pricing nothing.
- **The event hero's body sat flush to the panel edge, and the card meta wrapped at 390.** Both are fixed in `styles/event-board.css`.

Screenshots in `ux/c6e/`:

- `01`/`02` the board's Events at 1440, dark and light.
- `03`/`04` the same at 390.
- `05`/`07` the event page at 1440, dark and light.
- `06` the event page at 390, light.
- `08` the live stock lanes in session (15m tab), 1440 dark.

## 4. Duplicate prints: projection and verify agree

Rule (K-070): every `PriceQuote` is its own `idx_prints` row, keyed by contract id. Per (oracle, symbol, boundary), `chosen` is the quote a resolution cited (`evidence`), else the resolver's rule (earliest fetch, then lowest price).

- At offset 5170: `verify-projection` **OK, zero diffs**, PriceQuote 648/648.
- Then oracle-coinbase posted a **second quote for QQQ @17:45Z**, fetched 30 s later and 0.01 higher, in update `1220588d7480a54d070e9fafe9fc68ca1f2edd0fc12c494e7e9b278e61a3e9a562e5`. That is C6d's duplicate shape.
- The projection kept both rows. The original stayed `chosen = true, evidence = true, duplicates = 1`, because the OpenPrint had cited it. The new one is `chosen = false`.
- At offset 5288: `verify-projection` **OK, zero diffs**, **PriceQuote 661/661**. In C6d the same shape read 403 against 400.
- A run between the two, at offset 5269, reported 4 transient mismatches while the 17:50Z boundary's opens were being applied. The next run was clean.

Test: `packages/db/src/idx/prints.it.test.ts` (Postgres). It covers ranking, evidence pinning, retire and replay order.

## 5. Retract per product

`retractCall(…, { marketId, product })`: null means pair legs (the default), a product means that ticket's publications. `DELETE /api/ledger/publications` takes `{ marketId, product? }`, and `PublishCall` passes its ticket's product. Test: `packages/markets/src/server/publish.test.ts`, "retracts one product on a Window". A pair-leg retract takes only the pair leg, a range retract only the range publication, and another product or Window sends no command.

## Still owed or unavailable

- **The phone app** was not run on a device or simulator. `mobile` typechecks with the §03 board, event card, event hero and the ticket's Yes/No.
- **Valuation lanes** need an entitled `PYTH_API_KEY`.
- **Switchboard Surge** is down (see §2).
- **PreStocks** answered 429 to this host at boot (a rate limit, as in C6), so pre-IPO and basket lanes read `paused` until it answers.

Cleanup: ops, web and the sandbox were stopped by PID and port; `pm_c6e` and `pm_c6e_test` were dropped; `web/.next` was removed.
