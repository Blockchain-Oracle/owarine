/**
 * The terminal's position → the ledger's resting exit (R2, abu-pm-seat), pure. Prices on the ledger are the held side's
 * own ticks of 1000 per lot; spot levels are price × 10^8. A position's contracts are `lots × 1000 × cashUnit`, so its
 * average price in ticks is `1000 × cost ÷ contracts`, and `ticks × contracts ÷ 1000` is what a sale at `ticks` pays.
 *
 *   trail   floor = what the position cost per lot, less the slippage tolerance: a trailing stop locks profit, so it
 *           never sells below break-even (less slippage); a gap through it holds the position instead of dumping it
 *   stop    floor = 1 tick: a stop-loss sells at the venue's bid, whatever it is, once the spot crosses the level
 *   take    the price per lot at which the sale pays cost + the target profit (ceiling), never below the floor
 */
import type { Side } from "@owarine/core/types";

export const PAIR_TICKS = 1000;
const E8 = 100_000_000;

const clampTicks = (t: number) => Math.min(999, Math.max(1, t));

/** The position's average price per lot in ticks (fee included): what a sale must pay per lot to break even. */
export function costTicks(costBasisBase: bigint, contractsRaw: bigint): number {
  if (contractsRaw <= 0n) return PAIR_TICKS;
  return Number((costBasisBase * 1000n + contractsRaw - 1n) / contractsRaw);
}

/** A trailing stop's floor: break-even less the slippage tolerance, on the ledger's grid. */
export function trailFloorTicks(costBasisBase: bigint, contractsRaw: bigint, slippageBps: number): number {
  return clampTicks(Math.floor((costTicks(costBasisBase, contractsRaw) * (10_000 - slippageBps)) / 10_000));
}

/** A stop-loss sells at the bid: its floor is the grid's least price. */
export const STOP_FLOOR_TICKS = 1;

/** The price per lot at which closing pays `cost + profit`; null when that is beyond what a lot can pay (999). */
export function takeProfitTicks(costBasisBase: bigint, contractsRaw: bigint, profitBase: bigint): number | null {
  if (contractsRaw <= 0n || profitBase <= 0n) return null;
  const t = Number(((costBasisBase + profitBase) * 1000n + contractsRaw - 1n) / contractsRaw);
  return t >= 1 && t <= 999 ? t : null;
}

/** What a sale of the whole position at `ticks` pays, in base units. */
export const proceedsAt = (ticks: number, contractsRaw: bigint): bigint => (BigInt(ticks) * contractsRaw) / 1000n;

/** A spot price as the ledger's level (× 10^8), rounded in the position's favour (an Up stop down, a Down stop up). */
export function stopE8Of(side: Side, price: number): bigint {
  const raw = price * E8;
  return BigInt(side === "up" ? Math.floor(raw) : Math.ceil(raw));
}

export const priceOfE8 = (e8: bigint): number => Number(e8) / E8;

/** The trail distance in basis points (the settings keep it as a fraction), on the ledger's 1..5000 range. */
export const trailBpsOf = (pct: number): number => Math.min(5000, Math.max(1, Math.round(pct * 10_000)));

/** Whether a stop level sits on the losing side of the spot, where a stop belongs (below for Up, above for Down). */
export const stopOnLosingSide = (side: Side, stop: number, spot: number): boolean => (side === "up" ? stop < spot : stop > spot);
