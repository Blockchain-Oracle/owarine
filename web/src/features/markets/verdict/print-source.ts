import { formatEtClock } from "@agari/core/market";
import type { Resolution } from "@agari/core/types";
import { printSourceName } from "../price-source/source-label";

/**
 * "Alpaca IEX price at 16:00:00 ET", "RedStone price at 16:00:00 ET · single source", or null before the Window has
 * settled. The source is the one the Window's policy text names (`printSourceName`).
 * `atSec` is the print's boundary: `expirySec` for the closing print that decides, the Window's start for the opening
 * one. Boundaries fall on whole minutes, so the seconds are always `:00`. Without a boundary the source stands alone.
 */
export function printSourceText(resolution: Pick<Resolution, "printSource" | "printSourceText" | "singleSource"> | null, atSec: number | null, asset: string | null): string | null {
  if (!resolution?.printSource) return null;
  // Every verdict names the signed source its prints came from (PD-1, D-003): on Canton, the original source the oracle
  // parties attested, read from the Window's policy text.
  const label = printSourceName(resolution.printSource, asset, resolution.printSourceText);
  const at = atSec === null ? label : `${label} price at ${formatEtClock(atSec)}:00 ET`;
  return resolution.singleSource ? `${at} · single source` : at;
}
