/**
 * Command ids. Each builder yields the SAME id for the same logical action, so a crash-retry is
 * deduplicated by the participant (within its dedup period, for the same actAs set) instead of
 * executing twice.
 *
 * Ledger strings: at most 255 characters matching `[A-Za-z0-9#:\-_/ ]+`
 * (`com/daml/ledger/api/v2/value.proto`, via refs/official/wallet/core/ledger-proto value.ts:31).
 * Note: `.` is NOT allowed, so ISO timestamps with fractions and dotted names are rejected.
 */

export const LEDGER_STRING_MAX = 255;
const LEDGER_STRING = /^[A-Za-z0-9#:\-_/ ]+$/;

export class InvalidLedgerStringError extends Error {
  override readonly name = "InvalidLedgerStringError";
}

export function isLedgerString(s: string): boolean {
  return s.length > 0 && s.length <= LEDGER_STRING_MAX && LEDGER_STRING.test(s);
}

export function assertLedgerString(s: string, what = "ledger string"): string {
  if (s.length === 0) throw new InvalidLedgerStringError(`${what} is empty`);
  if (s.length > LEDGER_STRING_MAX) throw new InvalidLedgerStringError(`${what} is ${s.length} chars; the limit is ${LEDGER_STRING_MAX}`);
  const bad = [...s].find((ch) => !LEDGER_STRING.test(ch));
  if (bad !== undefined) throw new InvalidLedgerStringError(`${what} contains ${JSON.stringify(bad)}; allowed: A-Z a-z 0-9 # : - _ / space`);
  return s;
}

export const assertCommandId = (id: string): string => assertLedgerString(id, "commandId");

/** Components must not contain the `:` separator, so ids can be parsed back unambiguously. */
function part(s: string, what: string): string {
  if (s.length === 0) throw new InvalidLedgerStringError(`${what} is empty`);
  if (s.includes(":")) throw new InvalidLedgerStringError(`${what} must not contain ':'`);
  return s;
}

function nonNegInt(v: number | bigint, what: string): string {
  const b = typeof v === "bigint" ? v : Number.isSafeInteger(v) ? BigInt(v) : NaN;
  if (typeof b !== "bigint" || b < 0n) throw new InvalidLedgerStringError(`${what} must be a non-negative integer`);
  return b.toString();
}

/** `open:<series>:<index>`: `Series_OpenWindow` for window `index` of `series`. */
export function openWindowCommandId(series: string, index: number | bigint): string {
  return assertCommandId(`open:${part(series, "series")}:${nonNegInt(index, "index")}`);
}

/**
 * `print:<oracle>:<T>`: one oracle's prints for boundary `T` (epoch seconds), all symbols in one
 * command. `oracle` is a short role name (e.g. `coinbase`), not the party id, to keep ids readable.
 */
export function printCommandId(oracle: string, boundaryEpochS: number | bigint): string {
  return assertCommandId(`print:${part(oracle, "oracle")}:${nonNegInt(boundaryEpochS, "boundary")}`);
}

/** `resolve:<termsCid>`: the one resolve-or-void of a market. Contract ids are hex, ~138 chars. */
export function resolveCommandId(termsCid: string): string {
  return assertCommandId(`resolve:${part(termsCid, "termsCid")}`);
}

/**
 * A journal-backed id (the submitter journal's UUID) as a commandId. UUIDs are ledger strings
 * already; the prefix names the intent for the completions log.
 */
export function journalCommandId(intent: string, journalId: string): string {
  return assertCommandId(`${part(intent, "intent")}:${part(journalId, "journalId")}`);
}
