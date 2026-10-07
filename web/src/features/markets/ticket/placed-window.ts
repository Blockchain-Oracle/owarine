import type { BookedOrder } from "@owarine/core/ports";
import { isOk } from "@owarine/core/schemas";
import type { EventMarket, MarketId } from "@owarine/core/types";
import { useMarket } from "@owarine/markets/react";
import { useState } from "react";

/**
 * The Window a booked call landed in, from the order itself. The ticket advances to the next Window at the no-entry
 * cutoff, and on a 1-minute Window that cutoff (lock − 30 s = T+20) can pass while a firm quote is held: on the iOS
 * simulator (C11b) the fill landed in BTC-1m:34 at T+21, the ticket was already on :35, and The Call counted down to
 * :35's bell and would have read :35's verdict. The Window in hand stands in only when it is the order's own; another
 * Window is read by the order's id (the ticket read it a moment ago, so it is in the query cache).
 */
export function placedWindowOf(orderMarket: MarketId, inHand: EventMarket, read: EventMarket | null): EventMarket | null {
  if (inHand.marketId === orderMarket) return inHand;
  return read?.marketId === orderMarket ? read : null;
}

/** The Call's Window: the one in hand when the call landed, if it is the order's, else the order's own read. */
export function usePlacedWindow(booked: BookedOrder, market: EventMarket): EventMarket | null {
  const [inHand] = useState(() => market);
  const read = useMarket(inHand.marketId === booked.marketId ? null : booked.marketId);
  return placedWindowOf(booked.marketId, inHand, read && isOk(read) ? read.value : null);
}
