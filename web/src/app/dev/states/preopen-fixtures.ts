/**
 * Canned pre-open calls (D-088) for the `/dev/states` fixtures: a rested order as the lane returns it, and `idx_orders`
 * rows as the index sends them, projected by core `restingOrderView` so the rows render exactly what a live read would.
 * Integers throughout: lots of 1,000 base contracts, a cash unit of 1, prices in YES ticks.
 */
import type { RestedOrder } from "@owarine/core/ports";
import { restingOrderView, type RestingOrderRow, type RestingOrderView, type RestingOrderWindow } from "@owarine/core/projection";
import { CLOCK } from "../session/market-session-fixtures";
import { DECIMALS, TX_HASH, WALLET } from "./fixtures";
import { REGULAR_UPCOMING } from "./lane-fixtures";

const LOT_BASE = 1_000n;
const CASH_UNIT = 1n;

/** Ten UP contracts at 55¢, resting for Tuesday's open until 90 s after the bell. */
export const RESTED_UP: RestedOrder = {
  marketId: REGULAR_UPCOMING.marketId,
  side: "up",
  txHash: TX_HASH,
  callRef: "rc-fixture-1",
  lots: 10_000n,
  priceTicks: 550,
  contractsRaw: 10_000n * LOT_BASE,
  escrowBase: 10_000n * 550n * CASH_UNIT,
  expireSec: REGULAR_UPCOMING.tradingStartSec + 90,
};

const WINDOW: RestingOrderWindow = {
  marketId: REGULAR_UPCOMING.marketId,
  asset: REGULAR_UPCOMING.asset,
  intervalSec: REGULAR_UPCOMING.intervalSec,
  tradingStartSec: REGULAR_UPCOMING.tradingStartSec,
  lockAtSec: REGULAR_UPCOMING.lockAtSec,
  expirySec: REGULAR_UPCOMING.expirySec,
  decimals: DECIMALS,
  grid: { lotBase: LOT_BASE, cashUnit: CASH_UNIT },
};

function row(over: Partial<RestingOrderRow>): RestingOrderRow {
  return {
    signature: TX_HASH,
    market: REGULAR_UPCOMING.marketId,
    owner: WALLET,
    seat: 4,
    kind: 0,
    order_type: 3,
    limit_price: 550,
    lots: "10000",
    filled_lots: "0",
    rested_lots: "10000",
    remaining_lots: "10000",
    expire_ts_sec: String(REGULAR_UPCOMING.tradingStartSec + 90),
    ts_sec: String(CLOCK.preTue - 3_600),
    status: "open",
    call_ref: "rc-fixture-1",
    refunded_base: "0",
    ...over,
  };
}

/**
 * The faces of a scheduled call in Portfolio: before the open, resting through the Window, and the four ways it ends
 * (swept unfilled, filled, filled in part then swept, cancelled). An ended call keeps its row and says how it ended.
 */
export const RESTING_ROWS: ReadonlyArray<{ label: string; view: RestingOrderView }> = [
  { label: "resting for the open — UP at 55¢, fills within the first minute after the bell", view: restingOrderView(row({}), WINDOW, CLOCK.preTue * 1000) },
  {
    label: "resting until the lock — DOWN at 40¢ (BUY_NO at YES 600), the opt-in horizon",
    view: restingOrderView(row({ signature: `${TX_HASH.slice(0, -1)}2`, kind: 2, limit_price: 600, expire_ts_sec: String(REGULAR_UPCOMING.lockAtSec), call_ref: "rc-fixture-2" }), WINDOW, (REGULAR_UPCOMING.tradingStartSec + 30) * 1000),
  },
  {
    label: "didn't fill — swept at its expiry, the stake is back as venue credit",
    view: restingOrderView(row({ signature: `${TX_HASH.slice(0, -1)}3`, call_ref: "rc-fixture-3", status: "expired", remaining_lots: "0", refunded_base: "5500000" }), WINDOW, (REGULAR_UPCOMING.tradingStartSec + 120) * 1000),
  },
  {
    label: "filled — the venue took it at the bell, at the call's own price (now a position)",
    view: restingOrderView(row({ signature: `${TX_HASH.slice(0, -1)}4`, call_ref: "rc-fixture-4", status: "filled", filled_lots: "10000", remaining_lots: "0" }), WINDOW, (REGULAR_UPCOMING.tradingStartSec + 20) * 1000),
  },
  {
    label: "partly filled — 4 of 10 contracts filled, the rest swept and returned",
    view: restingOrderView(row({ signature: `${TX_HASH.slice(0, -1)}5`, call_ref: "rc-fixture-5", status: "expired", filled_lots: "4000", remaining_lots: "0", refunded_base: "3300000" }), WINDOW, (REGULAR_UPCOMING.tradingStartSec + 120) * 1000),
  },
  {
    label: "cancelled — before the bell, the whole stake back",
    view: restingOrderView(row({ signature: `${TX_HASH.slice(0, -1)}6`, call_ref: "rc-fixture-6", status: "cancelled", remaining_lots: "0", refunded_base: "5500000" }), WINDOW, (REGULAR_UPCOMING.tradingStartSec - 300) * 1000),
  },
];
