/**
 * Private mode on Canton (C8d, L-39: `VenueCash` with `bucket = private`, `core/private/canton.ts`). The desk is the
 * venue itself, as `/api/private/status` names it; the budget is the seat's private bucket, all of it spendable by the
 * seat alone (there is no desk allowance to grant on Canton); a size is the venue ladder's own stake-first quote.
 */
import { privateBalanceReplyWire, type PrivateBudget, type PrivateDeskState, type PrivateQuote, type PrivateSlot } from "@agari/core/private";
import { err, isOk, ok, type Reading } from "@agari/core/schemas";
import { diagnosis, type Address, type Hash32, type MarketId, type Side } from "@agari/core/types";
import { z } from "zod";
import { freshQuoteStake } from "../provider/books";
import { ledgerRequest } from "../provider/ledger-api";
import { getMarket } from "../provider/markets";
import { withReading } from "../provider/reading";
import { cantonNotLive } from "../stub/not-deployed";
import { absent } from "../stub/product";

/** Kept for callers that name the old gate; private mode no longer refuses on it. */
export const PRIVATE_NOT_LIVE = cantonNotLive("private");
export const PRIVATE_NOT_LIVE_WORDS = "Private mode is not live on this network yet";

const statusWire = z.object({
  ready: z.boolean(),
  reasons: z.array(z.string()),
  mode: z.enum(["desk-signed-slot", "venue-bucket"]),
  desk: z.string().nullable(),
  contract: z.string().nullable(),
  chainId: z.number().int(),
  minStakeBase: z.string().nullable(),
  maxStakeBase: z.string().nullable(),
  paused: z.boolean(),
});

const CASH_DECIMALS = 6;

/** What the budget allows now: the allowance, capped by the balance. Pure. */
export function toPrivateBudget(balanceBase: bigint, allowanceBase: bigint): PrivateBudget {
  return { balanceBase, allowanceBase, spendableBase: allowanceBase < balanceBase ? allowanceBase : balanceBase };
}

/** The venue as the private route's desk: its id, its cluster, its per-bet bounds; null when the route answers no desk. */
export function getPrivateDeskState(): Promise<Reading<PrivateDeskState | null>> {
  return withReading("private:desk", async () => {
    const r = await ledgerRequest("/private/status", { method: "GET", wire: statusWire, root: true, seat: false });
    if (!r.ok) throw new Error(r.diagnosis.technical);
    const s = r.value;
    if (s.mode !== "venue-bucket" || !s.desk || !s.contract) return null;
    return {
      deployment: { chainId: s.chainId, privateDesk: s.contract as Address, fromBlock: 0n },
      params: { minStakeBase: BigInt(s.minStakeBase ?? "0"), maxStakeBase: BigInt(s.maxStakeBase ?? "0"), minTimeLeftSec: 20 },
      desk: s.desk as Address,
      paused: s.paused,
      poolBase: 0n,
      owedBase: 0n,
      inSlotsBase: 0n,
      decimals: CASH_DECIMALS,
    };
  });
}

/** The seat's private bucket: its balance, all of it the seat's own to spend (allowance = balance on Canton). */
export function getPrivateBudget(owner: Address): Promise<Reading<PrivateBudget>> {
  return withReading(`private:budget:${owner}`, async () => {
    const r = await ledgerRequest("/private/balance", { method: "GET", wire: privateBalanceReplyWire, root: true });
    if (!r.ok) throw new Error(r.diagnosis.technical);
    const balance = BigInt(r.value.balanceBase);
    return toPrivateBudget(balance, balance);
  });
}

/** There are no slots on Canton: a private call is the seat's own leg. */
export const getPrivateSlot = (_slotId: Hash32): Promise<Reading<PrivateSlot | null>> => absent(null);

/** The venue ladder's stake-first size for a private call: the same quote a public call reads, at click time. */
export async function sizePrivateForStake(marketId: MarketId, side: Side, stakeBase: bigint): Promise<Reading<PrivateQuote>> {
  const market = await getMarket(marketId);
  if (!isOk(market)) return market;
  if (!market.value) return err(diagnosis("market-not-trading", "no such Window"));
  const m = market.value;
  const q = await freshQuoteStake({ marketId, poolAddress: m.poolAddress, decimals: m.decimals, intervalSec: m.intervalSec }, side, stakeBase);
  if (!isOk(q)) return q;
  if (!q.value) return err(diagnosis("no-liquidity", "the venue ladder has no depth on this side right now"));
  const v = q.value;
  // The most the call can take from the private balance, as the public ticket's button shows it (the venue's firm
  // quote at click time walks the same ladder within the stake); the expected cost is lower when the ladder is deep.
  const costBase = v.maxCostBase < stakeBase ? v.maxCostBase : stakeBase;
  const priceRaw = v.contractsRaw === 0n ? 0n : (v.expectedCostBase * 10n ** BigInt(m.decimals)) / v.contractsRaw;
  return ok({ side, stakeBase, quantityRaw: v.contractsRaw, costBase, limitYesRaw: v.limitPriceRaw, priceRaw, decimals: m.decimals, quotedAtMs: v.quotedAtMs }, Date.now());
}
