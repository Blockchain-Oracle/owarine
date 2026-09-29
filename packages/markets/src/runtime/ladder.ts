/**
 * The venue's published price ladder (plan §6), as the read runtime consumes it: ops' `/ladders/latest` and
 * `/ladders/stream` (`services/ops/src/actors/market-maker/seat/ladder-board.ts` `WireLadder`), mapped onto the
 * walkable `BookState` core's book math already walks. It is indicative — the venue's own prices, not a public order
 * book — and the firm price comes only from the click-time quote (`/api/ledger/quotes`).
 *
 * Mapping, in YES ticks (`1..999`, the Book's own terms):
 *   - `up[i] = [ticks, lots]` is what buying Up costs: a YES ask at `ticks`.
 *   - `down[i] = [ticks, lots]` is what buying Down costs in Down terms: a YES bid at `1000 − ticks`.
 * Each level is one live node that expires at `quotingUntilSec`; a ladder that is not `quoting` has no live node, so
 * every walk over it finds nothing and the ticket says so instead of pricing a closed Window.
 */
import type { WalkNode } from "@agari/core/market";
import type { Address } from "@agari/core/types";
import { z } from "zod";
import type { BookState } from "./accounts";

const PAIR_TICKS = 1000;
const LEVELS = 1000;
const BITMAP_WORDS = 16;

const level = z.tuple([z.number().int().min(1).max(999), z.union([z.string(), z.number()]).transform((v) => BigInt(v))]);

export const wireLadder = z.object({
  marketId: z.string(),
  damlMarketId: z.string(),
  seriesId: z.string(),
  termsCid: z.string(),
  seriesKey: z.string(),
  symbol: z.string().nullable().optional(),
  index: z.number(),
  tradingStartSec: z.number(),
  lockAtSec: z.number(),
  expirySec: z.number(),
  quotingUntilSec: z.number(),
  cashUnit: z.union([z.string(), z.number()]).transform((v) => BigInt(v)),
  feeRateBps: z.number(),
  fairTicks: z.number().nullable().optional(),
  up: z.array(level),
  down: z.array(level),
  asOfMs: z.number(),
  state: z.string(),
});
export type Ladder = z.output<typeof wireLadder>;

export const ladderLatestWire = z.object({ ladders: z.array(z.unknown()), asOfMs: z.number() });

/** One ladder event or row, or null when it does not parse (a malformed event is dropped, never guessed at). */
export function parseLadder(raw: unknown): Ladder | null {
  const parsed = wireLadder.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** The ladder as core's walkable Book: YES asks from `up`, YES bids from `down` at `1000 − ticks`. */
export function ladderBookState(ladder: Ladder, generation = 0): BookState {
  const live = ladder.state === "quoting";
  const expireTs = BigInt(ladder.quotingUntilSec);
  const nodes: WalkNode[] = [];
  const side = (levels: readonly (readonly [number, bigint])[]) => {
    const bits: bigint[] = new Array<bigint>(BITMAP_WORDS).fill(0n);
    const heads: number[] = new Array<number>(LEVELS).fill(0);
    for (const [price, lots] of levels) {
      if (lots <= 0n || heads[price] !== 0) continue;
      nodes.push({ lots, expireTs, placedSlot: 0n, live, next: 0 });
      heads[price] = nodes.length;
      bits[Math.floor(price / 64)] = bits[Math.floor(price / 64)]! | (1n << BigInt(price % 64));
    }
    return { bits, heads, nodes };
  };
  const asks = side(ladder.up);
  const bids = side(ladder.down.map(([ticks, lots]) => [PAIR_TICKS - ticks, lots] as const));
  return {
    address: ladder.termsCid as Address,
    market: ladder.marketId as Address,
    series: ladder.seriesId as Address,
    bids,
    asks,
    slot: BigInt(Math.floor(ladder.asOfMs / 1000)),
    generation,
    orderCount: nodes.length,
  };
}

/** ops' ladder base: `NEXT_PUBLIC_LADDER_URL`, else the spot feed's host (the same ops HTTP server serves both). */
export function ladderBase(client: { ladderUrl: string | null; priceFeedUrl: string | null } | null): string | null {
  const base = client?.ladderUrl ?? client?.priceFeedUrl ?? null;
  return base ? base.replace(/\/$/, "") : null;
}
