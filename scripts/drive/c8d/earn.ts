/**
 * C8d part, "be the house" for every reserve (A-2b): seat H supplies 10 credits to each of the four reserves — the
 * maker vault, Range & Moonshot, Parlay, Boost — through the same route the Earn tabs use (a firm supply quote from ops,
 * `Supply_Accept` by the seat), and holds an `LpShare` in each; then withdraws the range shares back.
 */
import { decodeLpShare } from "@agari/markets/ops/tickets";
import { randomUUID, seat, TEMPLATE_IDS, type Ctx } from "./common";

const RESERVES = ["maker", "range", "parlay", "boost"] as const;

export async function runEarn(ctx: Ctx): Promise<void> {
  const { step, web, kit } = ctx;
  const H = await seat(ctx, "H");
  for (const reserve of RESERVES) {
    await step(`A-2b: seat H supplies 10 credits to the ${reserve} reserve from its Earn tab`, async () => {
      const q = await web.call(H, "POST", "/api/ledger/tickets/earn", { op: "supply", reserve, amountBase: 10_000_000n });
      if (q.json.kind !== "supply-quote") return { outcome: "fail", detail: `${q.status} ${JSON.stringify(q.json).slice(0, 200)}` };
      const a = await web.call(H, "POST", "/api/ledger/tickets/earn/accept", { commandId: randomUUID(), quoteCid: q.json.quoteCid });
      if (a.status !== 200) return { outcome: "fail", detail: `accept ${a.status} ${JSON.stringify(a.json).slice(0, 200)}` };
      const shares = (await kit.acs(H.party!, TEMPLATE_IDS.LpShare, decodeLpShare)).filter((s) => s.data.provider === H.party);
      return { outcome: "pass", detail: `${(Number(q.json.cashIn) / 1e6).toFixed(2)} credits → ${(Number(q.json.sharesOut) / 1e6).toFixed(4)} shares; H holds ${shares.length} share contract(s)`, evidence: `update ${a.json.updateId ?? "?"} (Supply_Accept)` };
    });
  }
  await step("A-2b: seat H withdraws its range shares at the live NAV", async () => {
    const shares = (await kit.acs(H.party!, TEMPLATE_IDS.LpShare, decodeLpShare)).filter((s) => s.data.provider === H.party && /range/.test(s.data.reserveId));
    const total = shares.reduce((n, s) => n + s.data.shares, 0n);
    const q = await web.call(H, "POST", "/api/ledger/tickets/earn", { op: "withdraw", reserve: "range", shares: total });
    if (q.json.kind !== "withdraw-quote") return { outcome: "fail", detail: `${q.status} ${JSON.stringify(q.json).slice(0, 200)}` };
    const a = await web.call(H, "POST", "/api/ledger/tickets/earn/accept", { commandId: randomUUID(), quoteCid: q.json.quoteCid });
    return { outcome: a.status === 200 ? "pass" : "fail", detail: `${total} shares → ${(Number(q.json.cashOut) / 1e6).toFixed(4)} credits`, evidence: `update ${a.json.updateId ?? "?"} (Withdraw_Accept)` };
  });
}
