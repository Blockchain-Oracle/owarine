/**
 * The seat's ended tickets, from its `SettlementReceipt`s (K-093): each receipt becomes the wire's
 * `TicketReceiptView`, with what the receipt does not carry read beside it — the Window's prints (its Resolution, by
 * Daml market id), its expiry (its terms), and a parlay's per-leg outcomes. Pure apart from the terms lookup.
 */
import type { SettlementReceiptC } from "../ops/tickets/receipt";
import { isTicketReceiptProduct, isTicketReceiptResult, parseParlayPick } from "../ops/tickets/receipt";
import type { TicketReceiptView } from "../provider/ticket-wire";
import { appMarketId } from "./ids";
import type { Row, WindowFacts } from "./tickets-read";

export type MarketFacts = WindowFacts & { termsCid: string };

export interface ReceiptRow extends Row<SettlementReceiptC> {
  createdAtSec: number;
}

const sideOf = (s: "SideUp" | "SideDown"): "up" | "down" => (s === "SideUp" ? "up" : "down");

/** Newest first; receipts whose product or result this build does not know are left out rather than guessed at. */
export async function receiptViews(
  rows: readonly ReceiptRow[],
  byMarket: ReadonlyMap<string, MarketFacts>,
  expiryOf: (termsCid: string) => Promise<number | null>,
): Promise<TicketReceiptView[]> {
  const expiry = async (damlMarketId: string): Promise<number> => {
    const f = byMarket.get(damlMarketId);
    if (!f) return 0;
    return (await expiryOf(f.termsCid).catch(() => null)) ?? 0;
  };
  const out: TicketReceiptView[] = [];
  for (const { cid, data: r, createdAtSec } of rows) {
    const d = r.detail;
    if (!d || !isTicketReceiptProduct(r.product) || !isTicketReceiptResult(d.result)) continue;
    const facts = byMarket.get(r.marketId) ?? null;
    let legs: TicketReceiptView["legs"] = [];
    if (r.product === "parlay") {
      // The ledger decides legs in close order and stops at the one that ends the ticket (the receipt's market):
      // every leg before it won, it decided the ticket, and the rest were never decided.
      const sides = parseParlayPick(d.pick) ?? [];
      const expiries = await Promise.all(d.marketIds.map(expiry));
      const di = d.marketIds.indexOf(r.marketId);
      const deciding = expiries[di] ?? 0;
      // Close order where both expiries are known, else the ticket's own leg order (the order it was built in).
      const before = (i: number, e: number) => (e > 0 && deciding > 0 ? e < deciding || (e === deciding && i < di) : i < di);
      legs = d.marketIds.map((id, i) => {
        const side = sides[i] ?? "up";
        const e = expiries[i] ?? 0;
        const resolved =
          d.result === "won" ? ("won" as const)
          : id === r.marketId ? (d.result === "lost" ? ("lost" as const) : ("void" as const))
          : before(i, e) ? ("won" as const)
          : ("pending" as const);
        return { marketId: appMarketId(id), side, expirySec: e, resolved };
      });
    }
    out.push({
      cid, product: r.product, result: d.result, settledAtSec: createdAtSec, marketId: appMarketId(r.marketId), side: sideOf(r.outcome),
      resolved: r.resolved === null ? null : sideOf(r.resolved), lots: r.lots, cashUnit: r.cashUnit, backingShare: r.backingShare, cost: r.cost,
      payout: r.payout, fee: r.fee, stakeBase: d.stake, toReserveBase: d.toReserve, pick: d.pick, expirySec: await expiry(r.marketId),
      openingPrint: facts?.openE8 ?? null, closingPrint: facts?.closeE8 ?? null, legs,
    });
  }
  return out.sort((a, b) => b.settledAtSec - a.settledAtSec);
}
