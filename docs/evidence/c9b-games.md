# C9b — games on the ledger (2026-09-29)

Lane C9b wires the duel arena, the season pool, the rank, Lucky and the room onto `abu-pm-games` 0.1.0 (unchanged, never uploaded). Decisions: K-100 to K-104.

## What runs where

| Piece | Where | Ledger |
|---|---|---|
| Deck commitment | `@agari/core/games` `duelDeckPreimage`, `@agari/markets/games` `duelDeckHash` (sha256) | `PM.Games.Deck.deckCommitment`, recomputed by `Duel_Reveal` |
| Matchmaker and room | ops `game-room` (default venue actor set), `matchmaker/` | none (off-ledger pairing, seed ceremony) |
| Deckmaster | ops `matchmaker/deckmaster.ts`: deals from the venue's own ladders, seals, journals, holds the deal in the arena desk | commits under `ArenaTerms.policyVersion` |
| Seat's duel writes | web `POST /api/ledger/games/duel/[action]` → `@agari/markets/server` `createGamesSeat` (actAs = the lease's party only) | `Arena_OpenDuel`, `Open_Join`, `Quote_Accept` (duel tag) + `Duel_RecordPick`, `Open_Cancel`, the player's cranks |
| Venue side | ops `arena-desk` (Canton actor `games`) and `duel-settler` | `Duel_Reveal`, `Duel_Lock`, `Duel_Score`, `Duel_Finalize`, the three refunds, `Season_Distribute` |
| Projection and rank | ops projector `onApplied` hook → `duel-projector/ledger.ts` → `apply.ts` | reads the venue's LEDGER_EFFECTS stream |
| Public reads | web `/api/ledger/games/{state, match/[id], season}` → ops `/internal/games/*` | read as the venue |

## Gates

- `pnpm typecheck && pnpm invariants && pnpm test`: green; 225 test files / 1922 tests passed (4 files / 18 tests skipped, as on main); invariants 0 errors.
- Daml: `dpm build --all`, then `dpm test --files` over the games tests: all 18 games scripts ok. The full suite (`cd daml && dpm build --all && (cd pm-tests && dpm test)`) passes all 159 scripts (155 on main + 4 new).
  - New: `Test.Games.Gate` covers settle once, a mismatched reveal refunding both in full, the free tier, and the pick rules.
  - Existing: `Test.Games.Duel` (conservation, forged reveal, T-1/T/T+1 refunds, forfeit, stale pot, authority, privacy) and `Test.Games.Season` (distributes once, sum bound).
- Differential test: `packages/markets/src/games/commitment.test.ts` reads the golden vector out of `Test.Games.Duel.testDeckGoldenVector` and matches it byte for byte: preimage text, then `b42a4a7b…`.
- The translator test (`duel-projector/ledger.test.ts`) covers the ledger figures: a pick's cost and quantity, payout − cost per score, a forfeit naming the absent seat, the pot awarded, and a cancel refund.

## Drive: two seats duel, the reveal is verified on the ledger, the duel settles, a season pool pays

Local stack: a `dpm sandbox` (Canton 3.5.17) with JSON API on :7575; `bootstrap-local.ts --seats 4 --lanes crypto --join-sec 40 --reveal-sec 30 --pick-sec 90` (creates `ArenaTerms arena-1`, policy 6, tiers free/t1/t5/t10, and a funded `SeasonPool s1`); `drive/ops-local.ts` on :8777 with the room on :8857 and the projector; Postgres `pm_c9b`. Then `drive/games-duel-it.ts` (tier t1: pot 1 credit, per-card cap 1 credit):

```
FAIL  seat 1 leased and funded  {"party":"agari-user-seat-3-mumquzaw","fund":"refused"}
FAIL  seat 2 leased and funded  {"party":"agari-user-seat-4-mumquzaw","fund":"refused"}
PASS  the matchmaker paired the two seats  0x2a17ad26…abe5b0
PASS  the deckmaster sealed a deck and published its commitment  {"hash":"0xd1387095…a883d4","size":2,"policyVersion":6}
PASS  the creator opened the duel (Arena_OpenDuel with the pot)  update 1220fcdf…f6d087
PASS  the challenger joined (Open_Join with the pot)  update 1220b0b5…0dfd63
PASS  the settler revealed the deck and the ledger accepted it (Duel_Reveal checks sha256)  {"tag":"Picking"}
PASS  the revealed preimage reproduces the committed hash off the ledger too  cards ["ETH-15m:1","BTC-15m:1"]
PASS  the client seeds on the ledger are the two the room revealed
PASS  seat creator picked card 0  {"cost":"560467","quantity":"1000"}
PASS  seat creator picked card 1  {"cost":"566460","quantity":"1000"}
PASS  seat challenger picked card 0  {"cost":"964992","quantity":"2000"}
PASS  seat challenger picked card 1  {"cost":"592419","quantity":"1000"}
PASS  the duel was decided on the ledger (DuelResult)  finalized
PASS  the pot moved exactly once: 2 × pot to the winner, or split on a tie  {"pots":["1000000","1000000"],"pnl":["0","0"]}
PASS  the season pool paid its two winners once (Season_Distribute via ops)  1220f32d…79e1946f
PASS  a second payout is refused  abu-pm/already-distributed
PASS  each winner was credited to their seat
PASS  the pool shows it distributed, holding the remainder  amount 10000000 of 100000000
PASS  the venue withdrew the remainder and the pool closed

2 FAILURE(S)  match 0x2a17ad26…abe5b0
```

Correction (C9d): an earlier version of this note left out the two FAIL lines at the top of the drive log and the run's "2 FAILURE(S)" verdict. They are restored above. Both FAILs are the funding reply, not the funding. The drive's `/internal/seats/fund` call timed out after its 10 s budget while ops was busy, so the reply read `refused`. Ops then credited both seats, and its log shows the credit landing: `14:15:33.113 funded agari-user-seat-4-mumquzaw with 1000000000 base` and `14:15:33.137 … seat-3 …`. The drive's own cash line reads `cash before 1000000000 / 1000000000`. Since C9c, the drive checks the seat's cash on the ledger rather than the reply. The run as recorded still exited with two failures.

What ops logged for the match:

- 14:15:36: `2 cards from the 15m lane`.
- 14:15:47: `reveal · both pots are in`.
- 14:15:50 to 14:15:59: the issuer quoted the four picks, each within the 1-credit cap.
- 14:31:04: `voided BTC-15m:1 / ETH-15m:1: MissingPrint(CloseSlot)`.
- 14:31:05: `score · 4 pick(s) on resolved Windows`, and the venue settler paid the eight legs as voids.
- 14:31:09: `finalize · all 4 recorded pick(s) scored`.
- Duel projection: `ladder 1000→1000 / 1000→1000`.

In the projection (Postgres):

- `duel_matches` holds the match, `ranked/t1`, with the two seat addresses as players (never parties), status `finalized` and policy 6.
- `duel_cards` holds the 4 picks.
- `game_ratings` has both seats at 1000 with `verified_matches = 1`. `/games/rank` reads this table.

Because both Windows voided, every leg paid back its cost and both PnLs were zero. The pot split exactly (`Tied`), and each seat's cash ended where it started. The void came from the local oracle stack's missing 15 m close print, not from games. The winning path (Won, 2 × pot to the winner) is proven by `Test.Games.Duel.testDuelConservation`, `testPickLockAndForfeit` and `Test.Games.Gate.testSettleOnce`, and by the translator test.

The first attempt (drive1) paired at 14:04 but was dissolved after the 3-minute deal window. No 15 m Window was quoting yet: the first 15 m Window of a freshly bootstrapped series opens at the next boundary, and 5 m Windows are never dealt (the reference's rule). The drive now waits for two dealable ladders before it queues.

## Lucky and the bet-gated room

- **Lucky.** The placement is the ordinary order lane (a seat accept), so its `txHash` is a Canton update id, which `signatureSchema` accepts. `lucky-settle.server.ts` now measures the placement on the ledger: it reads that transaction as the lease's party and books it from the created `Leg`, falling back to the tape. The verdict still comes from the Window's settlement even when the server cannot read the seat's private tape rows.
- **Room.** `/api/room/bet` and the gate's registry and index steps check the fill by update id, owner address and market in the projection, unchanged; `isSignature` accepts an update id. Not driven in this lane.

## Gaps (open, named)

- The room's re-snapshot after a reveal needs the web's `/api/index` to describe the Windows (`cannot re-snapshot the room: the venue cannot describe every Window`). This happened only in the web-less drive; with the web up, the room's `cardsOf` reads the projection.
- The drive ran against a local stack without the web: it exercised the web routes' server code (`createGamesSeat` with the real seat store and journal), not the Next route handlers themselves. The browser UI was not clicked through.
- The 15 m close prints voided on the local stack (oracle lane), so the drive's duel ended in a void tie. A decisive result on a live stack is still to be recorded.
- `Season_WithdrawRemainder` has no route; it is an admin act (K-104).
