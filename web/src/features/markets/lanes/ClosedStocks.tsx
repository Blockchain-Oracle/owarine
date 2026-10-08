"use client";

import { isStalledOpening, phase } from "@owarine/core/lifecycle";
import { TICKERS, type TickerSymbol } from "@owarine/core/market";
import type { LaneSet } from "@owarine/core/types";
import { useAssetPrice } from "@owarine/markets/react";
import { Lock } from "lucide-react";
import { CLOSED } from "@/lib/copy-closed";
import { AssetDisc } from "../hero/asset-mark";
import { basisRaw, feedRawToOracleRaw, usdLine } from "../hero/units";
import { useMarketSession } from "../session";

const isListedStock = (symbol: string): symbol is TickerSymbol =>
  symbol in TICKERS && (TICKERS[symbol as TickerSymbol].kind === "stock" || TICKERS[symbol as TickerSymbol].kind === "etf");

/**
 * The stocks while the US market is shut (Abu, 8 Oct: "it doesn't mean our stocks should be empty"). The venue lists
 * each stock's first Window of the next session at the close (D-089), and those show as "Schedule a call" cards; a stock
 * with nothing on the board (the listing has not landed, or a lane is paused) still shows here: its mark, its last
 * price and when it opens, said bluntly: no trading until the open. Which stocks: the ones the venue's roller runs.
 */
export function ClosedStocks({ laneSet, nowMs }: { laneSet: LaneSet | null; nowMs: number }) {
  const session = useMarketSession();
  if (!session || session.open) return null;
  const onBoard = new Set(
    (laneSet?.lanes ?? [])
      .flatMap((lane) => lane.markets)
      .filter((m) => {
        const p = phase(m, nowMs);
        return p === "trading" || p === "upcoming" || (p === "pendingOpeningPrint" && !isStalledOpening(m, nowMs));
      })
      .map((m) => m.asset),
  );
  const stocks = [...new Set(Object.keys(session.lanes).map((key) => key.split("-")[0] ?? ""))].filter(isListedStock).filter((s) => !onBoard.has(s)).sort();
  if (stocks.length === 0) return null;
  return (
    <div className="flex flex-col gap-3" aria-label={CLOSED.stocksTitle}>
      <p className="flex flex-wrap items-center gap-2 text-ow-label text-ow-muted">
        <Lock aria-hidden className="size-4" />
        <span className="font-bold text-ow-ink">{CLOSED.stocksTitle}</span>
        <span>{CLOSED.stocksLine(session.label)}</span>
      </p>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {stocks.map((symbol) => (
          <li key={symbol} className="flex items-center gap-3 rounded-ow-card bg-ow-card px-3 py-3 ring-1 ring-ow-hairline">
            <AssetDisc asset={symbol} className="grid size-9 shrink-0 place-items-center rounded-full bg-ow-recessed text-ow-label font-bold" />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-ow-label font-bold text-ow-ink">{TICKERS[symbol].name}</span>
              <StockPrice symbol={symbol} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StockPrice({ symbol }: { symbol: TickerSymbol }) {
  const price = useAssetPrice(symbol);
  const raw = price?.ok && price.value ? feedRawToOracleRaw(basisRaw(price.value), price.value.decimals) : null;
  return (
    <span className="ow-num truncate text-ow-caption text-ow-muted">
      {symbol} · {raw === null ? CLOSED.noPrice : usdLine(raw)}
    </span>
  );
}
