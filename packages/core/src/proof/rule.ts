/**
 * The resolution rule, in integers, exactly as the ledger applies it (`daml/abu-pm-main/daml/PM/Oracle.daml`,
 * `PM/Market.daml`): lower median of the counted prices, "disagrees" when `(max − min) × 10 000 > maxDeviationBps ×
 * median`, a void reason named from the count against the quorum, and the winner by the close median against the open
 * median (a tie goes to `tieUp`). Pure; the proof page recomputes a Resolution with it and compares.
 */
export type ProofSlot = "open" | "close";
export type ProofSide = "up" | "down";
export type VoidKind = "MissingPrint" | "QuorumNotMet" | "ResolverAbsent" | "SourceDisagreement";

export interface ProofVoid {
  kind: VoidKind;
  slot: ProofSlot;
}

const cmp = (a: bigint, b: bigint) => (a < b ? -1 : a > b ? 1 : 0);

/** Lower median (`medianOf`): an observed price, never an average. Null for no prices. */
export function lowerMedian(prices: readonly bigint[]): bigint | null {
  if (prices.length === 0) return null;
  const sorted = [...prices].sort(cmp);
  return sorted[Math.floor((sorted.length - 1) / 2)]!;
}

/** `(max − min)` of the prices, 0n for fewer than two. */
export function spreadOf(prices: readonly bigint[]): bigint {
  if (prices.length < 2) return 0n;
  const sorted = [...prices].sort(cmp);
  return sorted[sorted.length - 1]! - sorted[0]!;
}

/** The ledger's `disagrees`: `(max − min) × 10 000 > maxDeviationBps × median`. False for no prices. */
export function disagrees(maxDeviationBps: number, prices: readonly bigint[]): boolean {
  const median = lowerMedian(prices);
  if (median === null) return false;
  return spreadOf(prices) * 10_000n > BigInt(maxDeviationBps) * median;
}

/** The spread against the median in whole basis points, rounded down (for display; the verdict is `disagrees`). */
export function spreadBps(prices: readonly bigint[]): bigint | null {
  const median = lowerMedian(prices);
  if (median === null || median <= 0n) return null;
  return (spreadOf(prices) * 10_000n) / median;
}

/** The ledger's `missingReason`: why a slot voided at its deadline, from how many quotes counted. */
export function missingReason(quorum: number, counted: number, slot: ProofSlot): ProofVoid {
  if (counted === 0) return { kind: "MissingPrint", slot };
  if (counted < quorum) return { kind: "QuorumNotMet", slot };
  return { kind: "ResolverAbsent", slot };
}

/** Close against open; the tie goes to `tieUp`. */
export function winnerOf(openE8: bigint, closeE8: bigint, tieUp: boolean): ProofSide {
  if (closeE8 > openE8) return "up";
  if (closeE8 < openE8) return "down";
  return tieUp ? "up" : "down";
}

/** `SourceDisagreement:CloseSlot` (the projection's `void_detail`) → a typed reason; null when it names none. */
export function parseVoidDetail(detail: string | null): ProofVoid | null {
  if (!detail) return null;
  const [kind, slot] = detail.split(":");
  const kinds: readonly string[] = ["MissingPrint", "QuorumNotMet", "ResolverAbsent", "SourceDisagreement"];
  if (!kind || !kinds.includes(kind)) return null;
  return { kind: kind as VoidKind, slot: slot === "OpenSlot" ? "open" : "close" };
}
