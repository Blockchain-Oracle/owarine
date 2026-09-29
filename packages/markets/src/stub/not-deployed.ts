import { err, type ReadingErr } from "@agari/core/schemas";
import { diagnosis, type Diagnosis } from "@agari/core/types";
import { ReadingError } from "../errors/reading-error";

/**
 * The one honest answer the C1 stub gives for anything that needs the ledger (the reference's D-015, carried to Canton).
 *
 * `@agari/markets` keeps the reference's export map and hook names, but until the Daml packages are on a participant
 * (C2) and the Canton adapter lands (C4) there is no market, ladder, print, balance or ledger clock to read. Every
 * ledger read returns this diagnosis instead of a fabricated value, and every write is refused with it before anything
 * is journaled or signed.
 */
export const NOT_DEPLOYED_TECHNICAL = "Canton adapter not live yet (C1 stub)";

/** The per-area reason every C1 stub states: `"<area>: Canton adapter not live yet (C1 stub)"`. */
export const cantonNotLive = (area: string): string => `${area}: ${NOT_DEPLOYED_TECHNICAL}`;

export function notDeployed(technical: string = NOT_DEPLOYED_TECHNICAL): Diagnosis {
  return diagnosis("not-deployed", technical);
}

export function notDeployedReading(technical?: string): ReadingErr {
  return err(notDeployed(technical));
}

/** For the few reads whose contract is a plain promise rather than a `Reading`: `diagnose()` passes this through intact. */
export function notDeployedError(technical?: string): ReadingError {
  return new ReadingError(notDeployed(technical));
}
