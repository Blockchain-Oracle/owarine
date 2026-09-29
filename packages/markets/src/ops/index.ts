/**
 * `@agari/markets/ops`: what every venue actor shares. Server-only; not re-exported from the package root. Each lane's
 * surface is its own subpath (`@agari/markets/ops/<lane>`). C1 stub: pure helpers are live, every ledger call refuses
 * as not live until the C3 adapter gives each role party its ledger session.
 */
export { createOpsClient, type OpsClient, type OpsClientConfig } from "./client";
export { ENGINE_ERROR, engineErrorCode, OpsSendError, sendOps } from "./send";
export { fetchMarkets, fetchSeries, isTerminal, listMarketsOfSeries, listSeries, MARKET_FLAG, MARKET_STATE, marketStatus, seriesBasis, seriesLaneKey, type MarketStatus, type MarketView, type SeriesView } from "./venue";
export type { Instruction, Market, PolicyVersion, Print, PrintPolicy, Series } from "./shapes";
export { chainNowSec, coveringVersion, eventAuthority, readSeats, windowAddresses, type Seat, type WindowAddresses } from "../deploy/cycle/accounts";
export { keypairSigner } from "../deploy/client";
