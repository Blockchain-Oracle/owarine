/**
 * Sending for venue actors (C1 stub). Actors reconcile before they send, so a failure carrying an "already done" code
 * means another writer won the race. On Canton the codes become Daml `failWithStatus` ids (C3); in C1 nothing is
 * sent: `sendOps` throws `OpsSendError` with no code and the not-live reason.
 */
import type { Instruction } from "./shapes";
import { cantonNotLive } from "../stub/not-deployed";
import type { OpsClient } from "./client";

/**
 * The venue-command refusals actors branch on, by name. The reference's numbers were agari-events error codes; they
 * are kept as stable local numbers so `services/ops` still compiles its branches. No Canton rejection maps to them yet.
 */
export const ENGINE_ERROR = {
  badWindowIndex: 6001,
  windowOverlap: 6002,
  noFreeBook: 6003,
  bookMarketMismatch: 6004,
  sourceNotCovered: 6005,
  seatMismatch: 6006,
  postOnlyWouldCross: 6007,
  tooManyOpenOrders: 6008,
  preOpenTakerRefused: 6009,
  marketNotLocked: 6010,
  marketNotTerminal: 6011,
  marketAlreadyTerminal: 6012,
  printAlreadyRecorded: 6013,
  printTooEarly: 6014,
  printTooLate: 6015,
  crossCheckPending: 6016,
  retentionNotElapsed: 6017,
  printsMissing: 6018,
  settlementWindowOpen: 6019,
  openOrdersRemain: 6020,
  ledgerNotEmpty: 6021,
  dependentsRemain: 6022,
  bookNotReleased: 6023,
  ledgerNotClosed: 6024,
} as const;

/** The venue refusal code on an error's cause chain, or null. None exists in C1. */
export function engineErrorCode(error: unknown): number | null {
  for (let e: unknown = error, depth = 0; e && depth < 8; e = (e as { cause?: unknown }).cause, depth++) {
    if (e instanceof OpsSendError) return e.code;
  }
  return null;
}

/** A failed send: `code` is the venue refusal (null for anything else); `message` is log-safe. */
export class OpsSendError extends Error {
  readonly code: number | null;
  constructor(label: string, cause: unknown, code: number | null = null) {
    super(`${label} failed: ${cause instanceof Error ? cause.message : String(cause)}`, { cause });
    this.name = "OpsSendError";
    this.code = code;
  }
}

export const SEND_TIMEOUT_MS = 120_000;

/** Nothing is sent in C1: every send throws `OpsSendError` with the not-live reason. */
export async function sendOps(_client: OpsClient, _instructions: Instruction[], label: string): Promise<{ signature: string }> {
  throw new OpsSendError(label, new Error(cantonNotLive("ops")));
}
