/**
 * What a position pays its owner when its Window ends, as the ledger pays it: `PM.Leg.legPayout` in abu-pm-main.
 *
 *   won    the leg's quantity: one collateral base unit per outcome base unit (one credit per contract)
 *   lost   nothing
 *   void   what the leg cost: its backing plus the fee paid when the call filled
 *
 * The fee is charged once, with the stake, when the call fills. The leg holds it; the venue keeps it only at a non-void
 * settle and returns it on a void. Nothing is taken at settlement, so a win is paid in full. (The reference engine paid a
 * void half a contract per leg; Canton refunds the leg's cost instead, so a void needs what the leg cost, never just its
 * size.)
 */

/** How a held leg ended. */
export type LegResult = "win" | "loss" | "void";

/** A held position's own figures, in base units. */
export interface LegFigures {
  /** Outcome base units held: `lots × 1000 × cashUnit` on the ledger. */
  quantityRaw: bigint;
  /** What the leg cost its owner: `backingShare + feePaid`. */
  paidBase: bigint;
}

/** What a winning holding pays: one collateral base unit per outcome base unit, nothing deducted. */
export function winPayoutBase(quantityRaw: bigint): bigint {
  return quantityRaw;
}

/** `PM.Leg.legPayout`: the owner's payout for one leg under its Window's result. */
export function legPayoutBase(leg: LegFigures, result: LegResult): bigint {
  if (result === "void") return leg.paidBase;
  return result === "win" ? winPayoutBase(leg.quantityRaw) : 0n;
}

/**
 * Splits a known total refund across held sides in proportion to their size, the remainder on the last side, so the
 * parts always sum to the total. Exact for one side; for two sides it apportions a total the ledger reported as one sum.
 */
export function apportionBase(totalBase: bigint, sizes: readonly bigint[]): bigint[] {
  const whole = sizes.reduce((sum, size) => sum + size, 0n);
  if (whole === 0n) return sizes.map(() => 0n);
  let given = 0n;
  return sizes.map((size, i) => {
    if (i === sizes.length - 1) return totalBase - given;
    const part = (totalBase * size) / whole;
    given += part;
    return part;
  });
}
