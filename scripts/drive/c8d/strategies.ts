/**
 * C8d part, strategies through the web (L-57, A-3b, L-54, C-S24b): seat D publishes a Mean-reversion strategy and a
 * copy-a-trader strategy that follows seat A; seat E copies the reversion strategy and seat F copies the trader, each
 * with a funded permission naming the house runner. ops' strategy runner places E's calls on its own reading of the
 * prints and F's calls after seat A publishes one of its own; the agents board lists the runner.
 */
import { encodeStrategyMetadata } from "@agari/core/strategies";
import { appMarketId } from "@agari/markets/server";
import { decodeLeg } from "@agari/markets/ops/canton";
import type { Seat } from "../first-call/seat";
import { firmQuote, randomUUID, seat, sleep, TEMPLATE_IDS, type Ctx } from "./common";

const CAPS = { maxStakePerTradeBase: 1_000_000n, maxDailySpendBase: 6_000_000n, maxOpenPositions: 3, maxPriceRaw: 950_000n };
const ENVELOPE = { maxStakePerTradeBase: 2_000_000n, maxDailySpendBase: 20_000_000n, maxOpenPositions: 5, maxPriceRaw: 990_000n };

async function publish(ctx: Ctx, D: Seat, name: string, spec: Record<string, unknown>): Promise<bigint> {
  const runner = ctx.parties.parties["agent-runner"]!;
  const metadata = encodeStrategyMetadata({ name, description: `C8d drive: ${name}`, spec } as never);
  const r = await ctx.web.call(D, "POST", "/api/ledger/agents/strategies/publish", { commandId: randomUUID(), runner, envelope: ENVELOPE, feeBase: 0n, metadata });
  if (r.json.kind !== "confirmed") throw new Error(`publish ${name}: ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`);
  for (let i = 0; i < 20; i++) {
    const list = (await ctx.web.call(null, "GET", "/api/ledger/agents/strategies")).json.strategies as { strategyId: string; metadata: string }[];
    const mine = list.find((s) => s.metadata.includes(`"name":"${name}"`));
    if (mine) return BigInt(mine.strategyId);
    await sleep(3_000);
  }
  throw new Error(`${name} published (${r.json.updateId}) but not on the registry`);
}

async function copy(ctx: Ctx, S: Seat, strategyId: bigint): Promise<string> {
  const runner = ctx.parties.parties["agent-runner"]!;
  const g = await ctx.web.call(S, "POST", "/api/ledger/agents/vault/open", { commandId: randomUUID(), kind: "strategy", actor: runner, caps: CAPS, expiresAtSec: Math.floor(Date.now() / 1000) + 6 * 3600, budgetBase: 6_000_000n });
  if (g.json.kind !== "confirmed") throw new Error(`grant: ${g.status} ${JSON.stringify(g.json).slice(0, 200)}`);
  const vault = (await ctx.web.call(S, "GET", "/api/ledger/agents/vault")).json;
  const grantId = BigInt(vault.grants?.strategy?.grantId ?? 0);
  const s = await ctx.web.call(S, "POST", "/api/ledger/agents/strategies/subscribe", { commandId: randomUUID(), strategyId, grantId, feeBase: 0n, fade: false });
  if (s.json.kind !== "confirmed") throw new Error(`subscribe: ${s.status} ${JSON.stringify(s.json).slice(0, 200)}`);
  return `grant #${grantId} (${g.json.updateId.slice(0, 16)}…), subscribed (${s.json.updateId.slice(0, 16)}…)`;
}

/** The legs ops placed for a seat through its grant, newest first. */
const legsOf = async (ctx: Ctx, S: Seat) => (await ctx.kit.acs(S.party!, TEMPLATE_IDS.Leg, decodeLeg)).filter((l) => l.data.owner === S.party).sort((a, b) => b.offset - a.offset);

export async function runStrategies(ctx: Ctx): Promise<void> {
  const { step, web, kit } = ctx;
  const [A, D, E, F] = [await seat(ctx, "A"), await seat(ctx, "D"), await seat(ctx, "E"), await seat(ctx, "F")];
  const keep = setInterval(() => void Promise.all([A, D, E, F].map((s) => web.lease(s).catch(() => undefined))), 240_000);
  let reversionId = 0n;
  let mirrorId = 0n;
  try {
    await step("strategies: seat D publishes Mean-reversion (L-57) and a copy of seat A (A-3b), runner = the house runner", async () => {
      reversionId = await publish(ctx, D, `C8d Reversion ${ctx.run}`, { preset: "reversion", lookback: 3, thresholdBps: 0 });
      mirrorId = await publish(ctx, D, `C8d Copy A ${ctx.run}`, { preset: "mirror", trader: A.address, withinSec: 600 });
      return { outcome: "pass", detail: `reversion #${reversionId}, copy-A #${mirrorId} (trader ${A.address.slice(0, 4)}…${A.address.slice(-4)})`, evidence: "POST /api/ledger/agents/strategies/publish ×2 (License_Publish)" };
    });
    if (!reversionId || !mirrorId) return;

    await step("strategies: seat E copies Mean-reversion, seat F copies seat A, each with a funded permission", async () => {
      const e = await copy(ctx, E, reversionId);
      const f = await copy(ctx, F, mirrorId);
      return { outcome: "pass", detail: `E: ${e}; F: ${f}`, evidence: "POST /api/ledger/agents/vault/open + strategies/subscribe" };
    });

    await step("L-57: the runner places seat E's Mean-reversion call through its grant", async () => {
      for (let i = 0; i < 40; i++) {
        const legs = await legsOf(ctx, E);
        if (legs[0]) return { outcome: "pass", detail: `${legs[0].data.marketId} ${legs[0].data.outcome === "SideUp" ? "Up" : "Down"} ${legs[0].data.lots} lots for seat E`, evidence: `update ${await kit.updateIdAt(E.party!, legs[0].offset)} (Grant_AcceptQuote by the agent-runner)` };
        await sleep(10_000);
      }
      return { outcome: "fail", detail: "no call for seat E in 400 s" };
    });

    await step("A-3b: seat A calls and publishes it; the runner copies the side for seat F", () => copyTraderCall(ctx, A, F));

    await step("L-54: the agents board lists the house runner with the strategies' fills", async () => {
      const board = (await web.call(null, "GET", "/api/strategies")).json as { strategies: { strategyId: string; runner: string }[]; fills: unknown[] };
      const ours = board.strategies.filter((s) => [reversionId, mirrorId].map(String).includes(String(s.strategyId)));
      return { outcome: ours.length === 2 ? "pass" : "fail", detail: `${board.strategies.length} strategies on the board, ours ${ours.length}; ${board.fills.length} fills`, evidence: "GET /api/strategies (/agents reads it)" };
    });
  } finally {
    clearInterval(keep);
  }
}

/**
 * Seat A takes a side early in a BTC-5m Window (at least 150 s before lock, so the runner's next pass still finds it
 * trading) and publishes it; the runner reads A's published fills and places the same side for F through F's grant.
 */
async function copyTraderCall(ctx: Ctx, A: Seat, F: Seat) {
  const { win, q } = await firmQuote(ctx, A, "BTC-5m", "up", 2_000_000n, 330_000, 150);
  const acc = await ctx.web.call(A, "POST", `/api/ledger/quotes/${q.cid}/accept`, { commandId: randomUUID() });
  if (acc.status !== 200) return { outcome: "fail" as const, detail: `A's accept ${acc.status}` };
  const pub = await ctx.web.call(A, "POST", "/api/ledger/publications", { marketId: appMarketId(win.data.marketId) });
  if (pub.status !== 200) return { outcome: "fail" as const, detail: `publish ${pub.status} ${JSON.stringify(pub.json).slice(0, 160)}` };
  for (let i = 0; i < 18; i++) {
    const leg = (await legsOf(ctx, F)).find((l) => l.data.marketId === win.data.marketId);
    if (leg) {
      return {
        outcome: leg.data.outcome === "SideUp" ? ("pass" as const) : ("fail" as const),
        detail: `A: Up on ${win.data.marketId}, published; F: ${leg.data.outcome === "SideUp" ? "Up" : "Down"} ${leg.data.lots} lots`,
        evidence: `update ${await ctx.kit.updateIdAt(F.party!, leg.offset)} (Grant_AcceptQuote for F)`,
      };
    }
    await sleep(8_000);
  }
  return { outcome: "fail" as const, detail: `no copy for seat F on ${win.data.marketId} in 144 s` };
}

/** A-3b alone: a trader, a mirror strategy of it, a copier (three seats). */
export async function runMirror(ctx: Ctx): Promise<void> {
  const [A, D, F] = [await seat(ctx, "A"), await seat(ctx, "D"), await seat(ctx, "F")];
  const keep = setInterval(() => void Promise.all([A, D, F].map((s) => ctx.web.lease(s).catch(() => undefined))), 240_000);
  try {
    let mirrorId = 0n;
    await ctx.step("A-3b: seat D publishes a copy of seat A and seat F copies it", async () => {
      mirrorId = await publish(ctx, D, `C8d Copy A ${ctx.run}`, { preset: "mirror", trader: A.address, withinSec: 600 });
      return { outcome: "pass", detail: `copy-A #${mirrorId}; F: ${await copy(ctx, F, mirrorId)}`, evidence: "License_Publish · GrantDesk_Open · Subscriber_Subscribe" };
    });
    if (mirrorId) await ctx.step("A-3b: seat A calls and publishes it; the runner copies the side for seat F", () => copyTraderCall(ctx, A, F));
  } finally {
    clearInterval(keep);
  }
}
