/**
 * The parlay reserve on Canton (C8c): the `parlay` ticket reserve and the seat's own `ParlayTicket`s, through
 * `/api/ledger/tickets/*`. A ticket's legs are decided one at a time in the order their Windows close.
 */
import type { ParlayReserveState, ParlayTicket } from "@agari/core/parlay";
import type { ProviderShares } from "@agari/core/reserves";
import { ok, type Reading } from "@agari/core/schemas";
import type { Address } from "@agari/core/types";
import { registeredSeatAddress } from "../provider/ledger-api";
import { cantonNotLive } from "../stub/not-deployed";
import { readReserve, readTicketsMine, ticketIdOf } from "../tickets/client";
import { endedParlays } from "../tickets/receipt-views";
import { parlayReserveOf, parlayTicketOf, sharesOf } from "../tickets/views";

/** Kept for the reference's export: what a parlay surface says where the ticket desk is not reachable. */
export const PARLAY_NOT_LIVE = cantonNotLive("parlay");

export async function getParlayReserveState(): Promise<Reading<ParlayReserveState | null>> {
  const r = await readReserve("parlay");
  return r.ok ? ok(r.value ? parlayReserveOf(r.value) : null, r.asOfMs) : r;
}

export async function listParlaysOf(wallet: Address): Promise<Reading<ParlayTicket[]>> {
  const mine = await readTicketsMine();
  // Live tickets, then the ended ones from their receipts (newest first).
  return mine.ok ? ok([...mine.value.parlays.map((t) => parlayTicketOf(t, wallet)), ...endedParlays(mine.value.receipts, wallet)], mine.asOfMs) : mine;
}

export async function getParlay(parlayId: bigint): Promise<Reading<ParlayTicket | null>> {
  const mine = await readTicketsMine();
  if (!mine.ok) return mine;
  const owner = registeredSeatAddress() ?? ("" as Address);
  const t = mine.value.parlays.find((x) => ticketIdOf(x.cid) === parlayId);
  return ok(t ? parlayTicketOf(t, owner) : (endedParlays(mine.value.receipts, owner).find((x) => x.parlayId === parlayId) ?? null), mine.asOfMs);
}

export async function getParlaySharesOf(_wallet: Address): Promise<Reading<ProviderShares>> {
  const mine = await readTicketsMine();
  return mine.ok ? ok(sharesOf(mine.value, "parlay"), mine.asOfMs) : mine;
}
