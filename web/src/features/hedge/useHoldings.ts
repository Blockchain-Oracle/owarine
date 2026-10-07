"use client";

import { SHARE_ISSUERS, SHARE_TOKENS, type ShareSymbol, type ShareToken, type TickerSymbol } from "@owarine/core/market";
import { diagnosis, err, ok, type Reading } from "@owarine/core";
import type { Address } from "@owarine/core/types";
import { ledgerBase } from "@owarine/markets";
import { useReadingQuery } from "@owarine/markets/react";
import { z } from "zod";
import { seatReadHeaders } from "@/lib/seat-fetch";

/** The route caches 60 s per owner; polling faster would only read its cache. */
const POLL_MS = 60_000;
const holdingsKey = (owner: Address | null) => ["owarine", "hedge", "holdings", owner] as const;

/** One verified holding with its integers back as bigints. */
export interface HoldingView {
  mint: string;
  symbol: ShareSymbol;
  issuer: ShareToken["issuer"];
  underlying: TickerSymbol;
  sharesE8: bigint;
  /** Null when no price is known, or when the only known price is stale (`priceAgeSec` says how stale). */
  exposureUsdE6: bigint | null;
  /** Seconds since the price behind `exposureUsdE6` was published; null when no price is known. */
  priceAgeSec: number | null;
}

const digits = z.string().regex(/^\d+$/).transform((text) => BigInt(text));
const SYMBOLS = SHARE_TOKENS.map((token) => token.symbol) as [ShareSymbol, ...ShareSymbol[]];
const UNDERLYINGS = [...new Set(SHARE_TOKENS.map((token) => token.underlying))] as [TickerSymbol, ...TickerSymbol[]];

/** `GET /api/holdings` (`app/api/holdings/route.ts`, the seat's own): bigints travel as decimal strings. */
const rowSchema = z.object({
  mint: z.string(),
  symbol: z.enum(SYMBOLS),
  issuer: z.enum(SHARE_ISSUERS),
  underlying: z.enum(UNDERLYINGS),
  sharesE8: digits,
  exposureUsdE6: digits.nullable(),
  priceAgeSec: z.number().int().nonnegative().nullable().default(null),
});
// Rows parse one by one: a token this build does not know yet is dropped alone, instead of hiding every holding.
const bodySchema = z.object({ holdings: z.array(z.unknown()) });

/**
 * Canton (plan 00-plan "Holdings-dependent UX before C7b"; C4c.2, C7b): a seat is a leased Canton party. It holds demo
 * credits, and a token-standard (CIP-56) asset only where it was given one, so until a deployment names a tokenised-share
 * instrument (`CIP56_SHARE_INSTRUMENTS`) the read has nothing to show and the cards keep the reference's own "no holdings"
 * state. The route now exists and reads the seat's `Holding`s as the leased party (`/api/holdings`, C7b); the flag stays
 * off, in the build, until the rail is proven on DevNet with a real holder, so no seat polls a read that cannot yet have an
 * answer. Turn it on with `NEXT_PUBLIC_CIP56_HOLDINGS=1`.
 */
const SEAT_HOLDINGS_RAIL = process.env.NEXT_PUBLIC_CIP56_HOLDINGS === "1";

async function readHoldings(_owner: Address): Promise<Reading<HoldingView[]>> {
  if (!SEAT_HOLDINGS_RAIL) return ok([], Date.now());
  // The party is the seat's lease, proved by the cookie (web) or the signed read header (phone); nothing here names it.
  const response = await fetch(`${ledgerBase(true)}/holdings`, { cache: "no-store", credentials: "include", headers: { accept: "application/json", ...(await seatReadHeaders()) } });
  if (!response.ok) return err(diagnosis("unknown", `holdings route answered ${response.status}`));
  const parsed = bodySchema.safeParse(await response.json());
  if (!parsed.success) return err(diagnosis("unknown", "holdings payload did not parse"));
  const rows = parsed.data.holdings.map((row) => rowSchema.safeParse(row)).flatMap((r) => (r.success ? [r.data] : []));
  return ok(rows, Date.now());
}

/** The seat's share tokens (none until C7b), read-only; never persisted (the read cache's allowlist refuses account data). */
export function useHoldings(owner: Address | null): Reading<HoldingView[]> | null {
  return useReadingQuery(holdingsKey(owner), () => readHoldings(owner as Address), { pollMs: POLL_MS, enabled: owner !== null, needs: [] });
}
