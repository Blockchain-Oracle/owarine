# C8j — live-market proofs in the NYSE session, and the fixes they depend on (evidence)

Date: 2026-09-30 · lane C8j (`slice/C8j-live-markets`, from main `1b461c0`) · decision K-230 · follows `c8i-agents-gaps.md` (gaps 1 and 2), `c4c-seat-link-fixes.md` §7 and `c9d-seats-games.md` (Lucky owed), `c6e-stocks-events.md` (valuation and PreStocks).

## Phase A (no sandbox)

### A1. The live desk's hourly check waits for the hour's Windows (C8j.1, K-230)

**Cause (C8i records 5 and 6, gap 2).** The runner claimed a desk's "hour" wake on the first 60 s tick after the top of the hour. A live desk trades each name's hourly Window (K-090). The previous hour's Window stops quoting at :58, and the new one quotes only after the roller has opened it on the hour's opening print, a few seconds to a minute after the hour. So the 06:00:0x and 07:00:0x checks found no quoting Window and wrote "I checked. I could not price OpenAI and Anthropic, so I did nothing."

**The reference.** Its desk checked on the hour against a market that never closes (PreStocks tokens through Jupiter), and its only wait was for its data: "feed warming: fewer than three PreStocks reads in the half hour, wakes wait". On Canton the market itself opens each hour, so the live desk now waits for its market the same way.

**Fix (`services/ops/src/actors/desk-runner/schedule.ts`, `index.ts`).**
- A live desk's hour and move wakes stay unclaimed while any name it targets or holds has no quoting Window starting this hour on the venue's ladder. The next tick looks again, and the wake keeps the hour as its scheduled time.
- At :10 (`HOUR_WINDOWS_GRACE_SEC`) the check runs anyway, so a lane the roller never opens is still checked and the record names what could not be priced.
- Practice desks (priced at the feed's print, K-091) and a check the owner asks for run when due, as before.
- The heartbeat names what the desk waits for: `<desk> hour: waiting for the hour's Windows (ANTHROPIC), at most until :10`.

**Test.** `schedule.test.ts` (5):
- at 06:00:04 with no Window both names wait; at 06:00:30 with OpenAI's open only Anthropic waits; at 06:00:50 both quote and the check runs;
- the last hour's Window, or a closed one, never counts as this hour's;
- at 06:10:00 the check runs with nothing open;
- `wakesDue`: a live desk leaves 06:00 unclaimed until both its target's (OpenAI) and its holding's (Anthropic) Windows quote, then claims `hour` for 06:00; a practice desk claims 06:00 at once with no Window.

The live proof of this fix is in Phase B (§B2): the hour's record against the Window's open.

### A2. Pyth valuation lanes: the key is refused, the lanes stay hidden (C8j.2)

**Probe.** Ops' own entitlement store (`services/ops/src/runtime/pyth-entitlement.ts`, `store.probe`), with `PYTH_API_KEY` from `services/ops/.env.local` in the process environment only, one `GET https://hermes.pyth.network/v2/updates/price/latest?ids[]=<feed>&parsed=true` per index, a second apart. No key was printed.

```
key present: true; feeds: OPENAI 96d4bb23…, ANTHROPIC 5da511a7…
2026-09-30T07:56:33.562Z OPENAI denied (403 pyth-indices) status=403
2026-09-30T07:56:35.605Z ANTHROPIC denied (403 pyth-indices) status=403
```

**Result.** The key is present and is refused both valuation indices: HTTP 403, group `pyth-indices`. Per D-125 the valuation lanes (OPENAIV, ANTHROPICV) stay unregistered and nothing lists on them. `/session.sources.pythIndex` and `/status` read "denied (403 pyth-indices)" once ops probes with the key.

**Found: nothing enforced "no dead lane" at registration.** The reference's `scripts/deploy/init-valuation-series.ts` probes first and refuses, with no `--force`, because a Series on a feed the key cannot read "would read as a lane and never settle". Here `bootstrap-local.ts --lanes …,valuation` and `bootstrap-devnet.ts --lanes …,valuation` registered the two Series whatever the key said. The roller would then have shown them as `paused: no signed source (Pyth feed not entitled)`.

**Fix (`scripts/bootstrap/valuation-gate.ts`).** When `valuation` is among the lanes, both bootstraps probe every valuation index through the same store before anything is written:
- `bootstrap-local.ts` throws the reference's refusal;
- `bootstrap-devnet.ts` adds a failing check row "valuation lanes entitled", which stops it before any write.

Test `valuation-gate.test.ts` (5): no probe without `valuation`; 403 `pyth-indices` refuses (the key never appears in the text); no key refuses and sends nothing; two 200s let the lanes register; one refusal among two refuses.
