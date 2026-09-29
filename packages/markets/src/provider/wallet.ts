/**
 * A seat's money (first-call.md §2.2): open positions and claimables discovered from the seat's own projection rows
 * (never a venue scan), then the head-fresh truth from the ledger as that seat's party: its venue cash and its legs in
 * the Windows it still has something in. Until the Canton adapter lands (C4) the ledger reads reject with the
 * not-deployed reading, which `withReading` returns as the honest answer.
 */
import { enumerateClaimables, type SettledHolding } from "@agari/core/claims";
import type { Reading } from "@agari/core/schemas";
import type { Address, BalanceSheet, ClaimableRow, MarketId, OpenPosition, VenueCredit } from "@agari/core/types";
import { oneUnit } from "@agari/core/units";
import { readSeat, readTokenBalance, readVenueStatic, type LedgerSeat } from "../runtime/accounts";
import { loadCollateral } from "../collateral";
import { big, indexRows, sec, type PositionRow } from "./index-api";
import { withReading } from "./reading";
import { positionMarket } from "./rows";

const PAIR_TICKS = 1000n;
/** The balance sheet reads at most this many Ledgers per poll (spec: ≤ 10 unredeemed Windows). */
const MAX_CREDIT_LEDGERS = 10;

/** The wallet's position rows on registry tickers: a drive-only Series (no symbol) is never a user surface. */
const positionsOf = async (wallet: Address, unredeemed = false) =>
  (await indexRows<PositionRow>(`wallet/${wallet}/positions`, unredeemed ? { unredeemed: 1 } : {})).filter((row) => row.symbol !== null);
/** The seat's position in each row's Window; null where the Window's positions are closed or it holds nothing. */
async function seatsIn(wallet: Address, rows: readonly PositionRow[]): Promise<(LedgerSeat | null)[]> {
  return Promise.all(rows.map(async (row) => (row.ledger === null ? null : ((await readSeat(row.ledger as Address, wallet))?.seat ?? null))));
}

export async function listOpenPositions(wallet: Address): Promise<Reading<OpenPosition[]>> {
  return withReading(`positions:${wallet}`, async () => {
    const [rows, venue] = await Promise.all([positionsOf(wallet), readVenueStatic()]);
    const one = oneUnit(venue.decimals);
    return rows
      .filter((row) => row.state === "open" && big(row.yes_lots) + big(row.no_lots) > 0n)
      .map((row) => {
        const lotBase = big(row.lot_base);
        const cashUnit = big(row.cash_unit);
        const upRaw = big(row.yes_lots) * lotBase;
        const downRaw = big(row.no_lots) * lotBase;
        const costBasisBase = big(row.paid_ticklots) * cashUnit + big(row.set_paid_base);
        const realizedPnlBase = big(row.received_ticklots) * cashUnit + big(row.set_received_base);
        const last = row.last_price_ticks === null ? null : BigInt(row.last_price_ticks);
        // Held lots at the last trade, each side in its own terms: YES at p, NO at 1000 − p (lots × ticks × cash unit).
        const markValueBase = last === null ? 0n : (big(row.yes_lots) * last + big(row.no_lots) * (PAIR_TICKS - last)) * cashUnit;
        const heldRaw = upRaw + downRaw;
        return {
          marketId: row.market as MarketId,
          asset: row.symbol ?? "",
          intervalSec: row.cadence_sec ?? 0,
          expirySec: sec(row.expiry_sec),
          decimals: venue.decimals,
          balanceUpRaw: upRaw,
          balanceDownRaw: downRaw,
          costBasisBase,
          avgCostRaw: heldRaw > 0n ? (costBasisBase * one) / heldRaw : 0n,
          markValueBase,
          unrealizedPnlBase: markValueBase + realizedPnlBase - costBasisBase,
          realizedPnlBase,
        };
      });
  });
}

/** Terminal Windows the wallet hasn't redeemed, checked against its live seat: a seat already paid is no row. */
export async function listClaimables(wallet: Address, venueId: Address): Promise<Reading<ClaimableRow[]>> {
  return withReading(`claimables:${wallet}:${venueId}`, async () => {
    const [rows, venue] = await Promise.all([positionsOf(wallet, true), readVenueStatic()]);
    const terminal = rows.filter((row) => row.state !== "open");
    if (terminal.length === 0) return [];
    const seats = await seatsIn(wallet, terminal);
    const settled: SettledHolding[] = [];
    terminal.forEach((row, i) => {
      const seat = seats[i];
      if (!seat) return;
      const lotBase = big(row.lot_base);
      settled.push({
        market: positionMarket(row, venue.decimals),
        holdings: { upRaw: (seat.yesFree + seat.yesLocked) * lotBase, downRaw: (seat.noFree + seat.noLocked) * lotBase },
        feeBps: 0,
      });
    });
    return enumerateClaimables(settled);
  });
}

/**
 * Every pool of money labelled separately (FR-5): venue cash, locked cash, credit, the Trading Balance. `nativeLamports`
 * keeps its field and is always 0: a Canton seat pays no network fee and holds no fee token. The Trading Balance is
 * `null` until its package is live (C7a).
 */
export async function getBalanceSheet(wallet: Address): Promise<Reading<BalanceSheet>> {
  return withReading(`balances:${wallet}`, async () => {
    const [rows, venue] = await Promise.all([positionsOf(wallet, true), readVenueStatic()]);
    // Open Windows first: their seats hold live escrow; a terminal Ledger is usually already closed.
    const credited = rows
      .filter((row) => row.ledger !== null)
      .sort((a, b) => Number(b.state === "open") - Number(a.state === "open"))
      .slice(0, MAX_CREDIT_LEDGERS);
    const [token, seats] = await Promise.all([readTokenBalance(wallet, venue.collateralMint), seatsIn(wallet, credited)]);
    const credits: VenueCredit[] = [];
    let orderEscrowBase = 0n;
    credited.forEach((row, i) => {
      const seat = seats[i];
      if (!seat) return;
      orderEscrowBase += seat.lockedCash;
      if (seat.credit > 0n) credits.push({ marketId: row.market as MarketId, amountBase: seat.credit });
    });
    return {
      decimals: venue.decimals,
      spendableBase: token.amountBase ?? 0n,
      nativeLamports: 0n,
      orderEscrowBase,
      venueCreditBase: credits.reduce((sum, credit) => sum + credit.amountBase, 0n),
      venueCreditByMarket: credits,
      vaultBase: null,
    };
  });
}

/** A seat's venue cash: the collateral fact and one cash read, nothing venue-wide. */
export function getWalletCollateral(wallet: Address): Promise<Reading<{ amountBase: bigint; decimals: number; symbol: string }>> {
  return withReading(`wallet-collateral:${wallet}`, async (inner) => {
    const collateral = inner(await loadCollateral());
    const { amountBase } = await readTokenBalance(wallet, collateral.address);
    return { amountBase: amountBase ?? 0n, decimals: collateral.decimals, symbol: collateral.symbol };
  });
}
