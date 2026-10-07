/** The odometer's text for a value: grouped, fixed decimals, a real minus sign, `+` when signed. Pure; tested. */
export type OdometerKind = "usd" | "pnl" | "pct" | "plain";

export function formatOdometer(value: number, kind: OdometerKind, decimals: number, signed: boolean): string {
  const v = Number.isFinite(value) ? value : 0;
  const abs = Math.abs(v);
  const fixed = abs.toFixed(decimals);
  const [int = "0", frac] = fixed.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const body = frac !== undefined ? `${grouped}.${frac}` : grouped;
  const isZero = Number(fixed) === 0;
  const sign = v < 0 && !isZero ? "−" : signed && !isZero ? "+" : "";
  if (kind === "usd" || kind === "pnl") return `${sign}$${body}`;
  if (kind === "pct") return `${sign}${body}%`;
  return `${sign}${body}`;
}
