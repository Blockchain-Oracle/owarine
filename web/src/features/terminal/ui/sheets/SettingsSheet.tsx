"use client";

import type { Quote } from "@owarine/core/types";
import { Info } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Sheet } from "@/components/kit";
import { haptic } from "@/lib/haptics";
import { playTrade } from "@/lib/sound/trade";
import { cn } from "@/lib/utils";
import { formatPrice } from "../../chart/engine";
import { clockText, multipleOf } from "../../format";
import { DEFAULT_SIZE_SHARE, setTradeSettings, TRAIL_CHOICES, TRAIL_MAX, TRAIL_MIN, useTradeSettings } from "../../settings";

const tap = () => (playTrade("tap"), haptic("tap"));

function Section({ title, tip, right, children }: { title: string; tip: string; right?: ReactNode; children: ReactNode }) {
  const [showTip, setShowTip] = useState(false);
  return (
    <section className="rounded-ow-card bg-ow-recessed/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-ow-micro font-bold tracking-[0.1em] text-ow-muted">
          {title}
          <button type="button" aria-label={`About ${title.toLowerCase()}`} aria-expanded={showTip} onClick={() => setShowTip((s) => !s)} className="text-ow-muted">
            <Info className="size-3.5" />
          </button>
        </span>
        {right ? <span className="text-ow-micro text-ow-muted">{right}</span> : null}
      </div>
      {showTip ? <p className="mt-2 text-ow-caption text-ow-muted">{tip}</p> : null}
      <div className="mt-2">{children}</div>
    </section>
  );
}

function Chips<T extends number>({ values, active, label, onPick }: { values: readonly T[]; active: T | null; label: (v: T) => string; onPick: (v: T) => void }) {
  return (
    <div className="mt-3 grid grid-flow-col gap-2">
      {values.map((v) => (
        <button key={v} type="button" onClick={() => (tap(), onPick(v))} className={cn("h-9 rounded-full text-ow-caption font-bold", active === v ? "ow-up-solid" : "bg-ow-card text-ow-ink")}>
          {label(v)}
        </button>
      ))}
    </div>
  );
}

/**
 * Tradash's "BTC settings" sheet `sT`, on a binary Window: SIZE (the stake, Min/25/50/Max of what is available, % of
 * available, reset), PAYOUT in place of leverage (what each side pays and the risk in words), TRAILING STOP (how far
 * behind the best price the stop follows), and the order summary.
 */
export function SettingsSheet({ open, onClose, symbol, availableCredits, stakeCredits, minCredits, quotes, linePrice, closeSec, demo }: {
  open: boolean;
  onClose: () => void;
  symbol: string;
  availableCredits: number | null;
  stakeCredits: number;
  minCredits: number;
  quotes: { up: Quote | null; down: Quote | null };
  linePrice: number | null;
  closeSec: number | null;
  demo: boolean;
}) {
  const settings = useTradeSettings();
  const max = Math.max(availableCredits ?? stakeCredits * 20, minCredits);
  const share = availableCredits ? Math.round((stakeCredits / availableCredits) * 100) : null;
  const defaultSize = Math.max(minCredits, DEFAULT_SIZE_SHARE * (availableCredits ?? 0));
  const setSize = (v: number) => setTradeSettings({ sizeCredits: Math.round(Math.min(max, Math.max(minCredits, v)) * 1e4) / 1e4 });
  const upTicks = quotes.up ? quotes.up.avgPriceBps / 10 : 0;
  const downTicks = quotes.down ? quotes.down.avgPriceBps / 10 : 0;
  const line = linePrice === null ? "its open" : `$${formatPrice(linePrice)}`;
  const at = closeSec === null ? "the close" : clockText(closeSec);
  const fee = !demo && quotes.up ? (stakeCredits * quotes.up.feeBps) / 10_000 : null;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title={`${symbol} settings`}>
      <div className="flex flex-col gap-3">
        <Section
          title="SIZE"
          tip={`What each trade puts in from your ${demo ? "demo balance" : "seat"}. A right call pays the stake times its payout; a wrong one loses the stake. Minimum ${minCredits.toFixed(2)}.`}
          right={availableCredits === null ? "Balance unavailable" : `${availableCredits.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} available`}
        >
          <div className="flex items-baseline justify-between gap-2">
            <input
              type="number"
              inputMode="decimal"
              step={0.01}
              value={stakeCredits}
              onChange={(e) => setSize(Number(e.target.value))}
              className="ow-num w-full bg-transparent text-ow-title font-bold outline-none"
              aria-label="Stake"
            />
            {share !== null ? <span className="shrink-0 text-ow-micro text-ow-muted">{share}% of available</span> : null}
          </div>
          <input type="range" min={minCredits} max={max} step={0.01} value={Math.min(stakeCredits, max)} onChange={(e) => setSize(Number(e.target.value))} className="mt-2 w-full accent-[var(--ow-up-line)]" aria-label="Stake slider" />
          <div className="mt-3 grid grid-cols-4 gap-2">
            {(
              [
                ["Min", minCredits],
                ["25%", (availableCredits ?? 0) * 0.25],
                ["50%", (availableCredits ?? 0) * 0.5],
                ["Max", availableCredits ?? 0],
              ] as const
            ).map(([label, v]) => (
              <button key={label} type="button" onClick={() => (tap(), setSize(v))} className={cn("h-9 rounded-full text-ow-caption font-bold", Math.abs(stakeCredits - v) < 0.005 ? "ow-up-solid" : "bg-ow-card")}>
                {label}
              </button>
            ))}
          </div>
          {settings.sizeCredits !== null && Math.abs(settings.sizeCredits - defaultSize) > 0.005 ? (
            <button type="button" onClick={() => (tap(), setTradeSettings({ sizeCredits: null }))} className="mt-2 text-ow-caption font-semibold text-ow-pink-ink">
              Reset to default ({defaultSize.toFixed(2)})
            </button>
          ) : null}
        </Section>

        <Section title="PAYOUT" tip="A right call pays its stake times the payout at the Window's close. The payout comes from the venue's price: the closer a side is to winning, the less it pays." right="set by the venue's price">
          <div className="grid grid-cols-2 gap-2">
            <div className="ow-up-soft rounded-ow-card p-3">
              <p className="text-ow-micro font-bold">UP pays</p>
              <p className="ow-num text-ow-title font-bold">{upTicks ? multipleOf(upTicks) : "—"}</p>
            </div>
            <div className="ow-down-soft rounded-ow-card p-3">
              <p className="text-ow-micro font-bold">DOWN pays</p>
              <p className="ow-num text-ow-title font-bold">{downTicks ? multipleOf(downTicks) : "—"}</p>
            </div>
          </div>
          <p className="mt-2 text-ow-caption text-ow-muted">
            Up loses it all if {symbol} closes below {line} at {at}; Down loses it all if it closes at or above.
          </p>
        </Section>

        <Section
          title="TRAILING STOP"
          tip="When you turn on Trail for a trade in profit, a stop follows the price as it moves your way and stays this far behind its best level. If the price pulls back this much, the trade closes and keeps the profit locked in so far."
          right="behind price"
        >
          <p className="ow-num text-ow-title font-bold">{(settings.trailPct * 100).toFixed(2)}%</p>
          <input
            type="range"
            min={TRAIL_MIN * 100}
            max={TRAIL_MAX * 100}
            step={0.1}
            value={settings.trailPct * 100}
            onChange={(e) => setTradeSettings({ trailPct: Math.min(TRAIL_MAX, Math.max(TRAIL_MIN, Number(e.target.value) / 100)) })}
            className="mt-2 w-full accent-[var(--ow-up-line)]"
            aria-label="Trailing stop distance"
          />
          <Chips values={TRAIL_CHOICES} active={TRAIL_CHOICES.find((v) => Math.abs(v - settings.trailPct) < 1e-6) ?? null} label={(v) => `${(v * 100).toFixed(2)}%`} onPick={(v) => setTradeSettings({ trailPct: v })} />
        </Section>

        <dl className="grid grid-cols-2 gap-y-2 px-1 text-ow-caption">
          <dt className="text-ow-muted">Stake</dt>
          <dd className="ow-num text-right">{stakeCredits.toFixed(2)}</dd>
          <dt className="text-ow-muted">Pays if right</dt>
          <dd className="ow-num text-right">
            {upTicks ? (stakeCredits * (1000 / upTicks)).toFixed(2) : "—"} up · {downTicks ? (stakeCredits * (1000 / downTicks)).toFixed(2) : "—"} down
          </dd>
          <dt className="text-ow-muted">Fees</dt>
          <dd className="ow-num text-right">{fee === null ? "Free" : fee.toFixed(4)}</dd>
        </dl>
        {demo ? <p className="px-1 text-ow-micro text-ow-muted">Demo trades are free. On a seat the venue charges its fee in the price.</p> : null}
      </div>
    </Sheet>
  );
}
