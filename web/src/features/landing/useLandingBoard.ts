"use client";

import { TICKERS } from "@owarine/core/market";
import { useLanes } from "@owarine/markets/react";
import { liveSpot, subscribeSpot } from "@owarine/markets/runtime";
import { useEffect, useMemo, useState } from "react";
import { useVenue } from "@/features/markets/useVenue";

export type BoardKind = "crypto" | "stock" | "preipo";

export interface BoardRow {
  symbol: string;
  name: string;
  kind: BoardKind;
  /** Windows trading or listed to start, across its lanes. */
  open: number;
  /** Its shortest Window length, in seconds. */
  cadenceSec: number;
  spot: number | null;
}

const kindOf = (symbol: string): BoardKind => {
  const k = TICKERS[symbol as keyof typeof TICKERS]?.kind;
  if (k === "stock" || k === "etf") return "stock";
  if (k === "preIpo" || k === "basket" || k === "valuation") return "preipo";
  return "crypto";
};

const ORDER: Record<BoardKind, number> = { crypto: 0, stock: 1, preipo: 2 };

/**
 * Every market the venue lists right now, from the lane read, with its live spot re-read once a second (the spot stream
 * carries every symbol; one subscription keeps it open). The landing's tape and its market cards read this.
 */
export function useLandingBoard(): { rows: BoardRow[]; loading: boolean } {
  const { venueId } = useVenue();
  const reading = useLanes(venueId);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const off = subscribeSpot("BTC", () => undefined);
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => {
      off();
      clearInterval(id);
    };
  }, []);
  const set = reading && reading.ok ? reading.value : null;
  const base = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    const by = new Map<string, { open: number; cadenceSec: number }>();
    for (const lane of set?.lanes ?? []) {
      for (const m of lane.markets) {
        if (m.kind === "event" || m.voided || m.expirySec <= now) continue;
        const row = by.get(m.asset) ?? { open: 0, cadenceSec: lane.intervalSec };
        row.open += 1;
        row.cadenceSec = Math.min(row.cadenceSec, lane.intervalSec);
        by.set(m.asset, row);
      }
    }
    return [...by.entries()]
      .map(([symbol, r]) => ({ symbol, name: TICKERS[symbol as keyof typeof TICKERS]?.name ?? symbol, kind: kindOf(symbol), ...r }))
      .sort((a, b) => ORDER[a.kind] - ORDER[b.kind] || a.cadenceSec - b.cadenceSec || a.symbol.localeCompare(b.symbol));
  }, [set]);
  // Spot is read fresh on every tick; the list itself only changes with the lane read.
  void tick;
  const rows = base.map((r) => {
    const t = liveSpot(r.symbol);
    return { ...r, spot: t ? Number(t.priceE8) / 1e8 : null };
  });
  return { rows, loading: reading === null };
}
