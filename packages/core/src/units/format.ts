import { oneUnit } from "./decimals";

export interface FormatBaseUnitsOptions {
  maxDp?: number;
  minDp?: number;
  signed?: boolean;
  group?: boolean;
}

const DECIMAL_RE = /^(\d*)(?:\.(\d*))?$/;

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Renders base units as a decimal string without ever touching a float. Past `maxDp` it floors (never rounds half): a
 * balance shows the whole cents it holds, and a loss the whole cents it took, so a cent-exact start, the balance after
 * and the change between them always agree on screen (C4f: a record of −0.629126 read "−0.62" while the balance had
 * gone from 1,000.00 to 999.37). A positive value is truncated, as before.
 */
export function formatBaseUnits(value: bigint, decimals: number, options: FormatBaseUnitsOptions = {}): string {
  const { maxDp = 2, minDp = 2, signed = false, group = true } = options;
  const negative = value < 0n;
  const one = oneUnit(decimals);
  const step = oneUnit(Math.max(0, decimals - maxDp));
  const exact = negative ? -value : value;
  const cut = exact % step;
  // Toward −∞: a negative value's dropped digits make it one shown step larger in magnitude.
  const magnitude = negative && cut !== 0n ? exact - cut + step : exact;
  const whole = (magnitude / one).toString();
  const fractionDigits = (magnitude % one).toString().padStart(decimals, "0");
  let fraction = fractionDigits.slice(0, Math.min(maxDp, decimals)).replace(/0+$/, "");
  if (fraction.length < minDp) fraction = fraction.padEnd(minDp, "0");
  const wholeText = group ? groupThousands(whole) : whole;
  const body = fraction.length > 0 ? `${wholeText}.${fraction}` : wholeText;
  if (negative) return `-${body}`;
  return signed && value > 0n ? `+${body}` : body;
}

/** Parses user-typed decimals into base units; returns null for anything that is not a plain non-negative decimal. */
export function parseDecimalToBaseUnits(text: string, decimals: number): bigint | null {
  const match = DECIMAL_RE.exec(text.trim().replace(/,/g, ""));
  if (!match) return null;
  const [, wholeRaw = "", fractionRaw = ""] = match;
  if (wholeRaw === "" && fractionRaw === "") return null;
  const fraction = fractionRaw.slice(0, decimals).padEnd(decimals, "0");
  return BigInt(wholeRaw || "0") * oneUnit(decimals) + BigInt(fraction || "0");
}

/** Oracle answers arrive in a question-specific scale pinned by the Story 1.4 spike. */
export function formatOracleRaw(value: bigint, scale: number, maxDp = 2): string {
  return formatBaseUnits(value, scale, { maxDp, minDp: maxDp });
}
