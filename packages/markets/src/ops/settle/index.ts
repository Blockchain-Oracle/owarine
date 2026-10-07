/**
 * `@owarine/markets/ops/settle`: the settler's reads and commands. On Canton settlement is one venue-only `SettleBatch`
 * over leg contracts after `Terms_Resolve`/`Terms_Void` (C3); in C1 the pure seat predicates are live and every ledger
 * read or command refuses as not live. Server-only.
 */
import type { Address } from "@owarine/core/types";
import type { OpsClient } from "../client";
import { opsNotLive, type Instruction } from "../shapes";
import type { MarketView } from "../venue";

export type LedgerSeat = {
  index: number;
  owner: Address;
  credit: bigint;
  lockedCash: bigint;
  yesFree: bigint;
  yesLocked: bigint;
  noFree: bigint;
  noLocked: bigint;
  openOrders: number;
  flags: number;
};

export type LedgerState = { address: Address; rentPayer: Address; capacity: number; seatsUsed: number; seats: LedgerSeat[] };

/** `Seat.flags` bits. */
export const SEAT_FLAG = { program: 1, bonded: 2 } as const;

/** Drained: all six balances zero and no open orders. Pure. */
export function isDrained(s: LedgerSeat): boolean {
  return s.credit === 0n && s.lockedCash === 0n && s.yesFree === 0n && s.yesLocked === 0n && s.noFree === 0n && s.noLocked === 0n && s.openOrders === 0;
}

export const isProgramSeat = (s: LedgerSeat) => (s.flags & SEAT_FLAG.program) !== 0;

export type VenueConfig = { address: Address; treasury: Address; collateralMint: Address; retentionSec: number };

/** One owner's unsettled slot on a Window: what the crank redeems and which grants' counters it releases. */
export interface VaultCrank {
  owner: Address;
  yesLots: bigint;
  noLots: bigint;
  yesGrant: bigint;
  noGrant: bigint;
}

const notLive = () => opsNotLive("ops/settle");

export async function readLedger(_client: OpsClient, _ledger: Address): Promise<LedgerState | null> {
  throw notLive();
}
export async function readVenueConfig(_client: OpsClient): Promise<VenueConfig> {
  throw notLive();
}
export async function readBookOrderCount(_client: OpsClient, _book: Address): Promise<number | null> {
  throw notLive();
}
export async function readResultRentPayer(_client: OpsClient, _market: Address): Promise<{ result: Address; rentPayer: Address } | null> {
  throw notLive();
}
export async function settleInstruction(_client: OpsClient, _m: MarketView): Promise<Instruction> {
  throw notLive();
}
export async function voidInstruction(_client: OpsClient, _m: MarketView): Promise<Instruction> {
  throw notLive();
}
export async function sweepInstruction(_m: MarketView, _max = 32): Promise<Instruction> {
  throw notLive();
}
export async function releaseBookInstruction(_m: MarketView): Promise<Instruction> {
  throw notLive();
}
export async function redeemForInstructions(_client: OpsClient, _m: MarketView, _config: VenueConfig, _seat: { index: number; owner: Address }): Promise<Instruction[]> {
  throw notLive();
}
export async function closeLedgerInstruction(_m: MarketView, _config: VenueConfig, _ledgerRentPayer: Address): Promise<Instruction> {
  throw notLive();
}
export async function closeMarketInstruction(_m: MarketView, _config: VenueConfig, _result: { result: Address; rentPayer: Address }): Promise<Instruction> {
  throw notLive();
}
export async function planVaultCranks(_client: OpsClient, _market: Address, _owners?: readonly Address[]): Promise<VaultCrank[]> {
  throw notLive();
}
export async function vaultCrankInstruction(_client: OpsClient, _m: MarketView, _collateralMint: Address, _crank: VaultCrank): Promise<Instruction> {
  throw notLive();
}
