import type { Diagnosis, Quote } from "@owarine/core/types";

/** A pre-send step refused the write; the lane turns it into a `refused` outcome with this diagnosis. */
export class OrderRefusedError extends Error {
  constructor(readonly diagnosis: Diagnosis) {
    super(diagnosis.technical);
    this.name = "OrderRefusedError";
  }
}

/** The fresh quote breached the confirmed cap; the lane surfaces the new quote instead of sending (FR-9). */
export class RequoteError extends Error {
  constructor(readonly quote: Quote) {
    super("fresh quote exceeds the confirmed max cost");
    this.name = "RequoteError";
  }
}

/**
 * What the ledger said about a command that did not succeed: in `prepare` (the dry run), at submission, or once
 * completed. The reference's Solana shape is kept (C4 maps Canton rejections onto it): `engineCode` carries a stable
 * `failWithStatus` id's number when the choice says one, `err` the raw rejection, `logs` its message lines.
 */
export interface ChainFailure {
  engineCode: number | null;
  err: unknown;
  logs: readonly string[];
}

/** The dry run (or submission) refused the command: nothing was committed. */
export class SimulationFailedError extends Error {
  constructor(
    readonly failure: ChainFailure,
    readonly stage: "simulation" | "preflight",
  ) {
    super(`${stage} failed: ${describeChainFailure(failure)}`);
    this.name = "SimulationFailedError";
  }
}

const jsonSafe = (_key: string, value: unknown) => (typeof value === "bigint" ? value.toString() : value);

export function describeChainFailure(failure: ChainFailure): string {
  const tail = failure.logs.filter((line) => /Program log|failed|error/i.test(line)).slice(-4);
  const head = failure.engineCode === null ? JSON.stringify(failure.err, jsonSafe) : `venue ${failure.engineCode}`;
  return [head, ...tail].join(" | ");
}
