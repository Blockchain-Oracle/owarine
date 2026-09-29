/**
 * Earn: the liquidity provider's reserve (`LpShare`/`NavStatement`, C8). Until it is on the participant there is no
 * vault (null), no window it quotes, and no shares; the answers are the truth, not a fault (D-015).
 */
import type { MakerDeployment, MakerVaultState, MakerWindowView } from "@agari/core/maker";
import type { ProviderShares } from "@agari/core/reserves";
import type { Reading } from "@agari/core/schemas";
import type { Address, MarketId } from "@agari/core/types";
import { cantonNotLive } from "../stub/not-deployed";
import { absent } from "../stub/product";

/** The reason every Earn read that needs the reserve states until it lands (C8). */
export const MAKER_NOT_LIVE = cantonNotLive("maker");

/** No maker package on the participant yet. */
export const resolveMakerDeployment = (): MakerDeployment | null => null;

export const getMakerVaultState = (): Promise<Reading<MakerVaultState | null>> => absent(null);
export const getMakerWindow = (_marketId: MarketId): Promise<Reading<MakerWindowView | null>> => absent(null);
export const getMakerSharesOf = (_wallet: Address): Promise<Reading<ProviderShares>> => absent({ shares: 0n, worthBase: 0n, suppliedBase: 0n, withdrawnBase: 0n });
