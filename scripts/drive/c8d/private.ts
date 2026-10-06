/**
 * C8d part, private mode on Canton (L-39): seat G moves demo credits into its private bucket, signs one private call
 * (the reference's authorisation text, rebuilt by the route), the call lands as its own leg tagged private and paid
 * from the private bucket only; its public balance and positions do not show it; the receipt cannot be published; once
 * the venue settles the call, Cash out brings the payout home once; then the rest moves back out.
 */
import { formatCadence } from "@agari/core/copy";
import { CLUSTER_ID } from "@agari/core/constants";
import { privateOpenMessage } from "@agari/core/private";
import { formatBaseUnits } from "@agari/core/units";
import { appMarketId } from "@agari/markets/server";
import { quotingWindow, randomUUID, seat, sleep, type Ctx } from "./common";

const credits = (base: string | bigint) => (Number(BigInt(base)) / 1e6).toFixed(2);

export async function runPrivate(ctx: Ctx): Promise<void> {
  const { step, web } = ctx;
  const G = await seat(ctx, "G");
  const status = await web.call(null, "GET", "/api/private/status");
  let opened: { pairId: string; marketId: string; expirySec: number } | null = null;

  await step("private: status names the venue as the desk, venue-bucket mode, ready", async () => {
    const s = status.json;
    return { outcome: s.ready && s.mode === "venue-bucket" && s.contract ? "pass" : "fail", detail: `ready ${s.ready}, mode ${s.mode}, per call ${credits(s.minStakeBase)}–${credits(s.maxStakeBase)} credits${s.reasons?.length ? `, ${s.reasons[0]}` : ""}`, evidence: "GET /api/private/status" };
  });

  await step("private: seat G moves 20 credits into its private bucket (seat + venue, one transaction)", async () => {
    const before = await web.balance(G);
    const r = await web.call(G, "POST", "/api/private/balance", { commandId: randomUUID(), op: "in", amountBase: "20000000" });
    if (r.json.kind !== "moved") return { outcome: "fail", detail: `${r.status} ${JSON.stringify(r.json).slice(0, 200)}` };
    const after = await web.balance(G);
    const bal = (await web.call(G, "GET", "/api/private/balance")).json;
    const ok = bal.balanceBase === "20000000" && before - after === 20_000_000n;
    return { outcome: ok ? "pass" : "fail", detail: `public ${credits(before)} → ${credits(after)}; private ${credits(bal.balanceBase)}`, evidence: `update ${r.json.updateId} (VenueCash_Withdraw + VenueAccount_Credit "private")` };
  });

  await step("private: a signed private call on BTC-5m lands as G's own leg, paid from the private bucket only", async () => {
    let win = await quotingWindow(ctx, "BTC-5m", 120);
    for (let i = 0; !win && i < 40; i++) (await sleep(5_000), (win = await quotingWindow(ctx, "BTC-5m", 120)));
    if (!win) return { outcome: "fail", detail: "no BTC-5m Window with 120 s left" };
    const marketId = appMarketId(win.data.marketId);
    const issuedAtMs = Date.now();
    const stakeBase = 5_000_000n;
    const text = privateOpenMessage({
      owner: G.address, contract: status.json.contract, chainId: CLUSTER_ID.localnet, marketId, asset: "BTC", cadenceText: formatCadence(300), expirySec: win.data.expirySec, side: "up",
      stakeText: formatBaseUnits(stakeBase, 6, { maxDp: 6, minDp: 0, group: false }), symbol: "credits", issuedAtMs,
    });
    const publicBefore = await web.balance(G);
    const r = await web.call(G, "POST", "/api/private/open", { owner: G.address, marketId, side: "up", stakeBase: stakeBase.toString(), minQuantityRaw: "0", issuedAtMs, signature: await G.sign(text) });
    if (r.json.status !== "placed") return { outcome: "fail", detail: `${r.status} ${JSON.stringify(r.json).slice(0, 220)}` };
    const p = r.json.position;
    opened = { pairId: p.pairId, marketId: p.marketId, expirySec: p.expirySec };
    const publicAfter = await web.balance(G);
    const bal = (await web.call(G, "GET", "/api/private/balance")).json;
    const positions = (await web.call(G, "GET", "/api/ledger/me/positions")).json;
    const publicRows = JSON.stringify(positions).includes(marketId) ? "shows it" : "does not show it";
    const ok = publicAfter === publicBefore && BigInt(bal.balanceBase) === 20_000_000n - BigInt(p.costBase) && publicRows === "does not show it";
    return { outcome: ok ? "pass" : "fail", detail: `${p.marketId} Up ${p.lots} lots for ${credits(p.costBase)} credits; private ${credits(bal.balanceBase)}; public balance unchanged (${credits(publicAfter)}); public positions ${publicRows}`, evidence: `update ${r.json.updateId} (Quote_Accept, beneficiaryRef "private")` };
  });
  if (!opened) return;
  const call = opened as { pairId: string; marketId: string; expirySec: number };

  await step("private: before settlement Cash out answers open and moves nothing", async () => {
    const r = await web.call(G, "POST", "/api/private/cashout", { commandId: randomUUID(), pairId: call.pairId, marketId: call.marketId });
    return { outcome: r.json.status === "open" ? "pass" : "fail", detail: `${r.status} ${JSON.stringify(r.json).slice(0, 120)}`, evidence: "POST /api/private/cashout" };
  });

  await step("private: once the venue settles it, Cash out brings the payout home once; the receipt is never published", async () => {
    let row: { status: string; result: string | null; payoutBase: string | null } | undefined;
    while (Date.now() < (call.expirySec + 240) * 1000) {
      row = ((await web.call(G, "GET", "/api/private/balance")).json.positions as { pairId: string; status: string; result: string | null; payoutBase: string | null }[]).find((x) => x.pairId === call.pairId);
      if (row?.status === "settled") break;
      await sleep(8_000);
    }
    if (row?.status !== "settled") return { outcome: "fail", detail: `still ${row?.status ?? "unlisted"} after the Window` };
    const pub = await web.call(G, "POST", "/api/ledger/publications", { marketId: appMarketId(call.marketId), source: "receipt" });
    const before = BigInt((await web.call(G, "GET", "/api/private/balance")).json.balanceBase);
    const c = await web.call(G, "POST", "/api/private/cashout", { commandId: randomUUID(), pairId: call.pairId, marketId: call.marketId });
    const again = await web.call(G, "POST", "/api/private/cashout", { commandId: randomUUID(), pairId: call.pairId, marketId: call.marketId });
    const after = BigInt((await web.call(G, "GET", "/api/private/balance")).json.balanceBase);
    const ok = c.json.status === "credited" && after - before === BigInt(c.json.payoutBase) && again.json.status === "done" && pub.status === 409;
    return { outcome: ok ? "pass" : "fail", detail: `${row.result}: payout ${credits(row.payoutBase ?? "0")}; private ${credits(before)} → ${credits(after)}; second cash-out ${again.json.status}; publish receipt ${pub.status} ${pub.json.code ?? ""}`, evidence: "POST /api/private/cashout (Receipt_Dismiss + re-bucket)" };
  });

  await step("private: the rest moves back out to the seat's balance", async () => {
    const bal = BigInt((await web.call(G, "GET", "/api/private/balance")).json.balanceBase);
    const before = await web.balance(G);
    const r = await web.call(G, "POST", "/api/private/balance", { commandId: randomUUID(), op: "out", amountBase: bal.toString() });
    const after = await web.balance(G);
    return { outcome: r.json.kind === "moved" && after - before === bal ? "pass" : "fail", detail: `${credits(bal)} out; public ${credits(before)} → ${credits(after)}`, evidence: `update ${r.json.updateId} (VenueCash_Withdraw "private" + VenueAccount_Credit "demo")` };
  });
}
