"use client";

import { isOk } from "@owarine/core/schemas";
import type { OpenPosition, Side } from "@owarine/core/types";
import { usePositions, type LivePnlView } from "@owarine/markets/react";
import { useEffect, useMemo, useRef } from "react";
import { entryOf, useEntries } from "./entries";
import { priceOfE8 } from "./exits/plan";
import { useExitFills } from "./exits/useExitFills";
import { useSeatPkg, type SeatPkgState } from "./exits/useSeatPkg";
import type { PaperPosition, TradeMode } from "./mode";
import { ratchet, setTrail, trailHit, type TerminalPosition } from "./useTerminalTrade";

const CREDIT_DECIMALS = 6;

/**
 * The terminal's positions: paper in demo, the seat's legs in live, each live one with its resting exit (R2) as the
 * ledger has it. A live trail's level for the chart is the ledger's, or the tab's own follow of it when further along.
 */
export function useTerminalPositions(o: { mode: TradeMode; paper: readonly PaperPosition[]; address: string | null; activeMarketId: string | null; linePrice: number | null }): { positions: TerminalPosition[]; seatPkg: SeatPkgState } {
  const { mode, paper, address, activeMarketId, linePrice } = o;
  const seatPositions = usePositions(mode === "live" ? (address as Parameters<typeof usePositions>[0]) : null);
  const entries = useEntries();
  const seatPkg = useSeatPkg(mode === "live");
  const positions: TerminalPosition[] = useMemo(() => {
    if (mode === "demo") {
      return paper.map((p) => ({
        id: p.id, mode: "demo" as const, marketId: p.marketId, asset: p.asset, spotSymbol: p.spotSymbol, intervalSec: p.intervalSec, side: p.side,
        balanceUpRaw: p.side === "up" ? BigInt(p.contractsRaw) : 0n, balanceDownRaw: p.side === "down" ? BigInt(p.contractsRaw) : 0n, costBasisBase: BigInt(p.costBase),
        decimals: CREDIT_DECIMALS, entrySpot: p.entrySpot || null, linePrice: p.linePrice, openedAtMs: p.openedAtMs, expirySec: p.expirySec, trailStop: p.trail?.stop ?? null, paper: p,
        exit: null,
      }));
    }
    const rows: OpenPosition[] = seatPositions && isOk(seatPositions) ? seatPositions.value : [];
    return rows
      .filter((r) => r.balanceUpRaw > 0n || r.balanceDownRaw > 0n)
      .map((r) => {
        const side: Side = r.balanceUpRaw >= r.balanceDownRaw ? "up" : "down";
        const e = entryOf(entries, r.marketId, side);
        const exit = seatPkg.exitFor(r.marketId, side);
        return {
          id: `s:${r.marketId}`, mode: "live" as const, marketId: r.marketId, asset: r.asset, spotSymbol: r.asset, intervalSec: r.intervalSec, side, balanceUpRaw: r.balanceUpRaw,
          balanceDownRaw: r.balanceDownRaw, costBasisBase: r.costBasisBase, decimals: r.decimals, entrySpot: e?.spot || null, linePrice: r.marketId === activeMarketId ? linePrice : null,
          openedAtMs: e?.atMs ?? 0, expirySec: r.expirySec, trailStop: seatPkg.deployed ? ledgerTrail(side, exit, e?.trailStop ?? null) : (e?.trailStop ?? null), paper: null, exit,
        };
      });
  }, [mode, paper, seatPositions, entries, activeMarketId, linePrice, seatPkg]);
  useExitFills(mode === "live" ? positions : [], seatPkg.exits);
  return { positions, seatPkg };
}

/**
 * Trail in the tab: ratchet on every committed price (5 Hz, as the reference's trail effect), close when hit. A trail on
 * the ledger (R2) is the venue's to fill: the tab only follows its level for the chart, and never sells it itself.
 */
export function useTabTrail(o: {
  positions: readonly TerminalPosition[];
  spot: number | null;
  spotSymbol: string;
  trailPct: number;
  close: (p: TerminalPosition, live: LivePnlView | null, why: "close" | "trail") => Promise<void> | void;
  book: ReadonlyMap<string, LivePnlView>;
}): void {
  const latest = useRef(o);
  latest.current = o;
  useEffect(() => {
    const { positions, spot, spotSymbol, trailPct, close, book } = latest.current;
    if (spot === null) return;
    for (const p of positions) {
      if (p.trailStop === null || p.spotSymbol !== spotSymbol) continue;
      if (p.exit) {
        const bps = p.exit.stop?.trailBps;
        if (bps != null) {
          const next = ratchet(p.side, p.trailStop, spot, bps / 10_000);
          if (next !== p.trailStop) setTrail(p, next);
        }
        continue;
      }
      if (trailHit(p.side, p.trailStop, spot)) {
        void close(p, book.get(p.id) ?? null, "trail");
        continue;
      }
      const next = ratchet(p.side, p.trailStop, spot, trailPct);
      if (next !== p.trailStop) setTrail(p, next);
    }
  }, [o.spot]);
}

/** A ledger trail's level for the chart: the venue's level, or the tab's own follow of it when that is further along. */
export function ledgerTrail(side: Side, exit: TerminalPosition["exit"], local: number | null): number | null {
  if (!exit?.stop) return null;
  const level = priceOfE8(exit.stop.stopE8);
  if (local === null || exit.stop.trailBps == null) return level;
  return side === "up" ? Math.max(level, local) : Math.min(level, local);
}
