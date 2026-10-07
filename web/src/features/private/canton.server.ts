import "server-only";
import { createHash } from "node:crypto";
import { CLUSTER_ID } from "@owarine/core/constants";
import { formatCadence } from "@owarine/core/copy";
import {
  PRIVATE_BUCKET,
  PRIVATE_LEG_REF,
  PRIVATE_MAX_STAKE_BASE,
  PRIVATE_MIN_STAKE_BASE,
  privateAuthFresh,
  privateOpenMessage,
  type PrivateBalanceReply,
  type PrivateCashoutResult,
  type PrivateOpenRequest,
  type PrivateOpenResult,
  type PrivatePosition,
  type PrivateStatus,
} from "@owarine/core/private";
import { toMarketId } from "@owarine/core/types";
import { formatBaseUnits } from "@owarine/core/units";
import { getDb, privatePositions } from "@owarine/db";
import { seatReceiptFor } from "@owarine/markets/server";
import { venueIdFromParty } from "@/app/api/venue/venue-facts";
import { verifyWalletMessage } from "@/lib/auth/verify-signed-message.server";
import { webEnv } from "@/lib/env";
import type { SeatContext } from "@/lib/seat.server";
import { seatServer } from "@/lib/ledger.server";
import { positionOf } from "./position";

/**
 * Private mode on Canton, the web's half (C8d, L-39; the model is `core/private/canton.ts`). The routes keep their
 * paths and act for the seat the lease names: the status names the venue as the desk; the balance reads the seat's
 * private bucket and its private calls; an open is the seat's own firm quote accepted with exactly its private cash and
 * tagged private. Since abu-pm-main 0.5.2 (K-315) the venue's settle pays a private call straight back into the private
 * bucket and its receipt says so, so a cash-out has nothing to move; it still asks ops to bring home a call the 0.5.1
 * engine paid into the seat's public balance. Nothing here acts as the venue.
 */

const CASH_DECIMALS = 6;
const SYMBOL = "credits";
const MODE_READ_TIMEOUT_MS = 1_500;

/** ops' venue mode, so a held venue says so before a private call is tried (C-DAML-02). */
async function venueModeNow(): Promise<string | null> {
  const base = webEnv.markets.priceFeedUrl;
  if (!base) return null;
  try {
    const body = (await (await fetch(`${base}/session`, { cache: "no-store", signal: AbortSignal.timeout(MODE_READ_TIMEOUT_MS) })).json()) as { venueMode?: { mode?: string } };
    return body.venueMode?.mode ?? null;
  } catch {
    return null;
  }
}

export async function privateStatus(): Promise<PrivateStatus> {
  const chainId = CLUSTER_ID[webEnv.markets.cluster];
  const state = seatServer();
  const base = { mode: "venue-bucket" as const, chainId, minStakeBase: PRIVATE_MIN_STAKE_BASE.toString(), maxStakeBase: PRIVATE_MAX_STAKE_BASE.toString() };
  if (!state.ok) return { ...base, ready: false, reasons: [state.reason], desk: null, contract: null, paused: false };
  const venue = venueIdFromParty(state.server.parties.venue!);
  const mode = await venueModeNow();
  const paused = mode !== null && mode !== "open";
  const reasons = paused ? [`the venue is ${mode} by its operator: no new private calls; cash-outs and moving money out stay open`] : [];
  return { ...base, ready: !paused, reasons, desk: venue as PrivateStatus["desk"], contract: venue as PrivateStatus["contract"], paused };
}

export async function privateBalance(seat: SeatContext): Promise<PrivateBalanceReply> {
  const { server, lease } = seat;
  const snap = await server.ledger.seats.read(lease.party, { fresh: true });
  const balance = (snap.privateCash ?? []).reduce((s, c) => s + c.amount, 0n);
  const db = getDb();
  const rows = db ? await privatePositions(db, lease.party, lease.startOffset) : [];
  return { balanceBase: balance.toString(), positions: rows.map(positionOf) };
}

/** A UUID from the owner's authorisation: the same signature always re-sends the same command, so it can never charge twice. */
function journalIdOf(signature: string): string {
  const h = createHash("sha256").update(`private-open:${signature}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const refused = (reason: string, technical = reason): PrivateOpenResult => ({ status: "refused", reason, technical, refundedBase: "0", txs: {} });

interface MarketRow {
  market: string;
  market_key: string;
  symbol: string | null;
  cadence_sec: number | null;
  expiry_sec: string;
}

export async function openPrivate(seat: SeatContext, body: PrivateOpenRequest): Promise<{ status: number; result: PrivateOpenResult | { error: string } }> {
  const { server, lease, caller } = seat;
  if (body.owner !== caller) return { status: 401, result: { error: "the authorisation names another seat key than the one this lease proved" } };
  if (!privateAuthFresh(body.issuedAtMs, Date.now())) return { status: 400, result: { error: "the authorisation has expired: sign the bet again" } };
  const stakeBase = BigInt(body.stakeBase);
  if (stakeBase < PRIVATE_MIN_STAKE_BASE || stakeBase > PRIVATE_MAX_STAKE_BASE) return { status: 400, result: { error: "the stake is outside the private route's bounds" } };
  const db = getDb();
  const [m] = db ? await db<MarketRow[]>`SELECT market, market_key, symbol, cadence_sec, expiry_sec::text FROM idx_markets WHERE market = ${body.marketId}` : [];
  if (!m) return { status: 404, result: { error: "no such Window" } };
  const venue = venueIdFromParty(server.parties.venue!);
  const message = privateOpenMessage({
    owner: body.owner, contract: venue, chainId: CLUSTER_ID[webEnv.markets.cluster], marketId: body.marketId, asset: m.symbol ?? "", cadenceText: formatCadence(m.cadence_sec ?? 0),
    expirySec: Number(m.expiry_sec), side: body.side, stakeText: formatBaseUnits(stakeBase, CASH_DECIMALS, { maxDp: CASH_DECIMALS, minDp: 0, group: false }), symbol: SYMBOL, issuedAtMs: body.issuedAtMs,
  });
  if (!(await verifyWalletMessage({ text: message, signature: body.signature, signer: body.owner }))) return { status: 401, result: { error: "authorisation was not signed by the owner" } };

  const snap = await server.ledger.seats.read(lease.party, { fresh: true });
  const privateBase = (snap.privateCash ?? []).reduce((s, c) => s + c.amount, 0n);
  if (privateBase < stakeBase) return { status: 200, result: refused("Your private balance does not cover this stake: move credits in first.") };
  const quote = await server.ops.quote({ party: lease.party, leaseId: lease.leaseId, marketId: toMarketId(body.marketId), side: body.side, stakeBase, displayedMaxCostBase: stakeBase });
  if (quote.kind === "refused") return { status: 200, result: refused(quote.diagnosis.technical) };
  if (quote.kind === "requote") return { status: 200, result: refused("The venue's price moved past this stake; nothing was charged. Try again.") };
  if (quote.quote.contractsRaw < BigInt(body.minQuantityRaw)) return { status: 200, result: refused("The ladder moved under your floor; nothing was charged. Try again.") };
  const accepted = await server.ledger.writer.accept({ party: lease.party, leaseId: lease.leaseId }, { journalId: journalIdOf(body.signature), quoteCid: quote.quoteCid, beneficiaryRef: PRIVATE_LEG_REF });
  if (accepted.kind === "refused") return { status: 200, result: refused(accepted.diagnosis.technical) };
  if (accepted.kind === "unknown") return { status: 200, result: { status: "unknown", reason: accepted.diagnosis.technical, txs: {} } };
  server.ledger.seats.invalidate(lease.party);
  const after = await server.ledger.seats.read(lease.party, { fresh: true });
  const leg = (after.privateLegs ?? []).filter((l) => l.damlMarketId === m.market_key).sort((a, b) => b.createdAtMs - a.createdAtMs)[0];
  const booked = accepted.booked;
  const position: PrivatePosition = {
    pairId: leg?.pairId ?? "", marketId: m.market_key, asset: m.symbol ?? "", intervalSec: m.cadence_sec ?? 0, expirySec: Number(m.expiry_sec), side: body.side,
    lots: (leg?.lots ?? 0n).toString(), costBase: booked.costBase.toString(), status: "open", result: null, payoutBase: null, openedUpdateId: accepted.updateId, openedAtSec: Math.floor(Date.now() / 1000),
  };
  return { status: 200, result: { status: "placed", position, updateId: accepted.updateId, recovered: accepted.recovered } };
}

/**
 * A settled private call's payout home. 0.5.2 (K-315): the receipt says the payout already landed in the private bucket,
 * so nothing moves ("done"). A 0.5.1 receipt: ops moves the payout back in and dismisses the receipt, once.
 */
export async function cashoutPrivate(seat: SeatContext, pairId: string, marketKey: string, journalId: string): Promise<{ status: number; result: PrivateCashoutResult | { error: string } }> {
  const { server, lease } = seat;
  const receipt = await seatReceiptFor(server.client, { party: lease.party, pairId, marketKey, fromOffset: lease.startOffset });
  if (!receipt) {
    const snap = await server.ledger.seats.read(lease.party, { fresh: true });
    const open = (snap.privateLegs ?? []).find((l) => l.pairId === pairId);
    if (open) return { status: 200, result: { status: "open", expirySec: Math.floor(open.refundAfterMs / 1000) } };
    return { status: 200, result: { status: "done", creditedBase: "0" } };
  }
  if (receipt.paidInto === PRIVATE_BUCKET) return { status: 200, result: { status: "done", creditedBase: receipt.payoutBase.toString() } };
  const reply = await server.ops.privateMove({ party: lease.party, leaseId: lease.leaseId, requestId: journalId, op: "cashout", receiptCid: receipt.cid });
  if (reply.kind === "refused") return { status: 502, result: { error: reply.diagnosis.technical } };
  server.ledger.seats.invalidate(lease.party);
  return { status: 200, result: { status: "credited", payoutBase: reply.amountBase, creditedBase: reply.amountBase, txs: {} } };
}
