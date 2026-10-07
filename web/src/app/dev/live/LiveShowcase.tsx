"use client";

import type { OpenPosition } from "@owarine/core/types";
import { formatBaseUnits } from "@owarine/core/units";
import { useLivePnl, usePositions, type LivePnlView } from "@owarine/markets/react";
import { parseLadder, type Ladder } from "@owarine/markets/runtime";
import { useEffect, useMemo, useRef, useState } from "react";
import { Card, Eyebrow, Odometer, PillButton, TextTabs } from "@/components/kit";
import { useCashOut } from "@/features/markets/portfolio/useCashOut";
import { LiveChart, type ChartPnl } from "@/features/terminal/chart/LiveChart";
import { SLIPPAGE_CHOICES_BPS, setTradeSettings, useTradeSettings } from "@/features/terminal/settings";
import { playTrade } from "@/lib/sound/trade";
import { useWalletSession } from "@/lib/wallet-session";

const SYMBOLS = [
  { value: "BTC", label: "BTC" },
  { value: "ETH", label: "ETH" },
] as const;
type Sym = (typeof SYMBOLS)[number]["value"];

const LADDER_BASE = (process.env.NEXT_PUBLIC_LADDER_URL ?? process.env.NEXT_PUBLIC_PRICE_FEED_URL ?? "").replace(/\/$/, "");
const DECIMALS = 6;
const PRETEND_LOTS = 100n;

/** The soonest quoting Window on a symbol, from ops' `/ladders/latest` every 3 s (dev only: the terminal will own this). */
function useQuotingWindow(symbol: Sym): Ladder | null {
  const [ladder, setLadder] = useState<Ladder | null>(null);
  useEffect(() => {
    if (!LADDER_BASE) return;
    let alive = true;
    const read = async () => {
      try {
        const res = await fetch(`${LADDER_BASE}/ladders/latest`, { cache: "no-store" });
        const body = (await res.json()) as { ladders?: unknown[] };
        const quoting = (body.ladders ?? []).map(parseLadder).filter((l): l is Ladder => l !== null && l.symbol === symbol && l.state === "quoting");
        quoting.sort((a, b) => a.expirySec - b.expirySec);
        if (alive) setLadder(quoting[0] ?? null);
      } catch {
        if (alive) setLadder(null);
      }
    };
    void read();
    const id = setInterval(read, 3_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [symbol]);
  return ladder;
}

const money = (base: bigint) => Number(base) / 10 ** DECIMALS;
const pnlText = (p: LivePnlView) => `${p.pnlBase >= 0n ? "+" : "−"}${formatBaseUnits(p.pnlBase < 0n ? -p.pnlBase : p.pnlBase, DECIMALS)}`;

/** Writes the chart's PnL ref from the hook's value: the canvas reads it every frame, React renders only on change. */
function useChartPnl(live: LivePnlView | null) {
  const ref = useRef<ChartPnl | null>(null);
  ref.current = live && !live.locked && live.fillableLots > 0n ? { text: pnlText(live), positive: live.pnlBase >= 0n } : null;
  return ref;
}

function LiveNumbers({ live, title }: { live: LivePnlView | null; title: string }) {
  return (
    <div className="flex flex-col gap-1">
      <Eyebrow>{title}</Eyebrow>
      {live ? (
        <>
          <Odometer kind="pnl" value={money(live.pnlBase)} className="text-ow-title" />
          <span className="text-ow-caption text-ow-muted">
            Close pays <Odometer kind="usd" value={money(live.exitBase)} decimals={4} /> · fair {live.fairTicks ?? "–"} ({live.shiftTicks >= 0 ? "+" : ""}
            {live.shiftTicks} since the ladder) · {live.locked ? "locked: pays at settlement" : `${live.fillableLots}/${live.heldLots} lots fill`}
            {live.live ? "" : " · ladder stream down"}
          </span>
        </>
      ) : (
        <span className="text-ow-caption text-ow-muted">No ladder for this Window yet.</span>
      )}
    </div>
  );
}

function PositionRow({ position, slippageBps }: { position: OpenPosition; slippageBps: number }) {
  const live = useLivePnl(position);
  const side = position.balanceUpRaw > 0n ? "up" : "down";
  const close = useCashOut({
    marketId: position.marketId,
    side,
    heldRaw: side === "up" ? position.balanceUpRaw : position.balanceDownRaw,
    decimals: position.decimals,
    symbol: "credits",
    slippageBps,
    onSold: (proceeds) => playTrade(proceeds >= position.costBasisBase ? "close-win" : "close-loss"),
  });
  return (
    <Card className="flex flex-wrap items-center justify-between gap-4">
      <LiveNumbers live={live} title={`${position.asset} ${side.toUpperCase()} · ${position.marketId.slice(0, 6)}…`} />
      <div className="flex flex-col items-end gap-1">
        <PillButton tone={live && live.pnlBase >= 0n ? "up" : "down"} disabled={!close.canSign || close.busy || !live || live.locked} onClick={() => (playTrade("tap"), void close.cashOut("all"))}>
          {close.busy ? "Closing…" : "CLOSE"}
        </PillButton>
        {close.note ? <span className="text-ow-caption text-ow-muted">{close.note}</span> : null}
        {close.phase ? <span className="text-ow-micro text-ow-helper">{close.phase}</span> : null}
      </div>
    </Card>
  );
}

/** Revamp step 2 fixture: the live engine end to end — Coinbase spot, the canvas chart, live PnL on the venue's ladder, one-tap Close. */
export function LiveShowcase() {
  const [symbol, setSymbol] = useState<Sym>("BTC");
  const [pretend, setPretend] = useState<"up" | "down" | null>(null);
  const win = useQuotingWindow(symbol);
  const settings = useTradeSettings();
  const { address } = useWalletSession();
  const positions = usePositions(address);

  // A pretend position at the ladder's best price when it was taken, so the PnL and band can be checked without a seat.
  const [pretendAt, setPretendAt] = useState<{ marketId: string; ticks: number; side: "up" | "down"; cashUnit: bigint } | null>(null);
  useEffect(() => {
    if (!pretend || !win) return setPretendAt(null);
    setPretendAt((prev) => {
      if (prev && prev.marketId === win.marketId && prev.side === pretend) return prev;
      const best = (pretend === "up" ? win.up : win.down)[0];
      return best ? { marketId: win.marketId, ticks: best[0], side: pretend, cashUnit: win.cashUnit } : null;
    });
  }, [pretend, win]);
  const pretendPosition = useMemo(() => {
    if (!pretendAt) return null;
    const contracts = PRETEND_LOTS * 1000n * pretendAt.cashUnit;
    return {
      marketId: pretendAt.marketId as OpenPosition["marketId"],
      balanceUpRaw: pretendAt.side === "up" ? contracts : 0n,
      balanceDownRaw: pretendAt.side === "down" ? contracts : 0n,
      costBasisBase: PRETEND_LOTS * BigInt(pretendAt.ticks) * pretendAt.cashUnit,
      decimals: DECIMALS,
    };
  }, [pretendAt]);
  const pretendLive = useLivePnl(pretendPosition);
  const chartPnl = useChartPnl(pretendLive);

  const open = win?.openPriceE8 ? Number(win.openPriceE8) / 1e8 : null;
  const held = positions?.ok ? positions.value.filter((p) => p.balanceUpRaw > 0n || p.balanceDownRaw > 0n) : [];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Eyebrow>Fixture · revamp step 2</Eyebrow>
          <h1 className="ow-display text-ow-display">Live engine</h1>
        </div>
        <TextTabs value={symbol} onChange={(v) => (setSymbol(v), setPretend(null))} tabs={SYMBOLS} label="Symbol" />
      </div>

      <Card flat className="h-[min(60vh,32rem)] overflow-hidden">
        <LiveChart symbol={symbol} openPrice={open} closeAtMs={win ? win.expirySec * 1000 : null} side={pretendPosition ? pretendAt?.side : null} pnl={chartPnl} />
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Eyebrow>Window</Eyebrow>
          <span className="text-ow-body">
            {win
              ? `${win.damlMarketId} · open ${open?.toLocaleString("en-US", { minimumFractionDigits: 2 })} · fair ${win.fairTicks ?? "–"} · Up ${win.up[0]?.[0] ?? "–"} / Down ${win.down[0]?.[0] ?? "–"} · quotes until ${new Date(win.quotingUntilSec * 1000).toLocaleTimeString()}`
              : LADDER_BASE
                ? "No Window quoting on this symbol right now."
                : "NEXT_PUBLIC_LADDER_URL is not set."}
          </span>
        </div>
        <div className="flex gap-2">
          <PillButton tone="up" disabled={!win} onClick={() => (playTrade("open-up"), setPretend("up"))}>
            Pretend UP
          </PillButton>
          <PillButton tone="down" disabled={!win} onClick={() => (playTrade("open-down"), setPretend("down"))}>
            Pretend DOWN
          </PillButton>
          <PillButton tone="ghost" disabled={!pretend} onClick={() => setPretend(null)}>
            Clear
          </PillButton>
        </div>
      </Card>

      {pretendPosition ? (
        <Card>
          <LiveNumbers live={pretendLive} title={`Pretend ${pretendAt?.side.toUpperCase()} ${PRETEND_LOTS} lots at ${pretendAt?.ticks} ticks (no fee)`} />
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Eyebrow>Close tolerance</Eyebrow>
        {SLIPPAGE_CHOICES_BPS.map((bps) => (
          <PillButton key={bps} size="sm" tone={settings.slippageBps === bps ? "black" : "ghost"} onClick={() => setTradeSettings({ slippageBps: bps })}>
            {bps / 100}%
          </PillButton>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <Eyebrow>Your open positions {address ? "" : "(take a seat to see them)"}</Eyebrow>
        {held.map((p) => (
          <PositionRow key={p.marketId} position={p} slippageBps={settings.slippageBps} />
        ))}
        {address && positions?.ok && held.length === 0 ? <span className="text-ow-caption text-ow-muted">No open positions.</span> : null}
      </div>
    </div>
  );
}
