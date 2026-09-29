# C6d Monday Gap, committee events and receipts, 2026-09-29 (local sandbox)

The stack was a Canton sandbox 3.5.17 (dpm 3.5.10 assembly), with the JSON API on :7545. It loaded `abu-pm-main-0.4.0.dar` and `abu-pm-tickets-0.1.1.dar`, and the Daml was not changed. Postgres `pm_c6d` held the projection and was dropped after the run.

Setup was `scripts/bootstrap-local.ts --seats 6 --users alice,bob,outsider --lanes gap`, with a lane-local parties file. It created the nine Gap Series `TSLA-gap … VOO-gap`, the desk, 16 shards and the three ticket reserves.

The real ops process (`services/ops/src/main.ts`) ran with its default actors, `DRY_RUN=0`, the projector on and HTTP on :8747. The web ran as `next dev` on :3140.

No keys were set: no Alpaca, no Pyth and no Jupiter key. So the roller has no session calendar, and the real Gap lanes read `closed: no calendar`.

Drive: `scripts/drive/c6d-gap-events-it.ts`, run 4 (`SOIXX`), **ALL PASS**, 18 checks. The seat was `BN3bpQpsEyYAqixcCWT83Jt5AQgBhCXwQzDLDzZuKpMs`.

## Monday Gap

- **Planner.** On a weekday NYSE calendar the roller's `planGapSeries` names the next real Gap, `10-02 20:00Z–10-05 13:30Z` (lock `10-05 00:00Z`). It will list it from `09-30 20:00Z`, 48 h ahead.
- **Lanes on `/session`.** Ops lists all nine `*-gap` keys, so the web's Gap lane card now has tickers and the "Not listed on the test network yet" plate is gone. With no Alpaca key each lane reads `closed: no calendar`, as the Regular lanes do.
- **Time-shifted Window.** The roller's command, `cmd.openWindowSpan`, opened `TSLA-gap:3` at `nextIndex` via `Series_OpenWindowSpan`: 14:53:00Z → lock 14:57:00Z → 14:58:30Z. This is the Friday → Sunday → Monday order compressed into minutes. `openDeadline` equals `lockAt`, from the Gap policy's open-until-lock rule. Update `12202b7739653580e6acd937913bbabd2aba3c5e4234914c48d7011d3cbb3d9e1964`.
- **Prints.** Both prints came from ops' own lane feeders: RedStone TSLA, attested by the three oracle parties. The open was 354.82873273 and the close 354.47875540.
- **Resolution.** It resolved **Down** in `Terms_Resolve` `122011e02702b3d050ae4cc05ba7c28faff398507c248e9f58de4f900b887c602106`. Earlier runs resolved Up on the drive's fallback prints (run 1) and Down on feeder prints (runs 2 and 3).
- **Pricer.** The Gap basis (`gap-fair.ts`) quoted fair 507 against the reference, and the seat bought 10 Up at 537 through `/api/ledger/quotes` (`122010b5…79b2`). In run 1 the open print was far from TSLAx, and the Gap fair read 20.
- **Range ticket.** A range ticket, inside ±0.1% of the open print, went through `/api/ledger/tickets/range` (`1220018518ee…940b`). It won.
- **Settlement.** Ops' settlers settled both positions.

## Committee events

- **Listing.** `Series_OpenEvent` listed `EVT-C6DSOIXXY:0` ("Will the C6d drive's committee attest YES?", `1220ecba…a216`) and `EVT-C6DSOIXXC:0` ("… agree?", `122080a5…b02c`). Each created MarketTerms, EventTerms and EventState, with no WindowState.
- **Pricing.** The event basis quoted 500 ± 150, and the seat bought 10 YES on each at 650.
- **Attestations.** After the close each oracle party posted an `EventAttestation`. Its `statementHash` is the sha-256 of `{"domain":"agari-event-v1","marketId","question","answer","source","member","attestedAtSec"}`, and the source is named in each statement.
  - YES: YES, YES, YES. `Event_Resolve` resolved **YES** (Up) in `1220faceef1f144199d48d8ad96861d77bba96d944bb2842e2f819756a150b2b2385`. The EventVerdict holds `answer = true` and all three attestations.
  - Conflict: YES, NO, YES. `Event_Resolve` **voided** it as `SourceDisagreement:CloseSlot` in `12207e280dc0204ec33766f9795ff745ee36ca686102d80700049d79f9a666facec4`. The verdict has `answer = null`, and the legs were refunded.
- **Projection.** It holds the questions, both verdicts and all six attestations.

## Receipts (web route, seat cookie)

`GET /api/index/wallet/<seat>/receipts` returned four receipts. A caller without the seat's proof gets 403.

| Market | Product | Recorded | Cost | Payout | Update |
|---|---|---|---|---|---|
| TSLA-gap:3 | range | won; `detail` pick `Inside 35447390400..35518356146`, stake 4.822676, reserve `range`, back to reserve 0 | 4.822676 | 10.000000 | `1220112c…130e` |
| TSLA-gap:3 | (pair leg) | Down, Up leg lost | 5.394864 | 0 | `1220dd67…561c` |
| EVT-C6DSOIXXY:0 | (pair leg) | YES; question on the row | 6.522750 | 10.000000 | `12208816…f484` |
| EVT-C6DSOIXXC:0 | (pair leg) | void; question on the row | 6.522750 | 6.522750 (refund) | `1220978f…9afc` |

Portfolio history reads these through `withReceipts`:
- the ticket gets its own round with the `Range` tag;
- the event rounds read as their question, with YES or NO;
- the receipt sheet shows the ledger breakdown.

## verify-projection (offset 1747)

These templates matched with zero diffs:

| Template | Ledger | Projection |
|---|---|---|
| SettlementReceipt | 10 | 10 |
| EventTerms | 8 | 8 |
| EventState | 0 | 0 |
| EventAttestation | 24 | 24 |
| EventVerdict | 8 | 8 |
| Series | 17 | 17 |
| MarketTerms | 12 | 12 |
| Resolution | 12 | 12 |

One mismatch: PriceQuote has 403 on the ledger against 400 in the projection. The three extra are second posts by the same oracles at `TSLA@14:04Z`. In run 2 the drive's fallback prints and the feeders' prints both landed on that boundary. `idx_prints` keeps one row per (oracle, symbol, boundary) and counts the rest in `duplicates` (3 there). This rule was not changed here. Duplicate posts at one boundary still show as a diff in verify-projection.

## Found during the runs

- Run 3 failed only on "pool-full": the two seats were still leased from earlier runs. Bootstrap `--seats 6` and a web restart fixed it.
- A ±2% range band on a five-minute Window is refused as `NearCertain`, so the drive uses ±0.1% of the recorded open print.
- `/prices/latest` carries TSLA (RedStone) but not TSLAx. The pricer's Gap reference is the Jupiter TSLAx feed inside ops.
