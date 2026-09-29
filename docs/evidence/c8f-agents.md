# C8f — agents, strategies and desks on Canton (evidence)

Date: 2026-09-29 · lane C8f (`slice/C8f-agents-wire`) · decisions K-087 – K-091

## What was built

| Area | Where | What |
|---|---|---|
| Daml | `daml/abu-pm-agents` 0.2.0 | `GrantDesk` (open from cash, top-up keeping every counter); `DeskMandate.holdings` + `Mandate_Sell` (only what the desk bought, ≥ 92 % of the attested value, counted = max(proceeds, value), proceeds to the budget); `Strategy.publishedAt`; `Subscription` observed by its runner |
| Bindings | `packages/daml-clients` | `pnpm codegen:daml` generates abu-pm-agents; `Agents`, `AGENT_TEMPLATE_IDS` |
| Server | `@agari/markets/ops/agents`, `server/agents*.ts`, `server/desk-seat.ts` | decoders, one builder per choice, stable ids, the grant executor, the seat's agents and desk sides (actAs the seat only, journaled by commandId) |
| Web | `/api/ledger/agents/*`, `/api/ledger/desk/*`, `/api/strategies`, `/api/desk/*` | seat-authorised routes, party from the lease only |
| Client | `@agari/markets/{strategies,vault,desk}` | every C1 stub replaced, every export and type kept |
| Ops | `actors/agents`, `strategy-runner`, `runner-main.ts`, `x-relay`, `desk-runner`, seat drain | enrol + aggregate fee payout; runner, X relay and desk operator act as the agent-runner party; drain ends grants, consents and desks |
| Mobile | `features/{strategies,x,desk}` | follow the shared hooks |

## Gates (2026-09-29, on this branch before the merge of main)

- `dpm test` (pm-tests): **166 scripts ok, 0 failed** (an earlier run under load had one `Test.Tickets.Range` script time out at 60 s; it passed on the re-run).
- `dpm upgrade-check --both` abu-pm-agents 0.1.0 → 0.2.0: **passes**, two warnings (Subscription observers, DeskMandate precondition). 0.1.0 was never uploaded.
- `pnpm typecheck` (markets, ops, web, mobile): clean. `pnpm invariants`: 0 errors, 1 warning (`Number(priceE8` in `desk/canton.ts`, ticks from a lot price). `pnpm test`: 228 files passed, 1,943 tests.

After merging main (`dadd823`, games + Gap/events): `pnpm codegen:daml` regenerates all four packages with no diff; `dpm test` **170 scripts ok, 0 failed**; typecheck (daml, markets, ops, web, mobile) clean; invariants 0 errors; `pnpm test` 232 files passed, 1,971 tests.

## Drive: grant → runner places → settle → revoke returns budget

Local sandbox (Canton 3.5.17, JSON API :7565), `bootstrap-local.ts --seats 2 --lanes crypto`, `drive/ops-local.ts` live on :8767, then
`scripts/drive/agents-grant-it.ts` (party ids shortened):

```
PASS  fund agari-user-seat-1-mumsugg2  funded
PASS  enrol agari-user-seat-1-mumsugg2  {"kind":"enrolled","created":[]}
PASS  fund agari-user-seat-2-mumsugg2  funded
PASS  enrol agari-user-seat-2-mumsugg2  {"kind":"enrolled","created":[]}
seat-1 holds 2996727110
PASS  seat-1 has its GrantDesk
PASS  grant open: budget 20 credits, day 0, nothing spent  {"venue":"agari-venue-mumsugg2::1220…","owner":"agari-user-seat-1-mumsugg2::1220…","agent":"agari-agent-runner-mumsugg2::1220…","caps":{"maxStakePerTrade":"5000000","maxDailySpend":
PASS  seat-1 cash down by exactly the budget  {"before":"2996727110","after":"2976727110"}
PASS  the runner sees the grant (observer)
PASS  the listing is live with the sealed hash  agari-user-seat-2-mumsugg2::1220…/0
PASS  the runner observes the consent, fade (K-089)  SubFade
PASS  the creator does not see who subscribes
PASS  a displayed quote for seat-1  quote
PASS  the runner placed a call for seat-1 through its grant  {"marketId":"FsNMJC82TV7Nqrh7K72SsZ2s1ZAMaQLwfDEBq2R69ZE5","side":"up","contractsRaw":"2000000","costBase":"1742262","avgPriceBps":8700,"txHash":"12209b27aae8…","fillCount":1}
PASS  the grant was charged exactly the booked cost, and counted it today  {"budget":"18257738","spent":"1742262","charge":"1742262"}
PASS  seat-1 owns the leg, marked as a grant's  ["grant"]
PASS  the runner can never see seat-1's cash
PASS  recovery by command id finds the same fill  {"status":"confirmed","txHash":"12209b27aae8…","cashDelta":"1742262","tokenDelta":"2000000","atSec":1790694135,"side":"up"}
PASS  the same attempt is never re-sent as a second fill  confirmed
PASS  the venue settled seat-1's leg (resolution, then Desk_SettleBatch)  {"payout":"0"}
PASS  a top-up adds to the budget and keeps today's spend  {"budget":"19257738","spent":"1742262"}
PASS  revoke returns the whole remaining budget  {"returned":"19257738"}
PASS  no grant is left naming the runner
PASS  seat-1's cash reconciles: start − cost + payout  {"cash0":"2996727110","charge":"1742262","payout":"0","cashEnd":"2994984848"}

ALL PASS
```

What it proves: the venue enrols a seat's offers on demand; the grant is funded from the seat's cash to the unit; the runner sees the grant and the fade consent (K-089) while the creator sees no subscriber; the runner places a call for the seat through the grant (the owner's firm quote, `Grant_AcceptQuote` actAs the runner only) and the grant is charged exactly the booked cost; the runner never sees the seat's cash; a lost reply is recovered by the attempt's command id and the same attempt is never a second fill; the venue resolves and settles the leg (a loss here, payout 0); a top-up keeps today's spend; revoke returns the whole remaining budget; the seat's cash reconciles to start − cost + payout. The first two runs of the script failed on the drive's own bugs (a disclosure named by package name; a re-run finding the previous run's grant) and were fixed in the script, not in product code.

## Not driven on the sandbox (covered by Daml scripts and unit tests)

- The desk's live leg (`Mandate_Trade`/`Mandate_Sell` with oracle `DeskMark`s): the pre-IPO lanes need the PreStocks prints, which this host cannot fetch (K-027). Covered by `Test.Agents.Desk` (trade, sell, refusals, races, conservation) and `packages/markets/src/desk/canton.test.ts`.
- The web routes through a browser session, and the X relay against a real X account.
