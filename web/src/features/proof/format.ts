import type { Exchange } from "@agari/core/proof";

const E8 = 100_000_000n;

/** A price in 1e-8 units as the proof page writes prices: two decimals, grouped, rounded half up. "—" for none. */
export function priceE8Text(e8: string | bigint | null): string {
  if (e8 === null) return "—";
  const v = typeof e8 === "bigint" ? e8 : BigInt(e8);
  const cents = (v * 100n + E8 / 2n) / E8;
  const whole = cents / 100n;
  const frac = (cents % 100n).toString().padStart(2, "0");
  return `${whole.toLocaleString("en-US")}.${frac}`;
}

/** The exact integer the quote carries: "11234567000000 × 10⁻⁸". */
export const e8Text = (e8: string | null): string => (e8 === null ? "—" : `${e8} × 10⁻⁸`);

export const EXCHANGE_NAME: Readonly<Record<Exchange, string>> = { coinbase: "Coinbase", kraken: "Kraken", bitstamp: "Bitstamp" };

/** "Coinbase", or the party's hint when it names no exchange. */
export const oracleName = (exchange: Exchange | null, party: string): string => (exchange ? EXCHANGE_NAME[exchange] : (party.split("::")[0] ?? party));

/** "T + 10 s" after a boundary. */
export const afterT = (sec: number, boundarySec: number): string => `T + ${sec - boundarySec} s`;
