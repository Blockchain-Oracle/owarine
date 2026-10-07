/**
 * Test-only: builds a walkable `BookState` from order lists, with the layout rule of the shared book vectors: each
 * side's nodes are allocated in reverse list order and are FIFO within a price in list order; bids take node refs
 * first, then asks, in one node array. It replaces the reference's byte fixture, which encoded a Solana account.
 */
import type { WalkNode } from "@owarine/core/market";
import type { Address } from "@owarine/core/types";
import type { BookState } from "./accounts";

export interface FixtureOrder {
  price: number;
  lots: bigint;
  expireTs: bigint;
  placedSlot: bigint;
  live: boolean;
}

const LEVELS = 1000;
const BITMAP_WORDS = 16;

export function ladderState(bids: readonly FixtureOrder[], asks: readonly FixtureOrder[], market: Address, slot: bigint): BookState {
  const nodes: WalkNode[] = [];
  let base = 0;
  const side = (orders: readonly FixtureOrder[]) => {
    const bits: bigint[] = new Array<bigint>(BITMAP_WORDS).fill(0n);
    const heads: number[] = new Array<number>(LEVELS).fill(0);
    const tails = new Map<number, number>();
    orders.forEach((order, k) => {
      const ref = base + (orders.length - 1 - k) + 1;
      nodes[ref - 1] = { lots: order.lots, expireTs: order.expireTs, placedSlot: order.placedSlot, live: order.live, next: 0 };
      const tail = tails.get(order.price);
      if (tail === undefined) heads[order.price] = ref;
      else nodes[tail - 1] = { ...nodes[tail - 1]!, next: ref };
      tails.set(order.price, ref);
      const word = Math.floor(order.price / 64);
      bits[word] = bits[word]! | (1n << BigInt(order.price % 64));
    });
    base += orders.length;
    return { bits, heads, nodes };
  };
  const bidSide = side(bids);
  const askSide = side(asks);
  return { address: market, market, series: market, bids: bidSide, asks: askSide, slot, generation: 0, orderCount: bids.length + asks.length };
}
