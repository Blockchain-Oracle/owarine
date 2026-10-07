"use client";

import NumberFlow, { type Format } from "@number-flow/react";
import { cn } from "@/lib/utils";

/**
 * Rolling digits for every live number (Tradash's PnL pill rolls at 4 decimals). Display only: the money stays in
 * bigints upstream and arrives here as a plain number for the view.
 *
 *   usd   $1,234.56
 *   pnl   +$12.3456 — signed, and the whole figure flips green/red with its sign (data-dir, 120ms)
 *   pct   +4.20%   — signed percent of a percent value (4.2 → 4.20%)
 *   plain 1,234
 *
 * The spin is short (≈320 ms) because a live figure can change several times a second; a long spin would always be
 * mid-roll. Reduced motion is respected by NumberFlow itself.
 */
export type OdometerKind = "usd" | "pnl" | "pct" | "plain";

export interface OdometerProps {
  value: number;
  kind?: OdometerKind;
  decimals?: number;
  /** For `usd`/`plain`, prefix a `+` on positive values. `pnl` and `pct` are always signed. */
  signed?: boolean;
  /** Colour by sign (pnl and pct do by default). */
  tone?: boolean;
  className?: string;
}

const TIMING = { duration: 320, easing: "cubic-bezier(0.22, 1, 0.36, 1)" } as const;

export function directionOf(value: number): "up" | "down" | "flat" {
  return value > 0 ? "up" : value < 0 ? "down" : "flat";
}

export function Odometer({ value, kind = "usd", decimals, signed, tone, className }: OdometerProps) {
  const dp = decimals ?? (kind === "pnl" ? 4 : kind === "plain" ? 0 : 2);
  const isSigned = kind === "pnl" || kind === "pct" || signed === true;
  const colour = tone ?? (kind === "pnl" || kind === "pct");
  const safe = Number.isFinite(value) ? value : 0;
  const format: Format = {
    ...(kind === "usd" || kind === "pnl" ? { style: "currency", currency: "USD" } : kind === "pct" ? { style: "percent" } : {}),
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
    signDisplay: isSigned ? "exceptZero" : "auto",
  };
  const dir = directionOf(safe);
  return (
    <span
      data-slot="odometer"
      data-dir={colour && dir !== "flat" ? dir : undefined}
      className={cn("ow-num inline-flex whitespace-nowrap", colour && dir !== "flat" && "text-(--ow-dir)", className)}
    >
      <NumberFlow
        locales="en-US"
        value={kind === "pct" ? safe / 100 : safe}
        format={format}
        transformTiming={TIMING}
        spinTiming={TIMING}
        willChange
      />
    </span>
  );
}
