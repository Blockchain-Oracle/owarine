/**
 * `@agari/markets/deploy`: server-only operator tooling. Scripts read keypair files and JSON, then call these. Not
 * re-exported from the package root. C1 stub: the pure venue specs and price policies are live (the Daml `Series`
 * contracts take the same values, C2x); every ledger step refuses as not live.
 */
import type { Address } from "@agari/core/types";
import type { DeployClient, KeyPairSigner } from "./client";
import type { PriceSources } from "./policies";
import { deployNotLive, type StepLog, type VenueRecord } from "./send";
import type { AuthorityKeys } from "./venue-spec";

export { createDeployClient, keypairSigner, type DeployClient, type DeployClientConfig, type KeyPairSigner } from "./client";
export { assertNoDrift, describeSendError, diffField, DriftError, send, type SendContext, type SeriesRecord, type StepContext, type StepLog, type VenueRecord } from "./send";
export { ADMIT_UNTIL_LOCK, policyVersions, pythIndexPolicyVersions, type PriceSources, type PythIndexSources } from "./policies";
export type { AuthoritiesArgs, PrintPolicyInput, SeriesRegisterArgs } from "./specs";
export * from "./series-gap";
export * from "./series-token";
export { BOOK_CAPACITY, BOOKS_PER_SERIES, DRIVE_ATTESTED_FEED, driveTestSeries, LAUNCH_GRID, s2Series, type AuthorityKeys, type SeriesSpec } from "./venue-spec";
export { chainNowSec, readSeats, windowAddresses, type Seat } from "./cycle/accounts";
export { DRIVE_TEST_TICKER } from "./venue-spec";
export { BASIS, PRESTOCKS_TICKER_BASE, preStocksBasketFeedId, preStocksBasketSeries, preStocksFeedId, preStocksSeries } from "./venue-spec";
export { pythValuationSeries } from "./venue-spec";
export { ANY_SEAT, fundUser, KIND, newSigner, openWindow, ORDER_TYPE, placeOrder, placeOrderInstruction, seatHintFor, type OpenedWindow, type OrderInput } from "./cycle/window";
export { profileOnSurfpool, recordAttestedPrint, recordPythPrint, recordRedstonePrint, recycleBooks, redeem, settleWindow, sweepExpired, voidExpired, WHICH, type AttestedInput, type TransactionProfile } from "./cycle/resolve";
export { DRIVE_OWNED_FEED, DRIVE_OWNED_TICKERS, driveOwnedSeries, type OwnedLane, type OwnedQuote, type OwnedWindowKeys } from "./drive-window";
export * from "./products";
export { packagesAt, parseGatewayJson, redstoneHistoricalUrl, redstoneMedianE8, redstonePayload, decimalToE8, type RedStonePackage } from "../prices/redstone";

export type InitEventsInput = {
  client: DeployClient;
  clusterTag: number;
  programData: Address;
  mint: KeyPairSigner;
  mintAuthority: Address;
  authorities: AuthorityKeys;
  sources: PriceSources;
  record: VenueRecord;
  save: (record: VenueRecord) => void;
  log: (entry: StepLog) => void;
};

/** The venue's bootstrap. On Canton: DAR upload, parties and the `Series` contracts (C2x); not live in C1. */
export async function initEvents(_input: InitEventsInput): Promise<VenueRecord> {
  throw deployNotLive();
}
