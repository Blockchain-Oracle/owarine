/**
 * Operator sends and the deploy record (C1 stub). The reference sent Anchor instructions from a Kit client; on Canton
 * bootstrap uploads DARs and creates the venue's contracts through the Console and the ledger API (C2x). The record
 * shapes and the drift helpers are kept; `send` refuses as not live and sends nothing.
 */
import { cantonNotLive, notDeployedError } from "../stub/not-deployed";
import type { ReadingError } from "../errors/reading-error";
import type { Instruction } from "../ops/shapes";
import type { DeployClient } from "./client";

export type VenueRecord = {
  admin?: string;
  config?: string;
  collateralMint?: string;
  collateralDecimals?: number;
  mintAuthority?: string;
  treasury?: string;
  series?: Record<string, SeriesRecord>;
};

export type SeriesRecord = {
  address: string;
  ticker: number;
  cadenceSec: number;
  basis: number;
  books: string[];
  /** A basket Series: the frozen member base prices (E8, decimal strings) its feed version was registered on. */
  basePrices?: Record<string, string>;
  baseAtSec?: number;
};

export type StepLog = { step: string; signature: string | null; note: string };

/** What sending needs: a role client and somewhere to report each confirmed step. */
export type SendContext = { client: DeployClient; log: (entry: StepLog) => void };

export type StepContext = SendContext & {
  record: VenueRecord;
  save: (record: VenueRecord) => void;
};

/** The error every operator ledger step throws in C1 (`diagnose()` reads it as `not-deployed`). */
export const deployNotLive = (): ReadingError => notDeployedError(cantonNotLive("deploy"));

/** A ledger value that differs from what the script would create. Never auto-corrected: fix the file or the ledger by hand. */
export class DriftError extends Error {
  constructor(what: string, diffs: string[]) {
    super(`${what} drifted from the wanted state:\n  - ${diffs.join("\n  - ")}`);
    this.name = "DriftError";
  }
}

export function assertNoDrift(what: string, diffs: string[]) {
  if (diffs.length > 0) throw new DriftError(what, diffs);
}

export function diffField(out: string[], name: string, chain: unknown, want: unknown) {
  const norm = (v: unknown) => (v instanceof Uint8Array || Array.isArray(v) ? JSON.stringify(Array.from(v as ArrayLike<unknown>, String)) : String(v));
  if (norm(chain) !== norm(want)) out.push(`${name}: chain ${norm(chain)} ≠ want ${norm(want)}`);
}

export const hex = (bytes: ArrayLike<number>) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

/** Sends nothing in C1: refuses with the not-live reason. */
export async function send(_ctx: SendContext, _step: string, _instructions: Instruction[], _note: string): Promise<string> {
  throw deployNotLive();
}

/** A log-safe description of a failed step: the message of each error on the cause chain. */
export function describeSendError(error: unknown): string {
  const parts: string[] = [];
  for (let e: unknown = error, depth = 0; e && depth < 8; e = (e as { cause?: unknown }).cause, depth++) {
    if (e instanceof Error && !parts.includes(e.message)) parts.push(e.message);
  }
  return parts.length > 0 ? parts.join("\n  cause: ") : String(error);
}
