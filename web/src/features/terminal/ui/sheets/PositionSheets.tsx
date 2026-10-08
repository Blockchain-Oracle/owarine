"use client";

import type { Quote } from "@owarine/core/types";
import { useStakeQuote, type LivePnlView } from "@owarine/markets/react";
import { useEffect, useState } from "react";
import { ShareCharm, Sheet } from "@/components/kit";
import { haptic } from "@/lib/haptics";
import { playTrade } from "@/lib/sound/trade";
import { cn } from "@/lib/utils";
import { positionReturn } from "../../position-return";
import { formatPrice } from "../../chart/engine";
import { fixedText, multipleOf } from "../../format";
import { renderCharmPng, saveCharm } from "../../share-png";
import type { TerminalPosition } from "../../useTerminalTrade";
import type { ParlayMark } from "../../parlay/ParlayRow";
import type { ScreenParlay } from "../../parlay/useParlays";
import { PositionsList, totalsOf, UnrealizedCard } from "../PositionsPanel";

const tap = () => (playTrade("tap"), haptic("tap"));
const MIN_ADJUST = 1;
const num = (base: bigint, decimals: number) => Number(base) / 10 ** decimals;

const withParlays = (t: ReturnType<typeof totalsOf>, parlays: readonly ScreenParlay[] = [], marks?: ReadonlyMap<string, ParlayMark>) => ({
  pnl: t.pnl + parlays.reduce((s, p) => s + (marks?.get(p.id)?.pnl ?? 0), 0),
  cost: t.cost + parlays.reduce((s, p) => s + Number(p.stakeBase) / 1e6, 0),
  unpriced: t.unpriced,
});

/** Phone: "Open positions", the rail's panel in a sheet (Tradash `sO`). */
export function PositionsSheet({ open, onClose, positions, book, nowSec, onShare, onAdd, onReduce, onExits, onCloseAll, closingAll, parlays, marks }: {
  open: boolean;
  onClose: () => void;
  positions: readonly TerminalPosition[];
  book: ReadonlyMap<string, LivePnlView>;
  nowSec: number;
  onShare: (p: TerminalPosition) => void;
  onAdd: (p: TerminalPosition) => void;
  onReduce: (p: TerminalPosition) => void;
  onExits?: (p: TerminalPosition) => void;
  onCloseAll: () => void;
  closingAll: boolean;
  parlays?: readonly ScreenParlay[];
  marks?: ReadonlyMap<string, ParlayMark>;
}) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title="Open positions">
      <div className="flex flex-col gap-3">
        <UnrealizedCard totals={withParlays(totalsOf(positions, book, nowSec), parlays, marks)} count={positions.length + (parlays?.length ?? 0)} closable={positions.length} onCloseAll={onCloseAll} closingAll={closingAll} />
        <PositionsList positions={positions} book={book} nowSec={nowSec} onShare={onShare} onAdd={onAdd} onReduce={onReduce} onExits={onExits} parlays={parlays} marks={marks} />
      </div>
    </Sheet>
  );
}

/**
 * Tradash's Add / Reduce sheet `sH`: an amount (half of the most to start), a slider and chips, the "After this order"
 * preview and the action. Add is another buy on the same Window side; Reduce sells part of the position back.
 */
export function AdjustSheet({ open, onClose, kind, position, live, availableCredits, demo, poolAddress, onAdd, onReduce }: {
  open: boolean;
  /** The Window's book address when it is the one on screen (the quote reads its params). */
  poolAddress?: string | null;
  onClose: () => void;
  kind: "add" | "reduce";
  position: TerminalPosition | null;
  live: LivePnlView | null;
  availableCredits: number | null;
  demo: boolean;
  onAdd: (p: TerminalPosition, add: { stakeBase: bigint; quote: Quote | null }) => void;
  onReduce: (p: TerminalPosition, contractsRaw: bigint) => void;
}) {
  const cost = position ? num(position.costBasisBase, position.decimals) : 0;
  const max = kind === "add" ? 0.98 * (availableCredits ?? 0) : 0.95 * cost;
  const [amount, setAmount] = useState(0);
  useEffect(() => {
    if (open) setAmount(Math.round((max / 2) * 100) / 100);
    // Starts at half of the most each time it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, kind]);
  const decimals = position?.decimals ?? 6;
  const stakeBase = BigInt(Math.max(0, Math.round(amount * 10 ** decimals)));
  const target = position && kind === "add" && !demo ? { marketId: position.marketId as never, poolAddress: (poolAddress ?? position.marketId) as never, decimals, intervalSec: position.intervalSec } : null;
  const quoteReading = useStakeQuote({ target, side: position?.side ?? "up", stakeBase, enabled: open && kind === "add" && !demo });
  const quote = quoteReading && quoteReading.ok ? quoteReading.value : null;
  const tooSmall = amount < MIN_ADJUST;
  const noRoom = kind === "add" && (availableCredits ?? 0) < MIN_ADJUST;
  const held = position ? (position.side === "up" ? position.balanceUpRaw : position.balanceDownRaw) : 0n;
  const share = cost > 0 ? Math.min(1, amount / cost) : 0;
  const sellRaw = BigInt(Math.floor(Number(held) * share));
  const realized = live && live.fillableLots > 0n && cost > 0 ? num(live.pnlBase, decimals) * share : null;
  const chips = kind === "add" ? [0.25, 0.5, 0.75, 1] : [0.25, 0.5, 0.75];

  if (!position) {
    return (
      <Sheet open={open} onOpenChange={(o) => !o && onClose()} title="Adjust position">
        <p className="py-6 text-center text-ow-body text-ow-muted">This position is no longer open.</p>
        <button type="button" onClick={onClose} className="h-12 w-full rounded-full bg-ow-ink text-ow-inverse font-bold">Done</button>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title={kind === "add" ? `Add to ${position.asset}` : `Reduce ${position.asset}`}>
      <div className="flex flex-col gap-4">
        <div className="flex items-baseline gap-2">
          <input type="number" inputMode="decimal" step={0.01} value={amount} onChange={(e) => setAmount(Math.max(0, Math.min(max, Number(e.target.value))))} className="ow-num w-full bg-transparent text-ow-display font-bold outline-none" aria-label="Amount" />
          <span className="shrink-0 text-ow-caption text-ow-muted">credits</span>
        </div>
        <input type="range" min={0} max={Math.max(max, 0.01)} step={0.01} value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="w-full accent-[var(--ow-up-line)]" aria-label="Amount slider" />
        <div className="grid grid-flow-col gap-2">
          {chips.map((c) => (
            <button key={c} type="button" onClick={() => (tap(), setAmount(Math.round(max * c * 100) / 100))} className={cn("h-9 rounded-full text-ow-caption font-bold", Math.abs(amount - max * c) < 0.01 ? "ow-up-solid" : "bg-ow-recessed")}>
              {c === 1 ? "Max" : `${c * 100}%`}
            </button>
          ))}
        </div>
        <div className="rounded-ow-card bg-ow-recessed/60 p-4 text-ow-caption">
          <p className="mb-2 font-bold text-ow-muted">After this order</p>
          <dl className="grid grid-cols-2 gap-y-1.5">
            <dt className="text-ow-muted">Staked</dt>
            <dd className="ow-num text-right">
              <span className="text-ow-muted line-through">{cost.toFixed(2)}</span> → {(kind === "add" ? cost + amount : cost - amount).toFixed(2)}
            </dd>
            {kind === "add" ? (
              <>
                <dt className="text-ow-muted">Pays</dt>
                <dd className="ow-num text-right">{quote ? multipleOf(quote.avgPriceBps / 10) : demo ? "at the live price" : "—"}</dd>
              </>
            ) : (
              <>
                <dt className="text-ow-muted">Realized PnL</dt>
                <dd className={cn("ow-num text-right", (realized ?? 0) >= 0 ? "text-ow-up" : "text-ow-down")}>{realized === null ? "—" : `${realized >= 0 ? "+" : "−"}${Math.abs(realized).toFixed(4)}`}</dd>
              </>
            )}
          </dl>
          {kind === "reduce" && position.trailStop !== null ? <p className="mt-2 text-ow-muted">The trailing stop stays armed on the rest.</p> : null}
        </div>
        {tooSmall ? <p className="text-ow-caption text-ow-down">Minimum {MIN_ADJUST.toFixed(2)} credits.</p> : noRoom ? <p className="text-ow-caption text-ow-down">Not enough free credits to add.</p> : null}
        <button
          type="button"
          disabled={tooSmall || noRoom || (kind === "reduce" && sellRaw === 0n)}
          onClick={() => {
            if (kind === "add") onAdd(position, { stakeBase, quote });
            else onReduce(position, sellRaw);
            onClose();
          }}
          className={cn("h-14 w-full rounded-full text-ow-lead font-extrabold tracking-[0.12em] disabled:opacity-40", kind === "add" ? "ow-up-soft" : "ow-down-soft")}
        >
          {kind === "add" ? `ADD ${amount.toFixed(2)}` : `REDUCE ${amount.toFixed(2)}`}
        </button>
      </div>
    </Sheet>
  );
}

type ShareMode = "pnl" | "roi" | "both";

/** Tradash's tweet tiers, on credits. */
export function shareText(asset: string, side: "up" | "down", pnl: number, roiPct: number): string {
  const dir = side === "up" ? "Up" : "Down";
  if (roiPct >= 100) return `+${Math.round(roiPct)}% ${dir} on ${asset} on Owarine. let it ride 🚀`;
  if (roiPct >= 25) return `+${Math.round(roiPct)}% on ${asset} (+${fixedText(pnl, 2)}). green day`;
  if (pnl >= 0) return `+${fixedText(pnl, 2)} on ${asset}. up only`;
  if (roiPct <= -50) return `${Math.round(roiPct)}% on ${asset}. rough one, on to the next`;
  return `−${fixedText(pnl, 2)} on ${asset}. taking the L, moving on`;
}

/** What a share card is about: an open position (Mark) or a closed trade (Exit). */
export interface ShareSubject {
  asset: string;
  side: "up" | "down";
  intervalSec: number;
  pnl: number;
  cost: number;
  entry: number | null;
  exit: number | null;
  closed: boolean;
}

/** The share subject for an open position, valued by the live book. */
export function subjectOfPosition(p: TerminalPosition, live: LivePnlView | null, spot: number | null): ShareSubject | null {
  const { pnl, status } = positionReturn(p, live, Math.floor(Date.now() / 1000));
  if (pnl === null || status !== "priced") return null;
  return {
    asset: p.asset, side: p.side, intervalSec: p.intervalSec, cost: num(p.costBasisBase, p.decimals), pnl,
    entry: p.entrySpot, exit: spot, closed: false,
  };
}

/** The share sheet: the keychain charm with PnL / ROI / Both, Download (PNG) and Share on X with the result's own words. */
export function ShareSheet({ open, onClose, subject }: { open: boolean; onClose: () => void; subject: ShareSubject | null }) {
  const [mode, setMode] = useState<ShareMode>("both");
  const [saving, setSaving] = useState<"idle" | "preparing" | "saving" | "retry">("idle");
  if (!subject) return null;
  const { asset, side, pnl, cost } = subject;
  const roi = cost > 0 ? (pnl / cost) * 100 : 0;
  const signedPnl = `${pnl >= 0 ? "+" : "−"}${fixedText(pnl, 2)}`;
  const signedRoi = `${roi >= 0 ? "+" : "−"}${fixedText(roi, 1)}%`;
  const result = mode === "pnl" ? signedPnl : mode === "roi" ? signedRoi : `${signedPnl} · ${signedRoi}`;
  const call = `${asset} ${side.toUpperCase()} ${subject.intervalSec % 3600 === 0 ? `${subject.intervalSec / 3600}H` : `${Math.round(subject.intervalSec / 60)}M`}`;
  const link = typeof window === "undefined" ? "" : `${window.location.origin}/trade/${asset}`;
  const intent = `https://x.com/intent/post?text=${encodeURIComponent(shareText(asset, side, pnl, roi))}&url=${encodeURIComponent(link)}`;
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title={subject.closed ? "Share trade" : "Share position"}>
      <div className="flex flex-col items-center gap-4">
        <div className="flex gap-1 rounded-full bg-ow-recessed p-1">
          {(["pnl", "roi", "both"] as const).map((m) => (
            <button key={m} type="button" onClick={() => (tap(), setMode(m))} className={cn("h-8 rounded-full px-4 text-ow-caption font-bold uppercase", mode === m ? "bg-ow-ink text-ow-inverse" : "text-ow-muted")}>
              {m === "both" ? "Both" : m}
            </button>
          ))}
        </div>
        <ShareCharm call={call} result={result} win={pnl >= 0} footnote="Private on Canton · owarine" />
        <div className="grid w-full grid-cols-2 gap-2">
          <button
            type="button"
            disabled={saving === "preparing" || saving === "saving"}
            onClick={async () => {
              tap();
              try {
                setSaving("preparing");
                const blob = await renderCharmPng({
                  call, result, win: pnl >= 0, entry: subject.entry ? `$${formatPrice(subject.entry)}` : null, exit: subject.exit ? `$${formatPrice(subject.exit)}` : null,
                  exitLabel: subject.closed ? "Exit" : "Mark", url: link,
                });
                setSaving("saving");
                await saveCharm(blob, `owarine-${asset.toLowerCase()}-${pnl >= 0 ? "profit" : "loss"}.png`);
                setSaving("idle");
              } catch {
                setSaving("retry");
              }
            }}
            className="flex h-12 items-center justify-center rounded-full bg-ow-recessed font-bold disabled:opacity-60"
          >
            {saving === "preparing" ? "Preparing…" : saving === "saving" ? "Saving…" : saving === "retry" ? "Retry" : "Download"}
          </button>
          <a href={intent} target="_blank" rel="noreferrer" onClick={tap} className="flex h-12 items-center justify-center rounded-full bg-ow-ink font-bold text-ow-inverse">
            Share on X
          </a>
        </div>
      </div>
    </Sheet>
  );
}
