/**
 * The seat's live settlement receipt for one of its calls (C8d, L-39): what a private call's cash-out dismisses as its
 * payout comes home, or (0.5.2, K-315) the receipt that says the payout is home already. Read as the seat; a receipt
 * created before the lease began is an earlier visitor's (K-224).
 */
import { TEMPLATE_IDS } from "@owarine/daml";
import type { LedgerClient } from "@owarine/ledger";

export interface SeatReceiptRef {
  cid: string;
  payoutBase: bigint;
  /** abu-pm-main 0.5.2 (K-315): `private` when the payout already landed in the private bucket; null for a 0.5.1 receipt. */
  paidInto: string | null;
}

export async function seatReceiptFor(client: Pick<LedgerClient, "activeContracts">, o: { party: string; pairId: string; marketKey: string; fromOffset: number }): Promise<SeatReceiptRef | null> {
  const acs = await client.activeContracts({ parties: [o.party], templateIds: [TEMPLATE_IDS.SettlementReceipt] });
  for (const { createdEvent: e } of acs.contracts) {
    const a = e.createArgument as Record<string, unknown>;
    if (a.owner === o.party && a.pairId === o.pairId && a.marketId === o.marketKey && Number(e.offset) >= o.fromOffset) return { cid: e.contractId, payoutBase: BigInt(String(a.payout ?? "0")), paidInto: typeof a.paidInto === "string" ? a.paidInto : null };
  }
  return null;
}
