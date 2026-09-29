/**
 * The parlay reserve (C8, under `PM.Reserve`). Until it is on the participant: no reserve (null), no tickets, no
 * shares. These are the truthful answers, not faults (D-015).
 */
import type { ParlayReserveState, ParlayTicket } from "@agari/core/parlay";
import type { ProviderShares } from "@agari/core/reserves";
import type { Reading } from "@agari/core/schemas";
import type { Address } from "@agari/core/types";
import { cantonNotLive } from "../stub/not-deployed";
import { absent } from "../stub/product";

/** The reason every parlay quote and write states until the package lands (C8). */
export const PARLAY_NOT_LIVE = cantonNotLive("parlay");

export const getParlayReserveState = (): Promise<Reading<ParlayReserveState | null>> => absent(null);
export const getParlay = (_parlayId: bigint): Promise<Reading<ParlayTicket | null>> => absent(null);
export const listParlaysOf = (_wallet: Address): Promise<Reading<ParlayTicket[]>> => absent([]);
export const getParlaySharesOf = (_wallet: Address): Promise<Reading<ProviderShares>> => absent({ shares: 0n, worthBase: 0n, suppliedBase: 0n, withdrawnBase: 0n });
