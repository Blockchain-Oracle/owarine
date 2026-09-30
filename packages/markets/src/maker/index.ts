/** Earn's maker vault on Canton (abu-pm-main 0.5.0, K-092, K-200): reads through the ticket routes, writes through the seat's lane. */
import type { MakerWindowView } from "@agari/core/maker";
import { ok, type Reading } from "@agari/core/schemas";
import type { Address, MarketId } from "@agari/core/types";
import { notDeployedError } from "../stub/not-deployed";
import { readBook, readSeries } from "../runtime/accounts";
import { toBookDepth } from "../runtime/mappers";
import { nowSec } from "../provider/clock";
import { TICKET_DECIMALS } from "../tickets/params";
import { MAKER_NOT_LIVE, makerWindowOf, readMaker } from "./reads";

/** The best level a side, the depth over the first levels, and the grid, in raw units. */
export interface PoolTop {
  bestBidRaw: bigint | null;
  bestAskRaw: bigint | null;
  bidDepthRaw: bigint;
  askDepthRaw: bigint;
  tickRaw: bigint;
  lotRaw: bigint;
  minQuantityRaw: bigint;
}

export { getMakerSharesOf, getMakerVaultState, getMakerWindow, MAKER_NOT_LIVE, resolveMakerDeployment } from "./reads";
export { submitMakerTx } from "./writes";

/** The Windows the vault is quoting or holding, soonest expiry first; empty (never an error) without a vault. */
export async function listMakerOpenWindows(): Promise<Reading<MakerWindowView[]>> {
  const r = await readMaker();
  return r.ok ? ok((r.value?.open ?? []).map(makerWindowOf), r.asOfMs) : r;
}

/** The vault's Windows, open ones first, then the settled ones newest first, each settled one with its result. */
export async function listMakerHistory(limit = 20, offset = 0): Promise<Reading<MakerWindowView[]>> {
  const r = await readMaker();
  if (!r.ok) return r;
  const all = r.value ? [...r.value.open, ...r.value.history] : [];
  return ok(all.slice(offset, offset + limit).map(makerWindowOf), r.asOfMs);
}

/** The first Window whose Resolution is in while the book still holds positions on it: what a withdrawal settles first. */
export async function getMakerUnsettledExpired(): Promise<Reading<MarketId | null>> {
  const r = await readMaker();
  return r.ok ? ok((r.value?.unsettledExpired ?? null) as MarketId | null, r.asOfMs) : r;
}

/** The top of one Window's published venue price ladder, in YES terms (the ladder the issuer prices the vault's quotes on). */
export async function readPoolTop(bookAddress: Address, levels = 5): Promise<PoolTop> {
  const book = await readBook(bookAddress);
  if (!book) throw notDeployedError(MAKER_NOT_LIVE);
  const series = await readSeries(book.series);
  const depth = toBookDepth(book, series, TICKET_DECIMALS, nowSec());
  const sum = (xs: readonly { quantityRaw: bigint }[]) => xs.slice(0, levels).reduce((a, x) => a + x.quantityRaw, 0n);
  return {
    bestBidRaw: depth.upBids[0]?.priceRaw ?? null,
    bestAskRaw: depth.upAsks[0]?.priceRaw ?? null,
    bidDepthRaw: sum(depth.upBids),
    askDepthRaw: sum(depth.upAsks),
    tickRaw: series.tickBase,
    lotRaw: series.lotBase,
    minQuantityRaw: series.minLots * series.lotBase,
  };
}
