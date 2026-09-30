# C9d — seats that free themselves, games through the real app (2026-09-29/30)

Lane C9d follows C9c (`docs/evidence/c9c-games-ux.md`).

Local stack:

- A Canton 3.5.17 sandbox with the JSON API on :7575.
- `bootstrap-local.ts --seats 6 --lanes crypto,regular,token,preipo,basket --join-sec 120 --reveal-sec 60 --pick-sec 480`, giving a 6-seat pool, arena-1 at policy 6, and season `s1` funded with 500 credits.
- Ops ran first as `drive/ops-local.ts`, then as `services/ops/src/main.ts`, which is what quotes stocks (see Lucky). The Alpaca keys were loaded from the main checkout's `services/ops/.env.local` into the process environment only; nothing was copied.
- Web ran as `next build` + `next start` on :3170, with Postgres `pm_c9d`.
- The browser was headless Chrome over CDP with its own profile.

Host conditions:

- Load average ran between 60 and 270 from parallel lanes.
- The host went into idle sleep while on battery at 3% (`pmset` log, 09-30 03:01 +0100). The pause lasted about 6 h (≈ 20:00 → 02:00 UTC).
- Ops exited once with `pass stuck over 10 min in lane-oracles`, and was restarted. Every actor reconciled from the ledger.

## 1. Seats stayed `draining` with nothing to close out (fixed)

**Cause.**

- Only the web's lease route (`recycleDrained`) moved a seat from `draining` to `free`.
- It ran only when the pool had no free seat left.
- It checked the same two seats, in party order, every time.
- Ops' drain saw `3 seats draining: 0 legs to close out, 0 quotes to withdraw`, the C9c log line, but had no step that frees a seat.
- A drive that leases through the store never reached the route at all. Empty seats therefore accumulated in `draining` until the 6-seat pool was full.

**Fix (`d383077`, `7c84dfa`, `3bc89a4`).**

- **Ops recycles every pass (15 s).** For each draining seat, `readSeatHoldings` (new, `@agari/markets/server`) reads what the seat still holds, as the seat. It counts:
  - legs;
  - live quotes: market, buy-back, ticket, Boost exit, Earn supply/withdraw;
  - open Range/Parlay/Boost tickets;
  - Earn `LpShare`s;
  - `DuelOpen`/`DuelMatch` as either player;
  - agent grants, consents and desks.

  A seat that holds nothing has its `VenueCash` withdrawn as its own choice (`drain-sweep:<hash>`). Its `seat_pool` row is then set to `free`.
- **One row lock for both recyclers.** Ops and the web's fallback both go through `@agari/db` `recycleDrainingSeat`. It claims the row `FOR UPDATE SKIP LOCKED` for the whole check. Two recyclers never work one seat at once, and a seat cannot be re-leased and credited while an old sweep is in flight.
- **Earn shares are redeemed.** The drain gets a withdraw quote from the Earn desk and the seat accepts it, so shares cannot hold a seat forever.
- **Legs past `refundAfter` are exited as the seat.** The seat claims against the disclosed Resolution, or makes a stale refund when there is none. This was found live: the host slept through one Window's settlement. `Leg_Settle` is deadline-bound, so the venue can no longer settle such a leg, and only the owner can. Without this the seat would hold it forever.
- **Why a seat is held is recorded.** `drain_note` stores it (for example `1 leg`), and so does the drain's log line. The web fallback now checks up to six seats, least recently checked first.

**Tests.**

- `seat-holdings.test.ts` (5): every holding kind; live versus expired quotes; either duel seat; other parties ignored; both template-id forms.
- `drain.test.ts` (7):
  - an empty seat's cash is swept as the seat and the seat is freed in the same pass;
  - an open leg holds the seat until it settles;
  - a duel, a ticket or an Earn share each hold the seat;
  - a seat another recycler holds is skipped;
  - a failed sweep or a dry run never frees;
  - shares are redeemed, then the seat frees;
  - stale legs are claimed or refunded, then the seat frees.
- `seat-store.server.test.ts` (Postgres, +2): free, hold with a note, reorder, a failed read counts as a hold, and two recyclers are serialised while the seat cannot be leased.

**Live, on the ledger.**

| Seat | What happened | Update id |
|---|---|---|
| seat-3 | Credited 18:41:28; the visitor pressed "Reset seat" at 18:44:30; ops found it empty, withdrew its cash, freed it 18:44:49 (19 s) | credit `1220e931…43e8e9`, sweep `1220efe1ca7c72dfa517bfe49c4e56492d2e3d4f443c07cde0604390c779776377d3` |
| seat-5 | Bet 1.55 on BTC-15m, then reset while the leg was open: drained with its leg closed out at cost, swept, freed within one pass | accept `1220459f1f02f4d5f3a0d9fd1c214955d9e0de34d91520b53d8a2eb6df047a50e816`, close-out `1220640ca8c0cbc23721064ea457b4000addd5379f437de8a5a1d96156a77fc203d3`, sweep `1220460bd70ab98a067a132af8c5921ee33c503110b876cee1ad1005b48d484c091d` |
| seat-4 | Its BTC-60m leg passed refundAfter (20:06Z) while the host slept; `/status` and the drain showed "holds 1 leg"; after the fix the drain claimed it as the seat against the resolution and freed the seat | claim `1220ead443602f1ba923aa5bb6cfebad735dbb4bda7d8f6a621c6987242802865782`, sweep `12203dda848c5335a4780cbb19d508b0e357b6e3eaee6fc731002f7245ad17927ef9` |
| seat-1, seat-2 | The duel seats idled out after the duel and season payout; drained, swept, freed | sweeps `12206c69732f33a1dcb59a1e3f15e0d9ddebb7532933840a075256ec1cac5abe2eea`, `1220750a805c66e84992a35a88180077168e8806e9356f509999e8788ebb0a74e203` |

At the end all six seats were free: `/status` read `6 seats · 6 free · 0 leased · 0 draining`.

## `/status` counts the pool (`4c2f382`)

- **Seat pool row.** A new "Guest seats · pool" row reads the pool table the lease route uses. It shows:
  - total, free, leased and draining;
  - how long the longest-draining seat has drained, and what it holds;
  - waiting visitors.
- **Grading.**
  - Good while a seat is free.
  - Amber when none is free, or when a draining seat's checks have failed for over 5 minutes.
  - Red with no seats at all.
  - Grey (optional) where there is no pool.
- **Seat-drain row.** The seat-drain heartbeat has its own ops row.
- **Live readings.**
  - `6 seats · 3 free · 3 leased · 0 draining`, then `4 free · 2 leased` after the reset.
  - `ops:seat-drain` read `0 seats draining … freed 1`.
- Tests: `rows-canton.test.ts` (+4).

## 2. "1 credits" (`85c23da`, `ce8f93d`)

- **The fix.** `withUnit` in the duel copy applies the reference's own `n === 1 ? "1 x" : "${n} xs"` rule to the collateral name.
- **Where it applies.** Web and phone share the copy:
  - the tier labels;
  - the escrow, per-card, balance and open/join lines;
  - the fill line;
  - the card's stake pill (seen in the drive as "STAKE 1 credits");
  - a receipt's payout.
- **Live.** The UI reads `RANKED 1 credit`, `escrows your 1 credit`, `Up to 1 credit per card`.
- Test: `copy.test.ts` (3).

## 3. Through the real app

### A UI duel, decided (match `0x89fed006…ea747785`)

Two browser seats queued Ranked · 1 credit from the lobby. The creator pressed "Open the match" and the challenger "Join the match". Both swiped both cards: creator Up, challenger Down. The ETH and BTC 15m Windows closed at 19:30Z.

| Choice | Update id | Offset |
|---|---|---|
| Arena_OpenDuel | `1220125813231b27e3e03277cb55d66f54aa048b98b1ba2c4e880e239dc4dd1f078a` | 4994 |
| Open_Join | `1220f7ca4c33dbce64bd5ad3484ec73ac71f01886732fb9edf65c74da9f7ad2f5645` | 4997 |
| Duel_Reveal | `12203d0f6fac9606c1c26c6f62d91572b04f22df55424cfbf588c791fbfbcf4ce18f` | 5000 |
| Duel_RecordPick ×4 | `1220b76d…0d02b2`, `12209ab4…11fc1c45`, `122082a5…33d808a3`, `12203e6b…2a3c18` | 5015–5062 |
| Duel_Score | `12206ca24e12dd5add6051897def9ca9181b4bc98e6fa23ce0da9b2f772d031f1c17` | 5990 |
| Duel_Finalize | `1220efb0c7d4f14930af38d05fc77b5bc83b0be30f8fe11c11494fa55376c48ffbae` | 6089 |

- **Ledger result.**
  - Challenger `6ZFBap…Zo33` won, PnL −1.210784 / +2.162083.
  - Ratings moved 1000→976 / 1000→1024 (`duel_matches.winner` = challenger).
- **Bug found and fixed (`7147604`).** The result screen read "Level — the pot was split", and the room logged `replayed PnL 0/0 disagrees`.
  - Cause: a `DuelResult` keeps no picks, so the room's replay saw empty pick masks and took them for "neither finished".
  - Fix: the result view now carries the ledger's own winner (`decidedWinner`) through the ops wire, and the room uses it.
  - After the fix the page reads **"Won by 6ZFBap…Zo33 on the cards' PnL."** with −1.21 / +2.16.
  - Test: `snapshot.test.ts` (2).
- **First attempt, refunded.** Match `0x90457077…` was refunded after its pick window. Two things went wrong:
  - `ops-local` ran with a relative `NEXT_PUBLIC_AGARI_INDEXER_URL`, so the room could not describe the dealt deck. This is C9c's known requirement: ops needs the absolute indexer URL.
  - The pages lost the stage.

  The second attempt, with the absolute URL, re-snapshotted to both connections and completed.
- **Queue behaviour.** "No deck to deal within the hour" showed briefly while the matchmaker waited for the 19:15 Windows. It is a real queue state, not an error.

### The bet-gated room, placed from its screen

- **Bug found and fixed (`0539460`).** "Join the room" after a real bet answered `No position on this Window for that seat`, and `/api/room/bet` logged `no indexed fill … nothing recorded`.
  - Cause: the gate asks by the seat's **address**, but the projector records the **party**, and nothing ever filled `owner_address`.
  - Fix: the gate now matches a fill to an address that held a lease on that party at the fill's time (`seat_leases`). A recycled party never lets a later or earlier visitor into another's Room. "Ever bet" now reads `idx_fills`, because positions merge the visitors of one party.
  - Test: `social-gate.test.ts` (Postgres, 3).
- **Live, after the fix.** A seat took BTC 15m UP for 1.55 credits from the ticket (`1220459f1f02f4d5f3a0d9fd1c214955d9e0de34d91520b53d8a2eb6df047a50e816`). The web then logged:
  - `[room] bet … indexed fill 1220459f…; registry written`
  - `[room] join … admitted by registry`

  The message "Up on BTC into the close. Placed from the ticket, joined from the room." posted and shows in the sheet (`ux/c9c/room-*`).
- The earlier bet before the fix, `1220c586644b0496553cc30b5ad75be84ad0544f1cb8bdb3985affce199305ab9d00`, is the one that was refused.

### Season payout and remainder, with `scripts/season-admin.ts` through ops

`s1` ends 2026-10-06, and `Season_Distribute` refuses before the end (`deadline-not-exceeded`, checked). So a pool `c9d-1790734520` ending 20 s out was created and funded with 100 credits:

- create `12204883f9de58bae773a98e49e6fee1af033cd40e5310975a3466900dc2c42113d5`
- fund `12208aef962c9284fa774962fdd1e16264fc1c4a32fb786202fc2c08c21ae26abdc8`

```
withdraw   → refused: season c9d-1790734520 has not paid out: the remainder is withdrawn only after the distribution
distribute → paid 2 winner(s) · update 12203d8e679e7bddfe0dbca8f762df0211bee956e2a8017c36461546adfe6dd5b2b0
distribute → refused: abu-pm/already-distributed
withdraw   → withdrew 10000000 base units to the venue · update 1220000cc123d00fd8fa84fbccc5bf364f6aa38539dd9e10f89771ac317b7b304277
withdraw   → refused: no live season pool c9d-1790734520 (never created, or already closed)
```

The payout credited both duel seats in the same update (60 and 30 credits); the seat reads above show `12203d8e…` on seat-1 and seat-2.

### Lucky: owed for the next NYSE open (not placed)

- **At 02:2x UTC** (market closed), spins drew only the 24/7 names, as the reference does: PREDMKTS UP 10×, AILABS UP 25×. Both answered **NO DEAL** ("the venue has no live PREDMKTS Window the book could fill"), because PreStocks answered 429 to every catalogue read (`prestocks-spot … answered 429`). The 60m pre-IPO and basket lanes therefore had no spot to quote on. Nothing was placed; screenshots are `ux/c9c/lucky-nodeal-*`.
- **At 19:1x UTC** (in session), stock lanes were open, but `ops-local.ts` runs only the crypto spot feed, so the pricer said `no fresh spot` for every stock. `services/ops/src/main.ts` did quote stocks: AAPL, AMZN, META, GOOGL, NVDA, MSFT and TSLA 60m and 15m, from RedStone. The host then slept through the session.
- **No crypto fallback.** The reference draws only stocks and the 24/7 PreStocks names, so none was added (as instructed).

Re-run at or after 13:30Z (the NYSE open), once a 5m stock Window is quoting:

```
# sandbox (JSON API 7575) and bootstrap, as above
pnpm --filter @agari/scripts exec tsx bootstrap-local.ts --seats 6 --lanes crypto,regular,token,preipo,basket --join-sec 120 --reveal-sec 60 --pick-sec 480
# ops: main.ts (NOT drive/ops-local.ts), Alpaca keys in the environment, absolute indexer URL for the room
set -a; source <main checkout>/services/ops/.env.local; set +a
NEXT_PUBLIC_AGARI_INDEXER_URL=http://localhost:3170/api/index VENUE_PARTY=<venue> (cd services/ops && pnpm exec tsx src/main.ts)
# web
(cd web && pnpm exec next build && pnpm exec next start -p 3170)
# check stocks are quoting: curl -s localhost:8777/ladders/latest  (AAPL/TSLA/... with state "quoting")
# then /games/lucky → Take a seat → Guest seat → stake 1 → SPIN; a stock draw deals and one tap places it
```

## 4. Screenshots (`docs/evidence/ux/c9c/`)

Each set is at 390 and 1440 px, in dark and light:

- `duel-result-*`: the decided duel's public result, "Won by 6ZFBap…Zo33".
- `rank-*`: the ladder with the winner at #1, 1 verified duel, and the season pool.
- `room-*`: the bet-gated room, joined, with the posted message.
- `lucky-nodeal-*`: the Lucky screen after a fair draw that found no quotable Window (see above). The screenshot of a placed Lucky order is owed with the placement.

## C9b correction

`docs/evidence/c9b-games.md` now shows the two `FAIL seat N leased and funded … "refused"` lines and the run's `2 FAILURE(S)` verdict (`1d44877`). Ops' own log shows the credit landing at 14:15:33, after the drive's 10 s call timeout.

## Gates

`pnpm typecheck && pnpm invariants && pnpm test` on the final tree:

- Typecheck is clean.
- Invariants: 0 errors, 1 warning. The warning is `no-float-money` in `packages/markets/src/desk/canton.ts:57`, which this lane did not touch and which is already on main.
- Tests: 238 files and 1999 tests passed; 5 files and 23 tests skipped. The Postgres-gated files skip without `SEAT_PG_URL`; they were run separately against a scratch database and pass (seat store 9, room gate 3).
- No Daml was touched.

## Gaps (named)

- **Lucky placement from its screen is owed** for the next session, with the commands above.
- **The public result lists the cards as "unplayed".** A `DuelResult` keeps no picks, and the picks are in the projection's `duel_cards`. The winner and PnL are correct. Reading the cards from the projection is a follow-up.
- **`drive/ops-local.ts` has no stock spot feed.** Use `main.ts` for anything that trades stocks locally.
- **Room re-snapshot needs an absolute indexer URL in ops.** A relative `NEXT_PUBLIC_AGARI_INDEXER_URL` in ops breaks the room's re-snapshot, as in C9c. This is a deployment requirement, not a code change.
- **Parallel lanes overload the host.** Under their load, picks and pages were slow and one ops pass stalled for 10 minutes.
