import { diagnosis, type Address, type Diagnosis, type OnchainSnapshot, type Quote } from "@owarine/core/types";
import { diagnose } from "../errors/error-map";
import { readSeat, readTokenBalance } from "../runtime/accounts";

/**
 * Whether an order's cost is covered. Venue credit is drawn first and the seat's venue cash second (the reference's
 * credit-first funding); a Canton seat posts no bond (`bondBase` is 0) and pays no network fee.
 */
export type FundingCheck =
  | {
      ok: true;
      venueCreditUsedBase: bigint;
      walletSpendBase: bigint;
      /** The bond this order pays: always 0 on Canton. */
      bondBase: bigint;
      /** The seat's position index on this Window, or null when this order opens one. */
      seatIndex: number | null;
    }
  | { ok: false; diagnosis: Diagnosis };

/**
 * `need = maxCost − min(credit, maxCost)` must fit the seat's venue cash (first-call.md §3.1). The ticket runs the same
 * check before the seat signs; the order lane re-runs it at send. Until the adapter lands the reads reject with the
 * not-deployed reading, which comes back as the refusal's diagnosis.
 */
export async function assertFunded(wallet: Address, onchain: OnchainSnapshot, quote: Quote): Promise<FundingCheck> {
  try {
    const [seatRead, token] = await Promise.all([readSeat(onchain.ledger, wallet), readTokenBalance(wallet, onchain.collateral)]);
    if (!seatRead) return { ok: false, diagnosis: diagnosis("market-not-trading", `the Window's positions ${onchain.ledger} are closed`) };
    const { seat, seatBond } = seatRead;
    const bondBase = seat ? 0n : seatBond;
    const escrowBase = quote.maxCostBase + bondBase;
    const credit = seat?.credit ?? 0n;
    const venueCreditUsedBase = credit < escrowBase ? credit : escrowBase;
    const walletSpendBase = escrowBase - venueCreditUsedBase;
    const balanceBase = token.amountBase ?? 0n;
    if (balanceBase < walletSpendBase) {
      return { ok: false, diagnosis: diagnosis("insufficient-collateral", `the seat holds ${balanceBase} but the order needs ${walletSpendBase} after venue credit`) };
    }
    return { ok: true, venueCreditUsedBase, walletSpendBase, bondBase, seatIndex: seat?.index ?? null };
  } catch (error) {
    return { ok: false, diagnosis: diagnose(error) };
  }
}
