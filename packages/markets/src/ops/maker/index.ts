/**
 * `@agari/markets/ops/maker`: the seat-mode seed maker's reads and commands. On Canton the seed maker becomes the pricer
 * and quote issuer over the venue's cash shards (C3/C4); in C1 the order constants stay and every ledger call refuses
 * as not live. Server-only.
 */
import type { Address } from "@agari/core/types";
import type { OpsClient } from "../client";
import { opsNotLive, type Instruction } from "../shapes";
import type { VenueConfig } from "../settle";
import type { MarketView } from "../venue";

export { readLedger, readVenueConfig, type LedgerSeat, type VenueConfig } from "../settle";

export const MAKER_KIND = { buyYes: 0, buyNo: 2 } as const;
/** A PostOnly quote only rests; a Normal (limit) quote also takes what already rests on its side. */
export const POST_ONLY = 3;
export const NORMAL = 0;
export const SELF_MATCH_CANCEL_MAKER = 1;
export const QUOTE_MAX_FILLS = 16;
/** `seat_hint` for an authority without a seat on this Window. */
export const ANY_SEAT = 0xffff;

export type BookTop = { bestBidTicks: number | null; bestAskTicks: number | null; orderCount: number };
export type QuoteInput = { kind: number; priceTicks: number; lots: bigint; expireSec: number; seatHint: number; clientId: bigint; orderType?: number };
export type PlaceOutcome = { filledLots: bigint; restedLots: bigint; cancelledLots: bigint; stopReason: number };

const notLive = () => opsNotLive("ops/maker");

export async function readBookTop(_client: OpsClient, _book: Address): Promise<BookTop | null> {
  throw notLive();
}
export async function makerTokenAccount(_owner: Address, _mint: Address): Promise<Address> {
  throw notLive();
}
export async function tokenBalance(_client: OpsClient, _account: Address): Promise<bigint | null> {
  throw notLive();
}
export async function quoteInstruction(_client: OpsClient, _m: MarketView, _config: VenueConfig, _order: QuoteInput): Promise<Instruction> {
  throw notLive();
}
export async function readPlaceOutcome(_client: OpsClient, _signature: string): Promise<PlaceOutcome | null> {
  throw notLive();
}
export async function cancelAllInstruction(_client: OpsClient, _m: MarketView, _config: VenueConfig, _seatIdx: number, _withdraw: boolean): Promise<Instruction> {
  throw notLive();
}
export async function mergeSetInstruction(_client: OpsClient, _m: MarketView, _config: VenueConfig, _seatIdx: number, _lots: bigint): Promise<Instruction> {
  throw notLive();
}
export async function withdrawCreditInstruction(_client: OpsClient, _m: MarketView, _config: VenueConfig, _seatIdx: number, _amount: bigint): Promise<Instruction> {
  throw notLive();
}
