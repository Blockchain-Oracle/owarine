import type { Address, MarketId } from "@owarine/core/types";
import type { QueryClient } from "@tanstack/react-query";
import { keys } from "./keys";

export interface WriteScope {
  wallet: Address;
  marketId?: MarketId;
}

/** Refresh spendable balances and ordinary positions before another write; refresh other views in the background.
 * A slow ticket/history/reserve read must not hold an already-confirmed ordinary trade's receipt or controls. */
export async function invalidateAfterWrite(queryClient: QueryClient, { wallet, marketId }: WriteScope): Promise<void> {
  // Dropping the trailing venue id turns the key into a prefix that matches every venue for this wallet.
  const claimablesForWallet = keys.claimables(wallet, null).slice(0, -1);
  const money = [
    keys.balanceSheet(wallet),
    keys.walletCollateral(wallet),
    keys.vault(wallet),
    keys.positions(wallet),
  ];
  const families = [
    keys.history(wallet),
    keys.parlays(wallet),
    keys.parlayReserve(),
    keys.parlayShares(wallet),
    keys.ranges(wallet),
    keys.rangeReserve(),
    keys.rangeShares(wallet),
    keys.makerVault(),
    keys.makerShares(wallet),
    keys.leveragePositions(wallet),
    keys.leverageReserve(),
    keys.leverageShares(wallet),
    keys.privateDesk(),
    keys.privateBudget(wallet),
    claimablesForWallet,
    ...(marketId ? [keys.onchain(marketId), keys.market(marketId)] : []),
  ];
  for (const queryKey of families) void queryClient.invalidateQueries({ queryKey }).catch(() => undefined);
  await Promise.all(money.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}
