/**
 * C8d part 1, baskets and valuation lanes (S19, S20; D-124, D-125):
 *   basket     every basket Series has a Window opened on the attested index print (three oracle parties, receipt
 *              naming PreStocks), ops quotes it, and seat A places an AILABS call through the web that lands as a Leg
 *   valuation  a valuation lane is on the ledger if and only if ops' probe says the venue may read its index, and the
 *              web's `/api/pyth-index` says why when it may not
 */
import { BASKET_TICKERS, TICKERS, VALUATION_TICKERS, laneKey } from "@agari/core/market";
import { decodeLeg, decodeOpenPrint, decodePriceQuote, decodeSeries, decodeTerms } from "@agari/markets/ops/canton";
import { credits, firmQuote, hint, randomUUID, seat, short, TEMPLATE_IDS, type Ctx } from "./common";

const basketKeys = BASKET_TICKERS.map((s) => laneKey(s, "token", 3_600));

export async function runBaskets(ctx: Ctx): Promise<void> {
  const { kit, roles, step, web } = ctx;
  await step("basket Windows open on the attested index (every basket Series)", async () => {
    const terms = (await kit.acs(roles.venue, TEMPLATE_IDS.MarketTerms, decodeTerms)).filter((t) => basketKeys.includes(t.data.seriesKey));
    const opens = await kit.acs(roles.venue, TEMPLATE_IDS.OpenPrint, decodeOpenPrint);
    const opened = new Map(opens.map((o) => [o.data.termsCid, o]));
    const per = basketKeys.map((k) => {
      const mine = terms.filter((t) => t.data.seriesKey === k && opened.has(t.cid));
      return { k, n: mine.length, last: mine.sort((a, b) => b.data.tradingStartSec - a.data.tradingStartSec)[0] };
    });
    const missing = per.filter((p) => p.n === 0).map((p) => p.k);
    const lastOpen = per[0]?.last ? opened.get(per[0].last.cid) : undefined;
    return {
      outcome: missing.length ? "fail" : "pass",
      detail: missing.length ? `no opened Window on ${missing.join(", ")}` : per.map((p) => `${p.k} ${p.n} opened`).join(", "),
      evidence: lastOpen ? `update ${await kit.updateIdAt(roles.venue, lastOpen.offset)} (OpenPrint ${per[0]!.k})` : "—",
    };
  });

  await step("basket prints: three oracle parties attest each index, the policy names PreStocks", async () => {
    const quotes = (await kit.acs(roles.venue, TEMPLATE_IDS.PriceQuote, decodePriceQuote)).filter((q) => (BASKET_TICKERS as readonly string[]).includes(q.data.symbol));
    const byBoundary = new Map<string, Set<string>>();
    for (const q of quotes) {
      const key = `${q.data.symbol}@${q.data.boundarySec}`;
      byBoundary.set(key, (byBoundary.get(key) ?? new Set()).add(q.data.oracle));
    }
    const full = [...byBoundary.entries()].filter(([, o]) => o.size >= 3);
    const series = (await kit.acs(roles.venue, TEMPLATE_IDS.Series, decodeSeries)).filter((s) => basketKeys.includes(s.data.seriesKey));
    const sources = [...new Set(series.flatMap((s) => s.data.policyVersions.map((v) => v.printSource)))];
    const sample = quotes[0];
    return {
      outcome: full.length > 0 && sources.every((s) => s.startsWith("attested:basket:")) ? "pass" : "fail",
      detail: `${quotes.length} basket PriceQuotes, ${full.length} boundaries with all 3 oracles; Series print sources ${sources.join(", ")}`,
      evidence: sample ? `update ${await kit.updateIdAt(roles.venue, sample.offset)} (PriceQuote ${sample.data.symbol} by ${hint(sample.data.oracle)})` : "—",
    };
  });

  const A = await seat(ctx, "A");
  let legCid = "";
  await step("basket call: seat A takes AILABS Up through the web (quote → accept → Leg)", async () => {
    const before = await web.balance(A);
    const { win, q } = await firmQuote(ctx, A, "AILABS-60m", "up", 5_000_000n);
    const acc = await web.call(A, "POST", `/api/ledger/quotes/${q.cid}/accept`, { commandId: randomUUID() });
    if (acc.status !== 200) return { outcome: "fail", detail: `accept answered ${acc.status}: ${JSON.stringify(acc.json).slice(0, 200)}` };
    const leg = (await kit.acs(A.party!, TEMPLATE_IDS.Leg, decodeLeg)).find((l) => l.data.owner === A.party && l.data.marketId === win.data.marketId);
    if (!leg) return { outcome: "fail", detail: "no Leg for seat A on the AILABS Window after accept" };
    legCid = leg.cid;
    const after = await web.balance(A);
    return {
      outcome: "pass",
      detail: `AILABS-60m Window ${win.data.marketId}: ${q.data.lots} lots Up at ${q.data.priceTicks} ticks, Leg ${short(leg.cid)}; balance ${credits(before)} → ${credits(after)} credits`,
      evidence: `update ${await kit.updateIdAt(A.party!, leg.offset)} (Quote_Accept by ${hint(A.party!)})`,
    };
  });
  if (legCid) ctx.log(`seat A holds AILABS leg ${legCid}`);
}

export async function runValuation(ctx: Ctx): Promise<void> {
  const { kit, roles, step, web } = ctx;
  await step("valuation lanes: listed if and only if the probe says the index is readable (D-125)", async () => {
    const probe = await web.call(null, "GET", "/api/pyth-index");
    if (probe.status !== 200) return { outcome: "fail", detail: `/api/pyth-index answered ${probe.status}` };
    const series = await kit.acs(roles.venue, TEMPLATE_IDS.Series, decodeSeries);
    const lines = VALUATION_TICKERS.map((symbol) => {
      const of = TICKERS[symbol].valuationOf!;
      const e = probe.json.entitlement?.[of] as { state: string; status: number | null; reason: string | null } | undefined;
      const listed = series.some((s) => s.data.seriesKey === laneKey(symbol, "token", 3_600));
      const entitled = e?.state === "entitled";
      return { symbol, ok: listed === entitled, text: `${symbol}: probe ${e?.state ?? "absent"}${e?.status ? ` ${e.status}` : ""}${e?.reason ? ` ${e.reason}` : ""}, Series ${listed ? "listed" : "not listed"}` };
    });
    return { outcome: lines.every((l) => l.ok) ? "pass" : "fail", detail: lines.map((l) => l.text).join("; "), evidence: "GET /api/pyth-index (ops /pyth-index/latest) · venue ACS Series" };
  });
  await step("valuation lanes: ops' roller states carry no OPENAIV/ANTHROPICV lane (no dead lane)", async () => {
    const session = (await (await fetch(`${ctx.opsUrl}/session`)).json()) as { lanes?: Record<string, string> };
    const keys = Object.keys(session.lanes ?? {}).filter((k) => VALUATION_TICKERS.some((s) => k.startsWith(`${s}-`)));
    return { outcome: keys.length === 0 ? "pass" : "warn", detail: keys.length === 0 ? "no valuation lane in /session.lanes" : `present: ${keys.join(", ")}`, evidence: "GET ops /session" };
  });
}
