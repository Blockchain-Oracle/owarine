import { MARKETS_POLL_MS } from "@owarine/core/constants";
import type { Address } from "@owarine/core/types";
import { getWalletCollateral } from "../provider/reads";
import { keys } from "./keys";
import { useReadingQuery } from "./useReadingQuery";

export function useWalletCollateral(wallet: Address | null) {
  return useReadingQuery(keys.walletCollateral(wallet), () => getWalletCollateral(wallet!), { needs: [], enabled: wallet !== null, pollMs: MARKETS_POLL_MS });
}
