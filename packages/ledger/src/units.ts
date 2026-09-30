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

// ---- The Canton Coin rail at the CIP-56 edge (C7b, K-245) ---------------------------------------
//
// The mirror of `daml/abu-pm-cc/daml/PM/CC/Units.daml`, vector for vector (`units.test.ts`). A CIP-56 amount is a Daml
// `Decimal` = `Numeric 10`: a whole number of atomic units of 10^-10 of the instrument. A listing states its rate as
// `unitsPerCoin`, cash base units per one whole coin, and the rate divides 10^10, so one cash unit is a whole number of
// atomic units and nothing here ever rounds: a deposit that is not a whole number of cash units is refused as dust. The
// one rounding is `floorCashUnits`, for the ASSETS side of a reserve statement, which may understate and never overstate.

/** Atomic units per whole coin: a Decimal has 10 places. */
export const ATOMIC_PER_COIN = 10n ** BigInt(DECIMAL_SCALE);
/** The largest whole-coin amount one conversion carries (so an atomic amount stays below 10^17, inside int64). */
export const MAX_WHOLE_COINS = 10_000_000n;
export const MAX_ATOMIC = MAX_WHOLE_COINS * ATOMIC_PER_COIN;
/** The bound on any total the rail sums (allowances, liabilities), mirroring `maxTotalUnits`. */
export const MAX_TOTAL_UNITS = 4_000_000_000_000_000_000n;

/** A stated rate: positive, at most 10^10, dividing 10^10 exactly (so cash units convert with no rounding). */
export function ccRateOk(unitsPerCoin: bigint): boolean {
  return unitsPerCoin > 0n && unitsPerCoin <= ATOMIC_PER_COIN && ATOMIC_PER_COIN % unitsPerCoin === 0n;
}

function assertRate(unitsPerCoin: bigint): bigint {
  if (!ccRateOk(unitsPerCoin)) throw new UnitsError(`rate ${unitsPerCoin} does not divide 10^10 (cash units per whole coin)`);
  return unitsPerCoin;
}

/** Atomic units in one cash base unit at this rate. */
export function atomicPerCashUnit(unitsPerCoin: bigint): bigint {
  return ATOMIC_PER_COIN / assertRate(unitsPerCoin);
}

/** The most cash units one conversion may carry at this rate. */
export function maxCashUnits(unitsPerCoin: bigint): bigint {
  return MAX_ATOMIC / atomicPerCashUnit(unitsPerCoin);
}

/**
 * A CIP-56 `Decimal` string → atomic units. Exact: throws on more than 10 places, on a non-positive amount and on one
 * above `MAX_WHOLE_COINS` (the Daml `toAtomic` answers None for the last two).
 */
export function ccToAtomic(amount: unknown, what = "amount"): bigint {
  const atomic = fromDamlNumeric(amount, DECIMAL_SCALE, what);
  if (atomic <= 0n) throw new UnitsError(`${what} ${String(amount)} must be positive`);
  if (atomic > MAX_ATOMIC) throw new UnitsError(`${what} ${String(amount)} is above ${MAX_WHOLE_COINS} coins`);
  return atomic;
}

/** Atomic units → the `Decimal` string a CIP-56 command carries. */
export function atomicToCc(atomic: bigint): string {
  if (atomic < 0n || atomic > MAX_ATOMIC) throw new UnitsError(`atomic amount ${atomic} is outside 0..${MAX_ATOMIC}`);
  return toDamlNumeric(atomic, DECIMAL_SCALE);
}

/** True when this atomic amount is a whole number of cash units at the rate (the deposit rule). */
export function isWholeCashUnits(atomic: bigint, unitsPerCoin: bigint): boolean {
  return atomic > 0n && atomic % atomicPerCashUnit(unitsPerCoin) === 0n;
}

/** Cash units for exactly this atomic amount; throws `UnitsError("dust …")` when it is not a whole number of units. */
export function atomicToCashUnitsExact(atomic: bigint, unitsPerCoin: bigint): bigint {
  const per = atomicPerCashUnit(unitsPerCoin);
  if (atomic <= 0n) throw new UnitsError(`atomic amount ${atomic} must be positive`);
  if (atomic % per !== 0n) throw new UnitsError(`dust: ${atomic} atomic units is not a whole number of cash units at ${unitsPerCoin} per coin`);
  return atomic / per;
}

/** A CIP-56 amount string → cash units, exact or refused as dust. */
export function ccToCashUnitsExact(amount: unknown, unitsPerCoin: bigint): bigint {
  return atomicToCashUnitsExact(ccToAtomic(amount), unitsPerCoin);
}

/** Cash units → the coin amount string a withdrawal transfers. Always exact; bounded. */
export function cashUnitsToCc(units: bigint, unitsPerCoin: bigint): string {
  if (units <= 0n || units > maxCashUnits(unitsPerCoin)) throw new UnitsError(`${units} cash units is outside the rail's bounds at ${unitsPerCoin} per coin`);
  return atomicToCc(units * atomicPerCashUnit(unitsPerCoin));
}

/** Cash units of an atomic amount, rounded DOWN: the assets side of a reserve statement (never overstates). */
export function floorCashUnits(atomic: bigint, unitsPerCoin: bigint): bigint {
  if (atomic < 0n) throw new UnitsError("atomic amount must not be negative");
  return atomic / atomicPerCashUnit(unitsPerCoin);
}

/** The largest amount (as a `Decimal` string) at most `desired` that the rail accepts: what a form rounds a typed amount DOWN to. */
export function largestAcceptedCc(desired: unknown, unitsPerCoin: bigint): string | null {
  const atomic = fromDamlNumeric(desired, DECIMAL_SCALE, "amount");
  const per = atomicPerCashUnit(unitsPerCoin);
  const floored = (atomic / per) * per;
  return floored > 0n && floored <= MAX_ATOMIC ? atomicToCc(floored) : null;
}
