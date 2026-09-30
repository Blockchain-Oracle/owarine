import { TICKER_SYMBOLS } from "@agari/core/market";
import { addressSchema, type Address } from "@agari/core/types";
import type { Db, IdxRow, IndexReader } from "@agari/db";
import { z } from "zod";
import { resolveArchiveQuery } from "./queries-archive";
import { resolveProofQuery } from "./queries-proof";
import { resolvePublishedQuery } from "./queries-published";
import { resolveStatusQuery } from "./queries-status";
import { resolveTapeQuery } from "./queries-tape";

/**
 * The `/api/index/*` path table (first-call.md §5): each entry validates its path segments and query, then runs one
 * `idx/read.ts` query. Integers stay the decimal strings Postgres returns; limits are clamped by the reader (≤ 1,000).
 */
export interface IndexQuery {
  /** `wallet/*` answers are private to the seat and never cached by a CDN. */
  scope: "public" | "wallet";
  /** For `wallet` scope: the seat whose rows these are. The route serves them only to that seat (plan §5). */
  owner?: Address;
  /** Overrides the public 2 s cache for immutable rows (e.g. a verified proof: `public, s-maxage=60`). Wallet scope ignores it. */
  cacheControl?: string;
  /**
   * Wallet scope: the route resolves the seat's current lease (party and start offset) and hands it to `run`. Every
   * wallet resource sets it (C13a): the projection keys a seat's rows by party, and a party is recycled to later visitors.
   */
  seatLease?: boolean;
  /** `db` is for lane readers with their own SQL (`idx/read-{tape,status}.ts`, `proofs.ts`; proof-analytics.md §1). */
  run(reader: IndexReader, db: Db, lease?: SeatLeaseScope | null): Promise<IdxRow[]>;
}

/** The party a seat address leases now and the offset its lease started at (plan §4: reads filter by it). */
export interface SeatLeaseScope {
  party: string;
  fromOffset: number;
}

export class BadRequest extends Error {}

/** The projector's cursor row (services/ops `PROJECTOR_STREAM`, default `venue`). */
const PROJECTION_STREAM = process.env.PROJECTOR_STREAM ?? "venue";

const int = z.coerce.number().int().nonnegative();
const optionalInt = int.optional();
const flag = z.enum(["0", "1"]).optional().transform((v) => v === "1");
const address = addressSchema;
const symbol = z.enum(TICKER_SYMBOLS);
const ids = z
  .string()
  .transform((raw) => raw.split(",").filter(Boolean))
  .pipe(z.array(address).max(200))
  .optional();

function parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new BadRequest(parsed.error.issues.map((i) => `${i.path.join(".") || "value"}: ${i.message}`).join("; "));
  return parsed.data;
}

const marketsQuery = z.object({
  state: z.enum(["open", "resolved", "voided"]).optional(),
  symbol: symbol.optional(),
  series: address.optional(),
  expiryFrom: optionalInt,
  expiryTo: optionalInt,
  limit: optionalInt,
  settled: flag,
  ids,
});
/** A Window's Book is its `MarketTerms` contract id on Canton (hex), no longer a base58 account. */
const contractId = z.string().regex(/^[0-9a-f]{2,400}$/, "expected a ledger contract id");
const fillsQuery = z.object({ market: address.optional(), book: contractId.optional(), since: optionalInt, limit: optionalInt, offset: optionalInt });
const pageQuery = z.object({ limit: optionalInt, offset: optionalInt });
const rangeQuery = z.object({ from: int, to: int, limit: optionalInt });
/** `basis` (0 Regular, 1 Gap, 2 Token) keeps one lane: a ticker's stock and 24/7 xStock Windows print different prices. */
const printsQuery = rangeQuery.extend({ basis: z.coerce.number().int().min(0).max(2).optional() });

function walletQuery(wallet: string, resource: string | undefined, query: Record<string, string>): IndexQuery | null {
  const owner = parse(address, wallet);
  switch (resource) {
    case "fills": {
      const q = parse(fillsQuery, query);
      return { scope: "wallet", owner, seatLease: true, run: (r, _db, lease) => r.walletFills(owner, { market: q.market, book: q.book, sinceSec: q.since, limit: q.limit, offset: q.offset, lease: lease ?? null }) };
    }
    case "positions": {
      const q = parse(z.object({ unredeemed: flag, limit: optionalInt }), query);
      return { scope: "wallet", owner, seatLease: true, run: (r, _db, lease) => r.positions(owner, { unredeemedOnly: q.unredeemed, limit: q.limit, lease: lease ?? null }) };
    }
    case "actions": {
      const q = parse(pageQuery, query);
      return { scope: "wallet", owner, seatLease: true, run: (r, _db, lease) => r.walletActions(owner, { ...q, lease: lease ?? null }) };
    }
    case "receipts": {
      // 0.4.0: the ledger's settlement receipts (pair legs and tickets), the history's ledger source (K-028).
      const q = parse(z.object({ limit: optionalInt }), query);
      return { scope: "wallet", owner, seatLease: true, run: (r, _db, lease) => r.walletReceipts(owner, { lease: lease ?? null, limit: q.limit }) };
    }
    case "orders": {
      const q = parse(z.object({ market: address.optional(), open: flag, limit: optionalInt }), query);
      return { scope: "wallet", owner, seatLease: true, run: (r, _db, lease) => r.orders({ owner, market: q.market, openOnly: q.open, limit: q.limit, lease: lease ?? null }) };
    }
    case "resting": {
      // 0.5.1 (K-235): the seat's resting calls, live and ended, in the `orders` row shape core's `restingOrderView` reads.
      const q = parse(z.object({ market: address.optional(), open: flag, limit: optionalInt }), query);
      return { scope: "wallet", owner, seatLease: true, run: (r, _db, lease) => r.restingCalls({ owner, market: q.market, openOnly: q.open, limit: q.limit, lease: lease ?? null }) };
    }
    default:
      return null;
  }
}

/** Null when the path names nothing; throws `BadRequest` when it does but a parameter is malformed. */
export function resolveIndexQuery(path: readonly string[], query: Record<string, string>, _programId: string): IndexQuery | null {
  // S5 lane paths (`tape/*` 5b, `status/*` sub-paths 5c, `proofs/*` 5d) resolve in their own files first.
  const lane = resolveTapeQuery(path, query) ?? resolveStatusQuery(path, query, _programId) ?? resolveProofQuery(path, query) ?? resolveArchiveQuery(path, query) ?? resolvePublishedQuery(path, query);
  if (lane) return lane;
  const [head, second, third, ...rest] = path;
  if (rest.length > 0) return null;
  switch (head) {
    case "markets": {
      if (third !== undefined) return null;
      if (second !== undefined) {
        const market = parse(address, second);
        return { scope: "public", run: (r) => r.markets({ market, limit: 1 }) };
      }
      const q = parse(marketsQuery, query);
      if (q.ids) {
        const list = q.ids;
        return { scope: "public", run: (r) => r.marketsByIds(list) };
      }
      return {
        scope: "public",
        run: (r) => r.markets({ state: q.state, symbol: q.symbol, series: q.series, settled: q.settled, expiryFromSec: q.expiryFrom, expiryToSec: q.expiryTo, limit: q.limit }),
      };
    }
    case "wallet":
      return second === undefined ? null : walletQuery(second, third, query);
    case "fills": {
      if (second !== undefined) return null;
      const q = parse(fillsQuery, query);
      if (!q.market && !q.book) throw new BadRequest("fills needs market or book");
      return { scope: "public", run: (r) => r.fills({ market: q.market, book: q.book, sinceSec: q.since, limit: q.limit, offset: q.offset }) };
    }
    case "prints": {
      if (second === undefined || third !== undefined) return null;
      const ticker = parse(symbol, second);
      const q = parse(printsQuery, query);
      return { scope: "public", run: (r) => r.printHistory(ticker, q.from, q.to, q.limit, q.basis) };
    }
    case "candles": {
      if (second === undefined || third !== undefined) return null;
      const market = parse(address, second);
      const q = parse(rangeQuery, query);
      return { scope: "public", run: (r) => r.candles(market, q.from, q.to) };
    }
    case "status":
      // The projection's freshness row is keyed by its stream (the venue's view), not by a program or package id.
      return second === undefined ? { scope: "public", run: async (r) => [await r.status(PROJECTION_STREAM)] } : null;
    default:
      return null;
  }
}
