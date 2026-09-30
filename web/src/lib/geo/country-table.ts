/**
 * An IP-to-country table read from DB-IP's "IP to Country Lite" CSV (`start,end,CC` per line, IPv4 and IPv6 ranges,
 * sorted and non-overlapping). DB-IP Lite is CC BY 4.0; the attribution is on `/legal` (K-003).
 *
 * Pure on purpose, no `fs`: the loader (`country-db.server.ts`) reads the file, and tests build a table from a string.
 * IPv4 ranges live in two Uint32Arrays; IPv6 ranges as high/low 64-bit halves in BigUint64Arrays, so the whole
 * 700k-line table costs about 12 MB instead of a BigInt per bound.
 */

export interface CountryTable {
  readonly v4Start: Uint32Array;
  readonly v4End: Uint32Array;
  readonly v4Code: Uint16Array;
  readonly v6StartHi: BigUint64Array;
  readonly v6StartLo: BigUint64Array;
  readonly v6EndHi: BigUint64Array;
  readonly v6EndLo: BigUint64Array;
  readonly v6Code: Uint16Array;
  readonly codes: readonly string[];
}

const MASK64 = (1n << 64n) - 1n;

/** Dotted IPv4 to an unsigned 32-bit number, or null. */
export function parseIpv4(text: string): number | null {
  const parts = text.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = value * 256 + octet;
  }
  return value;
}

/** IPv6 (with `::` and an optional dotted IPv4 tail) to a 128-bit BigInt, or null. */
export function parseIpv6(text: string): bigint | null {
  let head = text.split("%")[0] ?? "";
  if (!head.includes(":")) return null;
  const tail = /(\d+\.\d+\.\d+\.\d+)$/.exec(head)?.[1];
  if (tail) {
    const v4 = parseIpv4(tail);
    if (v4 === null) return null;
    head = `${head.slice(0, -tail.length)}${((v4 >>> 16) & 0xffff).toString(16)}:${(v4 & 0xffff).toString(16)}`;
  }
  const halves = head.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const fill = 8 - left.length - right.length;
  if (halves.length === 1 ? left.length !== 8 : fill < 1) return null;
  const groups = halves.length === 2 ? [...left, ...Array<string>(fill).fill("0"), ...right] : left;
  let value = 0n;
  for (const group of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(group)) return null;
    value = (value << 16n) | BigInt(parseInt(group, 16));
  }
  return value;
}

/** An address as the table keys it: IPv4 (including `::ffff:a.b.c.d`) or IPv6. */
export function parseIp(text: string): { v4: number } | { v6: bigint } | null {
  const trimmed = text.trim().replace(/^\[|\]$/g, "");
  const v4 = parseIpv4(trimmed);
  if (v4 !== null) return { v4 };
  const v6 = parseIpv6(trimmed);
  if (v6 === null) return null;
  if (v6 >> 32n === 0xffffn) return { v4: Number(v6 & 0xffffffffn) };
  return { v6 };
}

/** Builds the table from the CSV text. Lines that do not parse are skipped, never fatal. */
export function buildCountryTable(csv: string): CountryTable {
  const codes: string[] = [];
  const codeIndex = new Map<string, number>();
  const v4: [number, number, number][] = [];
  const v6: [bigint, bigint, number][] = [];
  for (const line of csv.split("\n")) {
    const [startText, endText, rawCode] = line.split(",");
    const code = rawCode?.trim().toUpperCase();
    if (!startText || !endText || !code || !/^[A-Z]{2}$/.test(code)) continue;
    let index = codeIndex.get(code);
    if (index === undefined) {
      index = codes.push(code) - 1;
      codeIndex.set(code, index);
    }
    const a = parseIpv4(startText);
    const b = parseIpv4(endText);
    if (a !== null && b !== null) {
      v4.push([a, b, index]);
      continue;
    }
    const c = parseIpv6(startText);
    const d = parseIpv6(endText);
    if (c !== null && d !== null) v6.push([c, d, index]);
  }
  v4.sort((x, y) => x[0] - y[0]);
  v6.sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0));
  return {
    v4Start: Uint32Array.from(v4, (r) => r[0]),
    v4End: Uint32Array.from(v4, (r) => r[1]),
    v4Code: Uint16Array.from(v4, (r) => r[2]),
    v6StartHi: BigUint64Array.from(v6, (r) => r[0] >> 64n),
    v6StartLo: BigUint64Array.from(v6, (r) => r[0] & MASK64),
    v6EndHi: BigUint64Array.from(v6, (r) => r[1] >> 64n),
    v6EndLo: BigUint64Array.from(v6, (r) => r[1] & MASK64),
    v6Code: Uint16Array.from(v6, (r) => r[2]),
    codes,
  };
}

/** Index of the last range whose start is at or below the key, or -1. */
function floorIndex(length: number, startAtOrBelow: (i: number) => boolean): number {
  let lo = 0;
  let hi = length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (startAtOrBelow(mid)) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

/**
 * The ISO 3166-1 alpha-2 country for an address, or null when the address does not parse or no range holds it.
 * DB-IP marks reserved space `ZZ`; that is returned as null too, so a private address is never a country.
 */
export function lookupCountry(table: CountryTable, ip: string): string | null {
  const parsed = parseIp(ip);
  if (!parsed) return null;
  let code: number | undefined;
  if ("v4" in parsed) {
    const i = floorIndex(table.v4Start.length, (m) => (table.v4Start[m] ?? 0) <= parsed.v4);
    if (i >= 0 && parsed.v4 <= (table.v4End[i] ?? -1)) code = table.v4Code[i];
  } else {
    const hi = parsed.v6 >> 64n;
    const lo = parsed.v6 & MASK64;
    const le = (aHi: bigint, aLo: bigint, bHi: bigint, bLo: bigint) => aHi < bHi || (aHi === bHi && aLo <= bLo);
    const i = floorIndex(table.v6StartHi.length, (m) => le(table.v6StartHi[m] ?? 0n, table.v6StartLo[m] ?? 0n, hi, lo));
    if (i >= 0 && le(hi, lo, table.v6EndHi[i] ?? 0n, table.v6EndLo[i] ?? 0n)) code = table.v6Code[i];
  }
  const country = code === undefined ? null : (table.codes[code] ?? null);
  return country === "ZZ" ? null : country;
}
