# C9c — games: the missing print, a decisive duel, the real app (2026-09-29)

Lane C9c follows C9b (`docs/evidence/c9b-games.md`). Decision: K-105. The lane stopped early because free disk fell to 1.9 GB at 16:43 UTC. The lane's rule is to stop under 3 GB. Everything the lane started was shut down, the `pm_c9c` database was dropped and `web/.next` was removed. What was left undone is listed under "Open".

## 1. The missing 15 m close print (fixed, `fix(C9c.1/oracles)`)

- **Cause.** The C9b drive's two 15 m cards voided with `MissingPrint(CloseSlot)`. The host went into idle sleep from 14:26:10 to 14:30:39 UTC (the `pmset -g log` Sleep and Wake entries). The ops log has the same gap.
- **What the feeders did on wake.** They reached the 14:30 boundary at T+39 and dropped it (`missed @1790692200: past T+35s`). The give-up limit, `GIVE_UP_SEC = 35`, was sized for the 1-minute lane, whose close admits prints until T+40. But the 5 m and 15 m closes at that same T admit until T+60 (`scripts/bootstrap-local.ts` `cryptoLanes`). A print posted at T+39 would have counted, and the resolver voided at 14:31:04.
- **Fix.** The feeders now give up at `WIDEST_ADMISSION_SEC - 10` (T+50). The 10 seconds leave the resolver time to act before the deadline. A late print does not count for a 1-minute Window, and no Window can be harmed by it.
- **Tests.** `oracle-feeder.test.ts`: a wake at T+39 posts; a wake at T+51 gives up and posts nothing.
- **Result.** In this lane's run, every 15 m close printed and resolved on 3 oracles:
  - `resolved BTC-15m:1 15:30Z Up 82963.31 → 83156.5`
  - `resolved ETH-15m:1 … Up`
  - the 16:00 closes likewise.

  Drives now run under `caffeinate -dimsu`.

## 2. A decisive duel on the ledger (`scripts/drive/games-duel-it.ts`, tier t1)

The duel was match `0xf92a6ba33f2e155ec41f17fc7c93f0ce6a34811d895f9c513b3db691e36d9e57`, dealt ETH-15m:1 and BTC-15m:1.

- **Picks.** The creator picked Up on both cards; the challenger picked Down.
- **Resolution.** Both Windows resolved Up.
- **Ledger result.**
  - `DuelResult` finalized with PnL creator +591816 and challenger −1728234 (base units).
  - The `duel-pot` bucket holds 2000000 for the creator and 0 for the challenger: the winner has both pots, so the loser's pot moved to the winner.
  - Cash went from 1000000000 / 1000000000 to 1001591816 / 997271766.
- **Rating.** `game_ratings`, which `/games/rank` reads, moved to 1024 for the winner and 976 for the loser, each with `verified_matches = 1`.
- **Checks.** Every check in the drive passed, including the new ones: decisive, PnLs differ, ratings moved.

Update ids (venue stream, LEDGER_EFFECTS):

| Choice | Update id | Offset |
|---|---|---|
| Arena_OpenDuel | `122009fdb82f39b892529cb80718583a633eb833fc5ea866bf05d81eb68f2132dc27` | 765 |
| Open_Join | `12209a9be64cc07e18b8fbd854cf1b1e57b6090345fa2cafc2ee6fc96a8339234af4` | 768 |
| Duel_Reveal (sha256 checked) | `12203a73a0db3e72d62f745e50b3e7158019e295dc293decce2ea86e84f9a5f50565` | 771 |
| Duel_RecordPick ×4 | `122002fc…b6da618`, `1220f91d…1d98a6`, `12207ae6…fb755d`, `1220e15d…75af64` | 780–816 |
| Duel_Score | `1220f8b77c73d373f1615edba4c4e9d65e201637fafec2f3cb538dea5aeaa755308a` | 1435 |
| Duel_Finalize (DuelResult) | `12206ce0cda381569be8ee17b53dad3aaf81694553089c2a42f847d53e7f1adbd2cb` | 1443 |

The drive's own read of these ids failed on the first run: `/v2/updates` over about 1000 offsets returns an error object, not an array. The ids above were read with the same query, split into 200-offset pages. The drive now pages too.

This first run then stopped before its season step, so the season payout and the withdrawal through the new route did not run on the ledger in this lane (see "Open"). The second drive, on tier t5, found the seat pool full and did not start.

## 3. Through the real app (web `next build` + `next start` :3170, headless Chrome over CDP)

- **Browser.** The chrome-devtools MCP opened pages, but another session restarted its browser and the pages closed. The lane switched to its own headless Chrome (`--remote-debugging-port 9371`), with two isolated browser contexts as two seats.
- **Seats.** Guest seats were leased and funded (1,000 credits each) from the seat dialog.
- **Queue and match.** Both seats queued Ranked · 1 from the duel lobby. The creator pressed "Open the match" and the challenger pressed "Join the match" (`Arena_OpenDuel` and `Open_Join` from the UI).
- **First attempts failed after the reveal.** The room could not re-snapshot a revealed match: "the venue cannot describe every Window in this deck".
  - Ops resolved `/api/venue/facts` against `127.0.0.1:$PORT`, which is not the web.
  - Fixed in `fix(C9c.3/room)`: ops takes the web's origin from the absolute indexer URL.
- **After the fix, the live re-snapshot works.**
  - Ops logged `revealed; re-snapshot sent to 2 connection(s)`.
  - The challenger's screen moved from "Join the match" to the picking stage without a reload.
  - Both seats picked from the swipe deck, challenger Up and creator Down (4 × `picked`, then `locked`), on match `0xc232cc29c3e8cbf129625cf0183ba0ddfd441be0e30bc6a39605c9452b1aa67f`.
  - Its Windows closed at 16:45 UTC. That was after the disk stop, so this UI duel's result was not seen.
- **Refunded matches now say why.** Two earlier UI matches ran out of pick time on this overloaded host (load average 15–35 from parallel lanes) and were refunded. Each read "withdrawn before anyone joined". The view now carries the ledger's refund reason, and the page says "Neither player finished their picks, so both pots were returned."
- **Creator's lobby line.** After opening the match, the creator was told "Waiting for the other player to put the match on the ledger" (a reference bug). Web and phone now say "Your match is on the ledger. Waiting for the other player to join."
- **Pick window.** To give browser play enough time, the local arena's windows were widened with `Arena_Update` (join 120 s, reveal 60 s, pick 480 s). This was a local-stack setting only; the bootstrap defaults are unchanged.
- **Lucky.** Opened, stake set and spun five times from its screen.
  - Every draw was a stock (PREALL, PREDMKTS, AILABS, FRONTIER): the reels draw stocks, as the reference does.
  - The local stack had only crypto lanes, so the deal answered "NO DEAL … the venue has no live … Window" and nothing was placed.
  - Adding the stock lanes (`bootstrap-local --lanes regular,token,preipo,basket`) failed with a sandbox 503. Then the disk stop came.

## 4. Season remainder (K-105, `feat(C9c.4/season)`)

- **The route.** `POST /internal/games/season/withdraw {seasonId}` is HMAC-signed like every internal route and exercises `Season_WithdrawRemainder` once. Ops refuses it before the distribution.
- **Not seat-reachable.** No web route forwards it or the distribute call. A test scans `web/src` for either one.
- **The admin's tools.** `withdrawSeasonRemainder` in `@agari/markets/games` and `scripts/season-admin.ts withdraw --season <id>`.
- **After a close.** The withdrawal archives the pool, so ops records the closure (`season_closures`; in memory without a database). The desk's season read then answers the drained pool (distributed, balance 0), and the rank still reads "the pool has paid out".
- **UI.** The reference has no admin UI, so none was added.
- **Tests.** `arena-desk/routes.test.ts` covers withdraw once, the closure recorded, the paid-out read after it, a second withdrawal refused, a refusal before the distribution, and no web route.

## 5. Copy (`fix(C9c.5/games-copy)`)

- **Games.** Every visible "on chain" in the games now says "the ledger": hub, arcade, practice, history, the duel entry and lobby, the rank's escrow line, Lucky, and core's arcade label.
- **Crank copy.** It says who may score and award on Canton: the venue's settler or either player.
- **Result plate.** It says pots and payouts go straight into cash (nothing to claim).
- **Room credential.** It names the seat's own key.
- **Status.** The sponsor row says why there is none on Canton. Its comment and its detail string no longer mention SOL.

## Screenshots (`docs/evidence/ux/c9c/`)

- Duel lobby at 390 and 1440, dark and light.
- Duel match (picking stage, card 1 of 2) at 390 and 1440, dark and light.
- The creator's committed plate at 1440 dark.

## Gates

- `pnpm typecheck && pnpm invariants && pnpm test` passes after the disk stop, on the final tree.
  - Typecheck: clean.
  - Invariants: 0 errors, 0 warnings.
  - Tests: 227 files and 1929 tests passed; 4 files and 18 tests skipped, as on main.
- No Daml was touched.

## Open

- Screenshots still missing: the result screen for a decided UI duel, Lucky, the bet-gated room, and rank at 390 and 1440 in both themes. The lobby and match sets and one committed shot were taken.
- The season payout and the withdrawal on the ledger through the new route. The route is unit-tested; the drive step exists but did not run.
- Lucky placed from its screen. It needs stock lanes on the local stack.
- The bet-gated room placed from its screen.
- The UI duel's decided result screen.
- "1 credits": the tier label pluralises the unit symbol wrongly (web and phone).
- Draining seats stay `draining` with nothing to close out, so the pool of 6 filled up.
