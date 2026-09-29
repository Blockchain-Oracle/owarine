/**
 * The venue's public read routes (`/api/venue/*`, C4): the facts the order lane and the read port are built on, served
 * by our own route handlers from the projection (and the ledger only where the projection lacks a field). Same-origin
 * in the browser, `EXPO_PUBLIC_SITE_URL` on the phone, through `ledgerBase(true)` like `/api/seat`. Public: no seat
 * header is sent, so an answer can be shared by every visitor.
 */
import { z } from "zod";
import { ledgerRequest, type LedgerCallResult } from "./ledger-api";

const u64 = z.union([z.string(), z.number()]).transform((v, ctx) => {
  try {
    return BigInt(v);
  } catch {
    ctx.addIssue({ code: "custom", message: `not an integer: ${v}` });
    return z.NEVER;
  }
});

export const venueWire = z.object({
  config: z.string(),
  collateralMint: z.string(),
  decimals: z.number().int(),
  treasury: z.string(),
  mode: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  programSeats: z.array(z.string()),
});

export const seriesWire = z.object({
  address: z.string(),
  seriesKey: z.string(),
  symbol: z.string().nullable(),
  basis: z.number().int(),
  cadenceSec: z.number().int(),
  lotBase: u64,
  tickBase: u64,
  cashUnit: u64,
  minLots: u64,
  seatBond: u64,
  fillsCap: z.number().int(),
  evictionsCap: z.number().int(),
  minRestSlots: u64,
  /** Indexed by policy version; `{0,0}` fills a version the Series never had. */
  policySources: z.array(z.object({ primary: z.number().int(), check: z.number().int() })),
});

export const venueFactsWire = z.object({ venue: venueWire, series: z.array(seriesWire) });
export type VenueFactsWire = z.output<typeof venueFactsWire>;

export const marketDataWire = z.object({
  series: z.string(),
  book: z.string(),
  ledger: z.string(),
  index: u64,
  state: z.number().int(),
  tradingStartSec: u64,
  lockAtSec: u64,
  expirySec: u64,
  backingLots: u64,
  payoutYes: z.number().int(),
  payoutNo: z.number().int(),
});

/** `market` null: no Window with this id in the projection. */
export const marketFactsWire = z.object({ market: z.object({ address: z.string(), data: marketDataWire }).nullable() });

export const venueClockWire = z.object({
  /** The server's wall clock when it answered. */
  serverMs: z.number(),
  /** The ledger end the server read with it (the recovery cursor's start), or null when it could not be read. */
  offset: z.number().nullable(),
  /** The newest ledger record time the projection holds, when it holds one. */
  recordTimeMs: z.number().nullable(),
});
export type VenueClockWire = z.output<typeof venueClockWire>;

export function venueRequest<W extends z.ZodType>(path: string, wire: W): Promise<LedgerCallResult<z.output<W>>> {
  return ledgerRequest(`/venue/${path}`, { method: "GET", wire, root: true, seat: false });
}
