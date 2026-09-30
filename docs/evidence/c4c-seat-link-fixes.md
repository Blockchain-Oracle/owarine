# C4c — seat-link party mapping, three carry-overs, and the security review's seat fixes (2026-09-30)

Lane C4c, branch `slice/C4c-seat-link-fixes` from `main` @ `5288573`. Decision: K-204. It follows C11a (`c11a-ios.md`, the seat link) and C9d (`c9d-seats-games.md`, the carry-overs). Mid-lane, the lead added three findings from a security review (M1, L1, L2), fixed here with tests.

No sandbox was started. The host was loaded (load average 26–54, one `canton-open-source` JVM from another lane). Every item is a code path with a unit or Postgres test. The Postgres tests ran against a database of this lane's own, `pm_c4c` on the local Postgres 16, each in its own schema or tables. The one live step that is owed is Lucky's placement at the NYSE open. Its commands are in §7.

| Commit | Step |
|---|---|
| `3124233` | 1. Every seat key resolves to its party through one helper (joined keys, current lease only) |
| `ea874fa` | M1. A room token names only a wallet the asking seat vouches for |
| `9a225a0` | L2. A drained seat frees only when nothing is in flight and two empty reads agree; the start offset is read inside the lease |
| `d9522b2` | L1. Eight-character link codes, a lock after 25 misses from anywhere, IPv6 limits by /64, and the holder allows every join |
| `215ebf8` | 3. A decided duel's public result lists each card's two picks |
| `4438b4c` | 2. PreStocks at boot: a spread first read, Retry-After honoured, jittered backoff |
| `1987bb2` | 4. A local run quotes stocks from the feeds `main.ts` joins, when the Alpaca keys are set |

## 1. A joined device maps to its seat's party everywhere (`3124233`)

**Before.** After a phone joins a seat by link, its own key is a second address on that lease. A grep for `seat_pool` and address lookups found these paths, each reading `seat_pool.address` on its own:

| Path | What it resolved | Before |
|---|---|---|
| `services/ops/src/actors/agents/session.ts` `partyOfAddress` | a grant's owner label (X link, subscriber) → party | holder key only |
| `services/ops/src/actors/arena-desk/seats.ts` `partyOf` | the duel open and the season payout → party | holder key only, then **a remembered party even after the lease ended** |
| `services/ops/src/actors/arena-desk/seats.ts` `learn` | party → the address a match shows | its own query |
| `services/ops/src/actors/desk-runner/discover.ts` `seatAddressOf` | a discovered desk's party → owner address | its own query |
| `web/src/lib/agents.server.ts` `leasedAddresses` | the registry's creator labels | its own query |
| `web/src/lib/seat-store.server.ts` `byAddress` | the web's seat check, desk, push, index, Lucky | already link-aware, its own SQL |
| `packages/db/src/idx/social-gate.ts` | the Room gate: did this key's seat bet? | lease holders only |

**After.**
- `@agari/db` `seat-keys.ts` has the one resolution:
  - `seatLeaseRowFor(db, address)` and `seatPartyFor`: a key maps only while it holds the party's live lease (`state = 'leased'`), or while it joined that same live lease (`seat_linked_keys.lease_id` = the pool row's current `lease_id`).
  - `seatHolders(db, {parties?, leasedOnly?})`: party → the key that took the lease, the name a seat shows on screens.
- A lease id is never reused. When a lease is released, idle-expired, drained, freed or re-leased, every one of its keys stops mapping at once. A recycled seat's next lease has a new id, so an old device never maps to its next visitor. A key joined to seat A never resolves to seat B.
- All the paths above now call it. The duel directory's `partyOf` no longer falls back to memory when a pool exists; memory stands in only on a bare run with no database.
- **Duel open.** It checks the pairing's creator by party (`partyOf(deal.creator) === party`), no longer by comparing two keys of one seat. A joined phone therefore queues and opens as its seat, and the proved pairing is what the room shows.
- **Strategies list.** The calling seat's own party is labelled with the key that proved it, so a joined device finds its own listings under "yours".
- **Room gate.** A joined key is admitted for its lease's own bets, within that lease's span.
- **K-204** records the rule. Its user-visible edge: a season payout to a player whose seat has since ended is refused. Its party may already belong to the next visitor, so it is never credited to a recycled seat.

**Tests.**
- `services/ops/src/actors/seat-keys.test.ts` (Postgres, own schema, 4):
  - A joined key can grant (`ownerPartyOf`), duel (`partyOf`, and the pin the room shows) and desk (`seatAddressOf`).
  - After the reset, the old key and the old holder map nothing, even though the directory remembers the pairing. After the seat is freed and re-leased, neither old key maps.
  - Seat A's key never maps to B, even after A ends.
  - A pool without the link table still resolves holders.
- `web/src/lib/seat-link-store.server.test.ts` (+1): `byAddress` and `seatPartyFor` agree on every key; the registry labels, with and without the caller; release, then recycle.
- `packages/db/src/idx/social-gate.test.ts` (+1): a joined key enters its lease's Room and never another lease's.
- `services/ops/src/actors/arena-desk/routes.test.ts` (+2): the open passes when the joined key queued; it refuses another seat, and a creator key that no longer maps.

## 2. Security review M1: the duel-room token (`ea874fa`)

**Finding.** `mintFromSignature` checked the key's signature and took the claimed wallet on its word. `readArenaAgent` always answers "absent" on Canton, so `keyIsTheSeats` admitted every socket. Any key could mint a token for a victim's address and then, as the victim:
- join the room and see its snapshots;
- chat, react and relay `pick.pending`;
- post arcade scores.

**Fix.**
- Mint, renewal and score posting now need a seat the request proves: the cookie on web, the signed seat header on the phone.
- `seatVouch(seat)` accepts a wallet only if it is one of three keys:
  - the key that proved the seat;
  - the key that took its lease;
  - a key joined to that same live lease (`byAddress`, the §1 resolution).
- A renewal re-checks the wallet, so a room session never outlives its lease.
- The client sends the seat proof with each request: `seatAuthHeaders()` from `@agari/markets`, on the mint, the renewal and the score.

**Tests.** `web/src/features/games/room-token.server.test.ts` (2):
- Vouched: the seat's own key, its holder, and a key joined to the same lease.
- Refused: another seat's address, an unknown key, and any key when the store read fails.

## 3. Security review L2: recycling and the start offset (`9a225a0`)

- **In flight.** `recycleDrainingSeat` holds a seat while a command it journalled before its release or expiry is still in flight: a `seat_commands` row that is `pending` or `unknown` before its deadline. The note reads "1 write still in flight".
- **Settle.** An empty read now only stamps `drain_empty_since_ms`. The seat is freed by a later empty read at least `RECYCLE_SETTLE_MS` (30 s) after the stamp. A read that finds anything clears the stamp. Every empty read still sweeps, so cash that a late write brought back is swept by the second read. Ops' drain runs every 15 s, so an empty seat frees in two or three passes.
- **Start offset.** `takeSeat` no longer reads the ledger end before the lease is taken. `store.lease` reads it only after its free row is locked. That row was freed only after its final sweep, so the new visitor's history starts after everything the last visitor did. A renewal never reads it.
- **Tests.** `web/src/lib/seat-store.server.test.ts` (Postgres, 11):
  - The C9d cases are updated for the settle window.
  - New: a write in flight holds the seat, and it frees only after its deadline.
  - New: a late write between the two reads restarts the wait.
  - New: the start offset is read once, inside a fresh lease, and never on renewal.

## 4. Security review L1: the seat link (`d9522b2`)

- **Longer codes.** Codes are 8 characters over the same 31 (31^8 ≈ 8.5 × 10^11), shown as `K7M2 QF4H`. The entry on web and phone fits eight cells at 390 px.
- **Global lock.** Every failed redeem counts against every code live at that moment (`failures`). A code that has seen `LINK_CODE_MAX_FAILURES` (25) misses is dead, however many addresses the guesses came from. The holder's screen shows it as expired, with "Show a new code".
- **Per-IP limit.** The join route's limit (10 a minute) counts an IPv6 address by its /64 (`ipBucket`).
- **The holder allows the join.** Redeeming a code only claims it.
  - The holder's screen polls the code and now sees `pending` with the waiting key. Only the holder is shown the key.
  - The screen asks "Allow this device?" with the key's short form, and offers **Allow** or **Not mine**.
  - The answer goes to the new route `POST /api/seat/link/confirm {code, allow}`. Only the lease's own key may call it, and only within `SEAT_LINK_CONFIRM_MS` (45 s) of the claim.
  - Only an allowed key joins the lease. The join request waits for the answer:
    - allowed: the lease, and the cookie on web;
    - refused: 403, "The other device did not allow this one";
    - no answer in time: 410.
- **Both apps.** Web and phone got the card's Allow / Not mine state and a "Not allowed" state. The joining side's button reads "Waiting for the other device to allow this one…". `/dev/seat` shows both new states.
- **Tests.**
  - `seat-link-store.server.test.ts` (Postgres, 6):
    - A claim does not map until the holder allows it.
    - A refusal, a late answer, and an answer from another seat's holder never map.
    - 25 misses lock a live code, and a code shown after them starts clean.
    - The existing cases now use the allow step.
  - `seat-link.server.test.ts`: 8-character codes.
  - `client-ip.server.test.ts` (+2): IPv6 /64 buckets, including bracketed, zone-id and IPv4-mapped forms.

## 5. Duel result cards read "unplayed" (`215ebf8`)

- **Cause.** A `DuelResult` keeps no picks. The projector writes every pick to `duel_cards`, but nothing read them back for a decided match. The public result on web and phone (`DuelPublicResult`) therefore listed every card as "unplayed", even though the winner and PnL were right.
- **Fix.**
  - `@agari/db` `readDuelPicks(matchId)` reads a match's projected picks. Each pick's seat comes from its own key (`chain:match:card:seat`), not from an address.
  - `@agari/markets` `withProjectedPicks` puts those picks, and the masks they imply, on the decided view. The ledger's PnLs and winner are left as they are.
  - The arena desk's match read applies it. If the projection is unreadable, the result still shows, from the ledger's figures. Web and phone read the same view, so both lists fill.
- **Tests.**
  - `services/ops/src/actors/game-room/snapshot.test.ts` (+2):
    - The C9d duel's four picks give both players' picks on each card and full masks. The room's replay agrees with the ledger, with no warning.
    - An open card is picked but not settled. Off-deck picks are dropped. A match with no projected picks is unchanged.
  - `packages/db/src/games-picks.test.ts` (Postgres): seats from keys, payouts, any spelling of the match id.

## 6. PreStocks 429 at boot (`4438b4c`)

- **Cause.** PreStocks rate-limits this host at boot (C6, C6e, C9d), and the pre-IPO and basket lanes read `paused` for minutes. Every ops process that booted together read the catalogue in the same second. A 429 then backed off in lockstep: 30 s doubling, with no jitter and no `Retry-After`.
- **Fix.** The reference's fetcher semantics (`packages/markets/src/runtime/transport.ts` @ `661a24ee`): wait the server's `Retry-After` when it sent one, otherwise a jittered backoff.
  - `fetchPreStocks` throws `PreStocksHttpError` carrying `retryAfterMs`, read as seconds or an HTTP date.
  - The feed waits that `Retry-After` when one came. Otherwise it waits the 30 s → 5 min step with equal jitter: half the step, plus a random part of the other half. It never waits past 5 min.
  - The first read waits a random part of `PRESTOCKS_BOOT_SPREAD_MS` (default 15 s).
  - It logs one line per failing streak, naming the wait. `main.ts`'s boot line says so too.
- **Tests.**
  - `services/ops/src/prices/prestocks-429.test.ts` uses a fake catalogue: first a 429 with `Retry-After: 2`, then a bare 429, then the catalogue. The real `fetchPreStocks` and the real feed loop ran, with only the clock injected. The waits were 5 s (the boot spread at random 0.5), 2 s, 45 s (the jittered 60 s step), then the base poll, and every pre-IPO name was priced.
  - `nextDelayMs` covers the jitter bounds and `Retry-After`, including its cap.

## 7. Lucky in session (`1987bb2`)

- **The gap.** `drive/ops-local.ts` ran only the crypto spot feed, so a local stack could not quote a stock Window. In session, Lucky draws `LUCKY_ASSETS`: the launch tickers, OPENAI and the five baskets.
- **The fix.** `services/ops/src/prices/local-spot.ts` always starts the crypto feed. If `ALPACA_KEY_ID` and `ALPACA_SECRET_KEY` are in the environment, it also starts the equity spot (RedStone; Alpaca for QQQ and VOO; Pyth with a key) and the PreStocks catalogue, joined as `main.ts` joins them. Without the keys it stays crypto-only and logs why. There is no crypto stand-in for a stock; the reference has none. `ops-local.ts` uses it, and serves `/prestocks/latest`.
- **The rest of the in-session path, read in code (`web/src/features/games/lucky/lucky.server.ts`).**
  1. `stocksTrading()` sees a trading `regular` Window, so policy 3 draws from `LUCKY_ASSETS`.
  2. `eligibleLuckyWindows` keeps trading Windows of the drawn asset with at least 120 s left. It **excludes the 5-minute cadence** (`LUCKY_EXCLUDED_INTERVAL_SEC`), so stock draws deal 15m or 60m Windows. C9d's note to wait for "a 5m stock Window" is corrected here.
  3. `freshQuoteStake` reads the pricer's ladder, which now has stock spot.
  4. The deal places in one tap.
- **Test.** `local-spot.test.ts` (2):
  - With the keys: all three feeds run, and stock, pre-IPO and crypto quotes each come from their own source.
  - Without the keys: crypto only, no stock quote, and the summary names the variables.

**Owed: the live placement from `/games/lucky` at or after 13:30Z (NYSE open).** Re-run commands, with key names only:

```
# 1. sandbox (JSON API :7575) and bootstrap with the stock and 24/7 lanes, as C9d
pnpm --filter @agari/scripts exec tsx bootstrap-local.ts --seats 6 --lanes crypto,regular,token,preipo,basket --join-sec 120 --reveal-sec 60 --pick-sec 480

# 2. ops: the Alpaca keys (ALPACA_KEY_ID, ALPACA_SECRET_KEY) into this process's environment only, from the main checkout
set -a; source /Users/abu/dev/hackathon/hackcanton-pm/services/ops/.env.local; set +a
LEDGER_JSON_API_URL=http://localhost:7575 AGARI_PARTIES_FILE=<the bootstrap's parties file> DRY_RUN=0 \
  OPS_INTERNAL_SECRET=<the web's> ROOM_TOKEN_SECRET=<the web's> DATABASE_URL=postgres://localhost/<db> \
  NEXT_PUBLIC_AGARI_INDEXER_URL=http://localhost:3170/api/index \
  caffeinate -dimsu pnpm --filter @agari/scripts exec tsx drive/ops-local.ts
#    its "[ops]" line must read: crypto, equity (RedStone, Alpaca) and PreStocks spot, as main.ts joins them
#    (services/ops/src/main.ts still works too, as in C9d)

# 3. web on :3170, same DATABASE_URL and secrets
(cd web && pnpm exec next build && pnpm exec next start -p 3170)

# 4. before spinning: a stock 15m or 60m Window is quoting (5m Windows are not Lucky's)
curl -s localhost:8777/ladders/latest   # AAPL/TSLA/... 15m or 60m with state "quoting"
curl -s localhost:8777/prestocks/latest # OPENAI and the baskets priced (else the 429 backoff is waiting; see its heartbeat)

# 5. /games/lucky → Take a seat → Guest seat → stake 1 → SPIN; a stock draw deals and one tap places it.
#    Record the accept's update id and the settle, and screenshot lucky-placed-* at 390 and 1440 in both themes.
```

## Gates

On the final code tree (`1987bb2`):

| Gate | Result |
|---|---|
| `pnpm typecheck` | clean in all 10 projects that have one |
| `pnpm invariants` | 0 errors, 0 warnings (`no-party-from-request` and `mobile-bundle-reach` included) |
| `pnpm test` | 263 files passed, 9 skipped; 2,138 tests passed, 39 skipped |
| `pnpm --filter @agari/mobile typecheck` | clean |

The Postgres suites skip without `SEAT_PG_URL`. They were run separately against `pm_c4c`, all green:
- `seat-keys` 4
- `seat-link-store` 6
- `seat-store` 11
- `social-gate` 4
- `games-picks` 1

No Daml was touched.

## Gaps (named)

- **Lucky's live placement** at the NYSE open (§7).
- **No live pass for the seat changes.** No sandbox ran in this lane, so none of the seat changes was exercised end to end with two real devices: the Allow step, a joined phone's duel, the settle window. Owed on the next local stack:
  - web holder + phone joiner: the code, Allow, the joined phone grants, duels and desks;
  - a refused join;
  - a reset, after which the phone maps nothing.
- **A season payout to a seat that has ended is refused** (K-204). A player who left before the season closed has no party of their own to pay. Paying them needs an address-held balance, which is a product decision for C9/C13, not a seat fix.
- **A joined phone's pairing is shown until ops restarts.** A match the joined phone queued for shows the phone's key because the directory pinned it at the open. After an ops restart the directory re-learns the holder's key for that party, so the joined phone's room would refuse it until it re-queues. The ledger itself is unaffected.
- **Security fixes skip the reference's model.** M1 and L1 now require a proven seat for a room token and a holder's Allow for a join. The reference's `hello` trusted the claim, because its arena named the key on chain; Canton has no such record, so a seat must vouch.
