/**
 * The strategy runner on its own: the entry point for a creator who hosts their bot (L-55). The same actor the house
 * runs, acting as `RUNNER_PARTY` (the creator's own seat party; else the parties file's `agent-runner`) through each
 * subscriber's grant, for the strategies in `STRATEGY_IDS` (else every active strategy naming that party) — nothing
 * else of the ops service starts. Quotes come from ops over its signed route (`OPS_INTERNAL_URL`,
 * `OPS_INTERNAL_SECRET`); the ledger is reached with this process's own credential (`LEDGER_*`). See "Run your own bot"
 * in the studio.
 */
import { startStrategyRunner } from "./actors/strategy-runner";

const HEARTBEAT_MS = 30_000;

function whyString(actor: string, why: string): string {
  return JSON.stringify({ tsMs: Date.now(), actor, why });
}

console.log(whyString("runner", "boot"));
void startStrategyRunner((why) => console.log(whyString("strategy-runner", why)));
setInterval(() => console.log(whyString("runner", "idle heartbeat")), HEARTBEAT_MS);
