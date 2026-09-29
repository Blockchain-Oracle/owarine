import { DEFAULT_CLUSTER, PROOF_BASE_PATH } from "@agari/core/constants";
import { DEVNET_DEFAULTS } from "./env";

/** The Canton network the product targets. Receipt links carry it: build them with core `txUrl`/`addressUrl`. */
export const CLUSTER = DEFAULT_CLUSTER;
/** Our own ledger route handlers; the browser never holds a ledger endpoint or credential. */
export const LEDGER_API_PATH: string = DEVNET_DEFAULTS.ledgerApiPath;
/** Where a receipt's proof lives: the product's own `/proof` page (Canton updates are private; no public explorer shows them). */
export const EXPLORER_URL = PROOF_BASE_PATH;
