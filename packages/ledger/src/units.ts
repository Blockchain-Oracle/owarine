/**
 * The single conversion boundary between Daml JSON values and money in TypeScript (plan §7).
 * Money is `bigint` on our side and a decimal string on the wire; `Number` never touches it.
 *
 * - Daml `Int` is a signed 64-bit integer, JSON-encoded as a string (e.g. `"1500"`).
 * - Daml `Numeric n` / `Decimal` (= `Numeric 10`) is a string such as `"1.5000000000"`; it appears only
 *   at the CIP-56 edge and is converted to integer base units with no rounding, ever.
 * - Prices are ticks 1..999 of 1000; sizes are lots; `cashUnit` is base units per lot-tick.
 */

export const INT64_MIN = -(2n ** 63n);
export const INT64_MAX = 2n ** 63n - 1n;
export const TICKS_PER_UNIT = 1000n;
/** The fee denominator: bps (10^4) × ticks² (10^6). */
export const FEE_DENOMINATOR = 10_000_000_000n;
export const DECIMAL_SCALE = 10;

export class UnitsError extends Error {
  override readonly name = "UnitsError";
}

export function assertInt64(v: bigint, what = "value"): bigint {
  if (v < INT64_MIN || v > INT64_MAX) throw new UnitsError(`${what} ${v} overflows Daml Int (int64)`);
  return v;
}

/** Daml `Int` JSON → bigint. Strings only: a JSON number may already have lost precision. */
export function fromDamlInt(v: unknown, what = "Int"): bigint {
  if (typeof v !== "string") throw new UnitsError(`${what} must be a JSON string, got ${typeof v}`);
  if (!/^-?\d+$/.test(v)) throw new UnitsError(`${what} ${JSON.stringify(v)} is not an integer string`);
  return assertInt64(BigInt(v), what);
}

/** bigint → Daml `Int` JSON (a string). */
export function toDamlInt(v: bigint, what = "Int"): string {
  return assertInt64(v, what).toString();
}

/**
 * Daml `Numeric` string → integer units of 10^-`decimals`. Exact: throws if the value has non-zero
 * digits beyond `decimals` (no rounding). E.g. `fromDamlNumeric("1.5", 6) === 1_500_000n`.
 */
export function fromDamlNumeric(v: unknown, decimals: number = DECIMAL_SCALE, what = "Numeric"): bigint {
  if (typeof v !== "string") throw new UnitsError(`${what} must be a JSON string, got ${typeof v}`);
  checkDecimals(decimals);
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(v);
  if (!m) throw new UnitsError(`${what} ${JSON.stringify(v)} is not a decimal string`);
  const [, sign, whole, frac = ""] = m;
  const kept = frac.slice(0, decimals);
  const dropped = frac.slice(decimals);
  if (/[1-9]/.test(dropped)) throw new UnitsError(`${what} ${v} has more than ${decimals} decimal places`);
  const units = BigInt(whole! + kept.padEnd(decimals, "0"));
  return sign === "-" ? -units : units;
}

/** Integer units of 10^-`decimals` → Daml `Numeric` string with exactly `decimals` places. */
export function toDamlNumeric(units: bigint, decimals: number = DECIMAL_SCALE): string {
  checkDecimals(decimals);
  const neg = units < 0n;
  const abs = (neg ? -units : units).toString().padStart(decimals + 1, "0");
  const whole = abs.slice(0, abs.length - decimals);
  const frac = abs.slice(abs.length - decimals);
  return `${neg ? "-" : ""}${whole}${decimals > 0 ? `.${frac}` : ""}`;
}

function checkDecimals(d: number): void {
  if (!Number.isInteger(d) || d < 0 || d > 37) throw new UnitsError(`decimals ${d} out of range 0..37`);
}

/** Integer ceiling division for a ≥ 0, b > 0: `(a + b − 1) / b`, the form the Daml `ensure` mirrors. */
export function ceilDiv(a: bigint, b: bigint): bigint {
  if (b <= 0n) throw new UnitsError("ceilDiv divisor must be positive");
  if (a < 0n) throw new UnitsError("ceilDiv numerator must be non-negative");
  return (a + b - 1n) / b;
}

export function assertTicks(ticks: bigint): bigint {
  if (ticks < 1n || ticks > TICKS_PER_UNIT - 1n) throw new UnitsError(`ticks ${ticks} outside 1..999`);
  return ticks;
}

export function assertLots(lots: bigint): bigint {
  if (lots <= 0n) throw new UnitsError(`lots ${lots} must be positive`);
  return lots;
}

export function assertCashUnit(cashUnit: bigint): bigint {
  if (cashUnit <= 0n) throw new UnitsError(`cashUnit ${cashUnit} must be positive`);
  return cashUnit;
}

/** What the user stakes for `lots` at `ticks`: `lots × ticks × cashUnit`. */
export function userStake(lots: bigint, ticks: bigint, cashUnit: bigint): bigint {
  return assertInt64(assertLots(lots) * assertTicks(ticks) * assertCashUnit(cashUnit), "userStake");
}

/** What the venue stakes against it: `lots × (1000 − ticks) × cashUnit`. */
export function venueStake(lots: bigint, ticks: bigint, cashUnit: bigint): bigint {
  return assertInt64(assertLots(lots) * (TICKS_PER_UNIT - assertTicks(ticks)) * assertCashUnit(cashUnit), "venueStake");
}

/** The pair's full backing: `lots × 1000 × cashUnit` = userStake + venueStake. */
export function quantity(lots: bigint, cashUnit: bigint): bigint {
  return assertInt64(assertLots(lots) * TICKS_PER_UNIT * assertCashUnit(cashUnit), "quantity");
}

/**
 * Fee `⌈quantity × rateBps × t × (1000 − t) / 10¹⁰⌉` (plan §7). The intermediate product is checked
 * against int64 because the Daml side computes the same product in `Int` and aborts on overflow.
 */
export function fee(lots: bigint, ticks: bigint, cashUnit: bigint, rateBps: bigint): bigint {
  if (rateBps < 0n) throw new UnitsError(`rateBps ${rateBps} must be non-negative`);
  const t = assertTicks(ticks);
  const product = assertInt64(quantity(lots, cashUnit) * rateBps * t * (TICKS_PER_UNIT - t), "fee numerator");
  return ceilDiv(product, FEE_DENOMINATOR);
}

/** Parse a decimal string of base units (e.g. from an env var or a form) into bigint, strictly. */
export function parseBaseUnits(v: string, what = "amount"): bigint {
  if (!/^\d+$/.test(v)) throw new UnitsError(`${what} ${JSON.stringify(v)} must be a non-negative integer string`);
  return BigInt(v);
}
