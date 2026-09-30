import { isMarketId } from "@agari/core/types";

/** What web sends ops for a resting call: the request as the seat confirmed it, plus WHO, taken from the lease only. */
export interface RestingOfferRequest {
  marketId: string;
  side: "up" | "down";
  stakeBase: bigint;
  priceCents: number;
  restUntil: "bell" | "lock";
  displayedEscrowBase: bigint;
  party: string;
  leaseId: string;
}

const PARTY_ID = /^[A-Za-z0-9_\-:]{1,255}::[0-9a-f]{8,}$/;
const LEASE_ID = /^[A-Za-z0-9_\-]{1,64}$/;
const UINT = /^\d{1,19}$/;

/** Bodies carry bigints as decimal strings (`jsonText`); anything else is refused with a sentence. */
export function parseRestingRequest(body: unknown): RestingOfferRequest | string {
  if (typeof body !== "object" || body === null) return "body must be an object";
  const b = body as Record<string, unknown>;
  if (typeof b.party !== "string" || !PARTY_ID.test(b.party)) return "party must be a party id";
  if (typeof b.leaseId !== "string" || !LEASE_ID.test(b.leaseId)) return "leaseId must be 1–64 of [A-Za-z0-9_-]";
  if (typeof b.marketId !== "string" || !isMarketId(b.marketId)) return "marketId must be the app's base58 market id";
  if (b.side !== "up" && b.side !== "down") return "side must be up or down";
  if (typeof b.stakeBase !== "string" || !UINT.test(b.stakeBase)) return "stakeBase must be a decimal integer string";
  if (typeof b.displayedEscrowBase !== "string" || !UINT.test(b.displayedEscrowBase)) return "displayedEscrowBase must be a decimal integer string";
  if (typeof b.priceCents !== "number" || !Number.isInteger(b.priceCents) || b.priceCents < 1 || b.priceCents > 99) return "priceCents must be a whole number of cents, 1..99";
  const restUntil = b.restUntil === undefined ? "bell" : b.restUntil;
  if (restUntil !== "bell" && restUntil !== "lock") return "restUntil must be bell or lock";
  return { marketId: b.marketId, side: b.side, stakeBase: BigInt(b.stakeBase), priceCents: b.priceCents, restUntil, displayedEscrowBase: BigInt(b.displayedEscrowBase), party: b.party, leaseId: b.leaseId };
}
