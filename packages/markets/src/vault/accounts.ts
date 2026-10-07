import type { Address } from "@owarine/core/types";

/** An owner's trading-balance account in base units (`VenueCash` on Canton, C7a). */
export interface VaultAccountView {
  available: bigint;
  privateAvailable: bigint;
  totalDeposited: bigint;
  totalWithdrawn: bigint;
}

/** No `VenueCash` on the participant yet, so no owner has an account: null, which every reader shows as zeros. */
export async function readVaultAccount(_owner: Address): Promise<VaultAccountView | null> {
  return null;
}

/** The price grid's tick in base units for a collateral with `decimals` (a YES price is `ticks × tickBase`, 1000 ticks = 1 unit). */
export function tickBaseOf(decimals: number): bigint {
  return 10n ** BigInt(decimals) / 1000n;
}
