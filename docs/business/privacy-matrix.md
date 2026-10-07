# Privacy matrix: who sees what

On Canton a party receives a contract only if it is a stakeholder (a signatory or an observer), or if the contract is disclosed to it for one command. Nothing is filtered in the UI. The table below is read from the `signatory` and `observer` lines in `daml/*/daml/PM/**`, and the rows marked **T** are asserted by `daml/pm-tests/daml/Test/Privacy.daml`.

**✓** stakeholder, sees it · **—** never receives it · **W** sees it only as a witness of its own settle, or when it is disclosed to one command

## Markets and resolution (`abu-pm-main`)

| Contract | Signatory | Observer | Trader (owner) | Other trader | Venue | Resolver | Oracle parties | Auditor | Outsider |
|---|---|---|---|---|---|---|---|---|---|
| `Series` | venue | resolver, auditor | — **T** | — | ✓ | ✓ | — | ✓ | — **T** |
| `MarketTerms` | venue | resolver | — **T** (W by disclosure) | — | ✓ | ✓ | — | — | — **T** |
| `PriceQuote` (one print) | that oracle | venue, resolver | — **T** | — | ✓ | ✓ | own only | — | — **T** |
| `OpenPrint`, `Resolution` | resolver **and** venue | — | W **T** | — | ✓ | ✓ | — | — | — **T** |
| `EventAttestation` | attestor | venue, resolver | — | — | ✓ | ✓ | own only | — | — |
| `EventVerdict` | resolver, venue | — | W | — | ✓ | ✓ | — | — | — |

## Money and positions (`abu-pm-main`)

| Contract | Signatory | Observer | Trader (owner) | Other trader | Venue | Resolver | Oracle parties | Auditor | Outsider |
|---|---|---|---|---|---|---|---|---|---|
| `Quote`, `BuyQuote` | venue | the quoted user | ✓ **T** | — **T** | ✓ | — | — | — | — **T** |
| `Leg` (the position) | venue, owner | — | ✓ **T** | — **T** | ✓ | — | — | — | — **T** |
| `VenueCash` | venue, owner | — | ✓ **T** | — **T** | ✓ | — | — | — | — **T** |
| `VenueAccount` | venue, owner | — | ✓ **T** | — **T** | ✓ | — | — | — | — **T** |
| `NettedResidual` | venue | — | — **T** | — | ✓ | — | — | — | — **T** |
| `Publication` (opt-in leaderboard entry) | venue, owner | — | ✓ **T** | — **T** | ✓ | — | — | — | — **T** |
| `SettlementReceipt` | venue, owner | — | ✓ | — | ✓ | — | — | — | — |
| `LpShare` (Earn) | venue, provider | — | ✓ **T** | — **T** | ✓ | — | — | — **T** | — **T** |
| `NavStatement` (reserve totals) | venue | auditor | — **T** | — | ✓ | — | — | ✓ **T** | — **T** |

## Agents, tickets, games (`abu-pm-agents`, `abu-pm-tickets`, `abu-pm-games`)

| Contract | Signatory | Observer | Notes |
|---|---|---|---|
| `AgentGrant` | owner, venue | agent runner | The runner sees the grant but never the owner's cash (`docs/evidence/c8f-agents.md`: "the runner can never see seat-1's cash") |
| `Subscription` | venue, subscriber | runner | The strategy's creator never learns who subscribes (C8f: "the creator does not see who subscribes") |
| `DeskMandate`, `DeskDecision` | owner, venue | operator | The desk's operator sees the mandate it runs, nothing else of the owner's |
| `RangeRound`, `ParlayTicket`, `BoostPosition` | venue, owner | — | Two stakeholders, like a `Leg` |
| `DuelMatch`, `DuelResult` | venue, creator, challenger | — | The one named exception to the two-stakeholder rule: both players see the match |

## What this does not hide (said before a judge asks)

1. **The venue sees every trade.** It is the counterparty, as a broker is.
2. **The node that hosts the parties can read them.** On the Noders sandbox every party sits on one participant that Noders runs. The demo proves the model, not operational isolation.
3. **One ledger user acts for all our parties** on the shared participant. The ledger cannot enforce which party a seat acts as; our code does. A route derives the party only from the seat's own lease, never from the request (`web/src/app/api/view/route.ts` takes `as` only as `me`, `alice`, `bob` or `outsider`).
4. **The synchronizer sees metadata**: sizes, timing and which participants are involved, not contents.
5. **Our database is the venue's view.** The projector reads the venue's stream. The per-seat history routes answer only the seat's own proof; others get 403 (`docs/evidence/c6d-gap-events.md`).

## Run it yourself

**1. The Daml proof, with no running stack.** This is the command from `docs/evidence/c9b-games.md`. It needs `~/.dpm/bin` on `PATH` and `JAVA_HOME` set to openjdk@21 (`docs/plan/working-rules.md`):

```sh
cd daml && dpm build --all && (cd pm-tests && dpm test)
```

Look for `Test.Privacy:testOutsiderSeesNothing` and `Test.Privacy:testUserSeesOnlyOwn` as `ok`. The last recorded full run was 175 scripts ok (`docs/evidence/c8e-tickets-ux.md`).

**2. The live routes against a real sandbox and a real `next start`.** From the header of `scripts/drive/seat-routes-it.ts`: a sandbox on :7595 loaded with the `abu-pm-main` DAR, Postgres on :5434, and `pnpm build` done.

```sh
pnpm --filter @owarine/scripts exec tsx drive/seat-routes-it.ts
```

Among its 38 checks:
- `seat B's positions are empty`
- `/api/view?as=outsider is empty and echoes its filtersByParty`
- `/api/view?as=alice sees none of seat A's contracts`
- `/api/view never takes a party from the query`

**3. On a running stack, the same request the drive makes.** A stack is bootstrapped with `bootstrap-local.ts --users alice,bob,outsider` and the web runs on :3150, as in `docs/evidence/c7a-exit-2026-09-29.md`:

```sh
curl -s 'http://localhost:3150/api/view?as=outsider'
```

It returns `rows: []`, the literal `filtersByParty` body naming the outsider party, and the note "queried as party …; the participant returns only contracts this party is a stakeholder of". The same view in the app: `docs/evidence/ux/c4b/08-view-outsider-1440-dark.png`.

**Gaps.**
- The evidence notes do not record the exact `dpm sandbox` command and port flags. `scripts/drive/projector-scenario.ts` says only `dpm sandbox --dar …`.
- A passing log for `seat-routes-it.ts` is recorded only in commit `b9f0a51`'s message, not in `docs/evidence/`. Its header names `abu-pm-main-0.2.0.dar`, and the current DAR is 0.4.0.
- Re-run both before the demo and record the output as an evidence note.
