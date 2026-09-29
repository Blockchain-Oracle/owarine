/**
 * `@agari/markets/ops/roller`: window-roller calls. On Canton a window opens through a consuming `Series_OpenWindow`
 * that checks `nextIndex` (C3), with no books to recycle; in C1 every ledger call refuses as not live and the pure
 * venue constants stay. Server-only.
 */
import type { Address } from "@agari/core/types";
import type { KeyPairSigner } from "../../deploy/client";
import type { OpsClient } from "../client";
import { opsNotLive } from "../shapes";

export { bookSpace, BASIS, BOOK_CAPACITY, BOOKS_PER_SERIES, COLLATERAL_DECIMALS, LAUNCH_GRID } from "../../deploy/venue-spec";

export type BookHeader = { address: Address; market: Address; series: Address; capacity: number; orderCount: number };
export type LedgerHeader = { address: Address; market: Address; rentPayer: Address; capacity: number; seatsUsed: number };
export type VenueConfig = { address: Address; collateralMint: Address; rollers: Address[]; mode: number; resultRetentionSec: number; clusterTag: number };

/** A free book is bound to no market. There are no books on Canton; kept for the roller's planning code. */
export const isFreeBook = (book: BookHeader) => book.market === ("11111111111111111111111111111111" as Address);

export const BOUNDARY_KIND = { Intraday: 0, SessionOpen: 1, SessionClose: 2 } as const;

export type OpenWindowInput = {
  series: Address;
  index: bigint;
  book: Address;
  collateralMint: Address;
  tradingStartSec: number;
  lockAtSec: number;
  expirySec: number;
  policyVersion: number;
  openKind: number;
  closeKind: number;
};
export type OpenedWindowRef = { market: Address; ledger: Address; mvault: Address; signature: string };
export type BoundWindowRef = { series: Address; market: Address; book: Address; ledger: Address };

const notLive = () => opsNotLive("ops/roller");

export async function fetchBookHeaders(_client: OpsClient, _books: readonly Address[]): Promise<Array<BookHeader | null>> {
  throw notLive();
}
export async function fetchLedgerHeaders(_client: OpsClient, _ledgers: readonly Address[]): Promise<Array<LedgerHeader | null>> {
  throw notLive();
}
export async function readVenueConfig(_client: OpsClient): Promise<VenueConfig> {
  throw notLive();
}
export async function openWindow(_client: OpsClient, _input: OpenWindowInput): Promise<OpenedWindowRef> {
  throw notLive();
}
export async function sweepBook(_client: OpsClient, _w: BoundWindowRef, _max = 32): Promise<string> {
  throw notLive();
}
export async function releaseBook(_client: OpsClient, _w: Omit<BoundWindowRef, "ledger">): Promise<string> {
  throw notLive();
}
export async function growLedger(_client: OpsClient, _input: { market: Address; ledger: Address; extraSeats: number }): Promise<string> {
  throw notLive();
}
/** The user pays no network fee on Canton; a role's fee balance has no meaning (C1: not live). */
export async function lamportsOf(_client: OpsClient, _owner: Address): Promise<bigint> {
  throw notLive();
}
export async function transferSol(_client: OpsClient, _destination: Address, _lamports: bigint): Promise<string> {
  throw notLive();
}
export async function collateralBalanceOf(_client: OpsClient, _owner: Address, _mint: Address): Promise<{ ata: Address; amount: bigint }> {
  throw notLive();
}
export async function mintCollateral(_client: OpsClient, _input: { faucet: KeyPairSigner; mint: Address; owner: Address; amount: bigint }): Promise<string> {
  throw notLive();
}
