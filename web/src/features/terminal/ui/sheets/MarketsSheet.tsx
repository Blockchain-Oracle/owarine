"use client";

import { TICKERS } from "@owarine/core/market";
import { useAssetPrice } from "@owarine/markets/react";
import { peekClient } from "@owarine/markets/runtime";
import { Search, Star, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Sheet } from "@/components/kit";
import { AssetDisc } from "@/features/markets/hero/asset-mark";
import { useMarketSession } from "@/features/markets/session";
import { shortWhy } from "../../why";
import { haptic } from "@/lib/haptics";
import { playTrade } from "@/lib/sound/trade";
import { cn } from "@/lib/utils";
import { formatUsd, priceDecimals } from "../../chart/engine";
import { setTradeSettings, useTradeSettings } from "../../settings";
import type { TerminalLane } from "../../useTerminalWindow";

type Category = "favourites" | "all" | "hot" | "crypto" | "stocks" | "preipo" | "baskets";
const CATEGORIES: ReadonlyArray<{ id: Category; label: string }> = [
  { id: "favourites", label: "Favourites" },
  { id: "all", label: "All" },
  { id: "hot", label: "Hot 🔥" },
  { id: "crypto", label: "Crypto" },
  { id: "stocks", label: "Stocks" },
  { id: "preipo", label: "Pre-IPO" },
  { id: "baskets", label: "Baskets" },
];

export interface PickerMarket {
  symbol: string;
  lanes: TerminalLane[];
}

interface DayRow {
  openE8: string;
  highE8: string;
  lowE8: string;
}

const kindOf = (symbol: string): Category => {
  const t = TICKERS[symbol as keyof typeof TICKERS];
  if (!t) return "all";
  return t.kind === "crypto" ? "crypto" : t.kind === "basket" ? "baskets" : t.kind === "preIpo" || t.kind === "valuation" ? "preipo" : "stocks";
};

/** 24 h stats for the crypto names (ops `/prices/day`), re-read every minute while the sheet is open. */
function useDayStats(open: boolean): Record<string, DayRow> {
  const [stats, setStats] = useState<Record<string, DayRow>>({});
  useEffect(() => {
    if (!open) return;
    const base = peekClient()?.priceFeedUrl?.replace(/\/$/, "");
    if (!base) return;
    let alive = true;
    const read = () =>
      fetch(`${base}/prices/day`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : {}))
        .then((b: Record<string, DayRow>) => alive && setStats(b))
        .catch(() => undefined);
    void read();
    const id = setInterval(read, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [open]);
  return stats;
}

/**
 * Tradash's market picker `Q`: search, category chips, "Market | Last price / 24h change", rows with a star, logo, name,
 * the symbol and its shortest Window, price and 24 h move. Hot = the biggest movers. Opening resets to All and no search.
 */
export function MarketsSheet({ open, onClose, markets, current, onPick }: { open: boolean; onClose: () => void; markets: readonly PickerMarket[]; current: string; onPick: (symbol: string) => void }) {
  const settings = useTradeSettings();
  const [category, setCategory] = useState<Category>("all");
  const [query, setQuery] = useState("");
  const stats = useDayStats(open);
  useEffect(() => {
    if (open) {
      setCategory("all");
      setQuery("");
    }
  }, [open]);

  const changeOf = (symbol: string, price: number | null): number | null => {
    const s = stats[symbol];
    if (!s || price === null) return null;
    const o = Number(s.openE8) / 1e8;
    return o > 0 ? ((price - o) / o) * 100 : null;
  };

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return markets.filter((m) => {
      const name = TICKERS[m.symbol as keyof typeof TICKERS]?.name ?? m.symbol;
      if (q && !m.symbol.toLowerCase().includes(q) && !name.toLowerCase().includes(q)) return false;
      if (category === "favourites") return settings.favourites.includes(m.symbol);
      if (category === "all") return true;
      if (category === "hot") return m.symbol in stats;
      return kindOf(m.symbol) === category;
    });
  }, [markets, query, category, settings.favourites, stats]);

  // Every market the venue runs that has no Window to pick right now (the US market is shut, a lane is paused, the
  // next Window has not listed yet): still listed, with its price and why it cannot be traded (Abu, 8 Oct).
  const session = useMarketSession();
  const unavailable = useMemo(() => {
    if (!session) return [];
    const listed = new Set(markets.map((m) => m.symbol));
    const q = query.trim().toLowerCase();
    const states = new Map<string, string[]>();
    for (const [key, state] of Object.entries(session.lanes)) {
      const symbol = key.split("-")[0] ?? "";
      if (!(symbol in TICKERS) || listed.has(symbol)) continue;
      states.set(symbol, [...(states.get(symbol) ?? []), state]);
    }
    return [...states.entries()]
      .filter(([symbol]) => {
        const name = TICKERS[symbol as keyof typeof TICKERS]?.name ?? symbol;
        if (q && !symbol.toLowerCase().includes(q) && !name.toLowerCase().includes(q)) return false;
        if (category === "all") return true;
        if (category === "favourites") return settings.favourites.includes(symbol);
        return category !== "hot" && kindOf(symbol) === category;
      })
      .map(([symbol]) => ({ symbol, why: shortWhy(symbol, session) }))
      .sort((a, b) => a.symbol.localeCompare(b.symbol));
  }, [session, markets, query, category, settings.favourites]);

  const empty =
    category === "favourites" && settings.favourites.length === 0
      ? "No favourites yet. Tap a star to add one."
      : category === "hot" && Object.keys(stats).length === 0
        ? "Loading movers…"
        : rows.length === 0 && unavailable.length === 0
          ? query
            ? "No markets match that search."
            : "Nothing listed here right now."
          : null;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title="Markets" hideTitle>
      <div className="flex flex-col gap-3">
        <label className="flex h-11 items-center gap-2 rounded-full bg-ow-recessed px-4">
          <Search className="size-4 text-ow-muted" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search markets" className="min-w-0 flex-1 bg-transparent text-ow-body outline-none placeholder:text-ow-muted" />
          {query ? (
            <button type="button" aria-label="Clear" onClick={() => setQuery("")}>
              <X className="size-4 text-ow-muted" />
            </button>
          ) : null}
        </label>
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => (playTrade("tap"), haptic("tap"), setCategory(c.id))}
              className={cn("h-8 shrink-0 rounded-full px-3.5 text-ow-caption font-bold", category === c.id ? "bg-ow-ink text-ow-inverse" : "bg-ow-recessed text-ow-muted")}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex justify-between px-1 text-ow-micro text-ow-muted">
          <span>Market</span>
          <span>Last price / 24h change</span>
        </div>
        {empty ? <p className="py-8 text-center text-ow-body text-ow-muted">{empty}</p> : null}
        <ul className="flex flex-col gap-1.5">
          {(category === "hot" ? [...rows].sort((a, b) => Math.abs(changeOfStat(stats, b.symbol)) - Math.abs(changeOfStat(stats, a.symbol))).slice(0, 6) : rows).map((m) => (
            <PickerRow
              key={m.symbol}
              market={m}
              active={m.symbol === current}
              starred={settings.favourites.includes(m.symbol)}
              onStar={() => setTradeSettings({ favourites: settings.favourites.includes(m.symbol) ? settings.favourites.filter((s) => s !== m.symbol) : [...settings.favourites, m.symbol] })}
              onPick={() => (playTrade("tap"), haptic("tap"), onPick(m.symbol), onClose())}
              change={changeOf}
            />
          ))}
          {category === "hot"
            ? null
            : unavailable.map(({ symbol, why }) => (
                <UnavailableRow
                  key={symbol}
                  symbol={symbol}
                  why={why}
                  starred={settings.favourites.includes(symbol)}
                  onStar={() => setTradeSettings({ favourites: settings.favourites.includes(symbol) ? settings.favourites.filter((s) => s !== symbol) : [...settings.favourites, symbol] })}
                />
              ))}
        </ul>
      </div>
    </Sheet>
  );
}

const changeOfStat = (stats: Record<string, DayRow>, symbol: string): number => {
  const s = stats[symbol];
  if (!s) return 0;
  const o = Number(s.openE8);
  const h = Number(s.highE8);
  const l = Number(s.lowE8);
  return o > 0 ? Math.max((h - o) / o, (o - l) / o) : 0;
};

function PickerRow({ market, active, starred, onStar, onPick, change }: { market: PickerMarket; active: boolean; starred: boolean; onStar: () => void; onPick: () => void; change: (symbol: string, price: number | null) => number | null }) {
  const reading = useAssetPrice(market.symbol as Parameters<typeof useAssetPrice>[0]);
  const price = reading && reading.ok && reading.value ? Number(reading.value.priceRaw) / 10 ** reading.value.decimals : null;
  const pct = change(market.symbol, price);
  const name = TICKERS[market.symbol as keyof typeof TICKERS]?.name ?? market.symbol;
  return (
    <li className={cn("flex items-center gap-3 rounded-ow-card px-2 py-2", active ? "bg-ow-recessed" : "hover:bg-ow-recessed/60")}>
      <button type="button" aria-label={starred ? `Unstar ${market.symbol}` : `Star ${market.symbol}`} aria-pressed={starred} onClick={onStar} className="grid size-7 place-items-center">
        <Star className={cn("size-4", starred ? "fill-ow-breakeven text-ow-breakeven" : "text-ow-muted")} />
      </button>
      <button type="button" onClick={onPick} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <AssetDisc asset={market.symbol} className="asset-disc-32" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-ow-body font-semibold">{name}</span>
          <span className="flex items-center gap-1.5 text-ow-micro text-ow-muted">
            {market.symbol}
            {market.lanes[0] ? <span className="rounded-full bg-ow-recessed px-1.5 font-bold">{market.lanes[0].label}</span> : null}
          </span>
        </span>
        <span className="flex flex-col items-end">
          {price === null ? <span className="h-4 w-16 animate-pulse rounded bg-ow-recessed" /> : <span className="ow-num text-ow-body font-semibold">{formatUsd(price, priceDecimals(price))}</span>}
          {pct === null ? <span className="text-ow-micro text-ow-muted">—</span> : <span className={cn("ow-num text-ow-micro font-semibold", pct > 0 ? "text-ow-up" : pct < 0 ? "text-ow-down" : "text-ow-muted")}>{`${pct > 0 ? "+" : pct < 0 ? "−" : ""}${Math.abs(pct).toFixed(2)}%`}</span>}
        </span>
      </button>
    </li>
  );
}

/** A market with nothing to trade right now: its mark, name and live price, and why, in one muted line. Not pickable. */
function UnavailableRow({ symbol, why, starred, onStar }: { symbol: string; why: string; starred: boolean; onStar: () => void }) {
  const reading = useAssetPrice(symbol as Parameters<typeof useAssetPrice>[0]);
  const price = reading && reading.ok && reading.value ? Number(reading.value.priceRaw) / 10 ** reading.value.decimals : null;
  const name = TICKERS[symbol as keyof typeof TICKERS]?.name ?? symbol;
  return (
    <li className="flex items-center gap-3 rounded-ow-card px-2 py-2" aria-disabled>
      <button type="button" aria-label={starred ? `Unstar ${symbol}` : `Star ${symbol}`} aria-pressed={starred} onClick={onStar} className="grid size-7 place-items-center">
        <Star className={cn("size-4", starred ? "fill-ow-breakeven text-ow-breakeven" : "text-ow-muted")} />
      </button>
      <span className="flex min-w-0 flex-1 items-center gap-3 opacity-70">
        <AssetDisc asset={symbol} className="asset-disc-32" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-ow-body font-semibold">{name}</span>
          <span className="flex items-center gap-1.5 text-ow-micro text-ow-muted">
            {symbol}
            <span className="truncate rounded-full bg-ow-recessed px-1.5 font-bold">{why}</span>
          </span>
        </span>
        <span className="ow-num text-ow-body font-semibold">{price === null ? "—" : formatUsd(price, kindOf(symbol) === "stocks" ? 2 : priceDecimals(price))}</span>
      </span>
    </li>
  );
}
