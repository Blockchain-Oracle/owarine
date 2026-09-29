import type { Direction, FrameQuote, FrameState } from "@/features/canton-ux/ticket";
import { updateId } from "../canton-ids";

/** `/dev/ticket-canton`: a 5.00 tUSDC UP call on a TSLA 5m Window at 62¢, and the states the write passes through. */
export const QUOTE: FrameQuote = {
  stakeText: "5.00",
  stakeBase: 5_000_000n,
  balanceBase: 1_000_000_000n,
  decimals: 6,
  symbol: "tUSDC",
  cells: { cost: "4.96", ret: "8.06", loss: "5.00" },
  chancePct: 62,
};
export const PRICE_CENTS = 62;
export const MAX_COST_BASE = 5_000_000n;
export const UPDATE_ID = updateId("c0ffee1e5eed");

export const DIRECTIONS: ReadonlyArray<{ id: Direction; title: string; why: string }> = [
  {
    id: "A",
    title: "A — Minimal",
    why: "The ticket barely changes: the ring rides on the button you just pressed and the four steps appear in a line under it, so the eye never leaves the CTA.",
  },
  {
    id: "B",
    title: "B — Progress takes the button's place",
    why: "The held price gets its own row with the ring beside it, and while the write is open the steps replace the button, so there is nothing to press twice.",
  },
  {
    id: "C",
    title: "C — Receipt drawer",
    why: "A small cream receipt rises over the ticket with the price, the ring, the stake and the steps, so the call reads as a document you can check before and after.",
  },
];

export const FRAMES: ReadonlyArray<{ label: string; state: FrameState }> = [
  { label: "Confirming — the price has 4 s left", state: { phase: "confirming", quoteLeftSec: 4 } },
  { label: "Placed — the ledger update id", state: { phase: "confirmed", quoteLeftSec: 17, updateId: UPDATE_ID } },
  { label: "No answer yet — unknown, never retried blind", state: { phase: "unknown", quoteLeftSec: 0 } },
  { label: "The price ran out — the fresh one offered in place", state: { phase: null, quoteLeftSec: 0, expired: { fromCents: 62, toCents: 63 } } },
];
