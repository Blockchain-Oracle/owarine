import type { MarketId, OutcomeIdx } from "../types/market";
import type { Signature } from "../types/primitives";
import { oneUnit } from "../units/decimals";
import type { LedgerFill, LedgerSetAction, MarketLedger, SideCost } from "./types";

type Event = { atMs: number; seq: number; marketId: MarketId; txHash: Signature; apply: (ledger: MarketLedger) => void };

const UP: OutcomeIdx = 0;
const DOWN: OutcomeIdx = 1;

const noCost = (): SideCost => ({ backingBase: 0n, feeBase: 0n });

function fresh(marketId: MarketId, atMs: number, txHash: Signature): MarketLedger {
  return {
    marketId, heldUpRaw: 0n, heldDownRaw: 0n, costBase: 0n, proceedsBase: 0n, held: { up: noCost(), down: noCost() }, feesBase: 0n,
    sidesTraded: [], fillCount: 0, shortCount: 0, firstAtMs: atMs, lastAtMs: atMs, entryTxHash: txHash,
  };
}

const sideCost = (ledger: MarketLedger, side: OutcomeIdx): SideCost => (side === UP ? ledger.held!.up : ledger.held!.down);
const ceilDiv = (a: bigint, b: bigint) => (a + b - 1n) / b;

function noteSide(ledger: MarketLedger, side: OutcomeIdx): void {
  if (!ledger.sidesTraded.includes(side)) ledger.sidesTraded.push(side);
}

/** A buy books its backing and the fee paid with it (Canton charges the fee at the fill, `PM.Quote`). */
function buy(ledger: MarketLedger, side: OutcomeIdx, quantityRaw: bigint, priceRaw: bigint, one: bigint, feeBase = 0n): void {
  if (side === UP) ledger.heldUpRaw += quantityRaw;
  else ledger.heldDownRaw += quantityRaw;
  const backingBase = (quantityRaw * priceRaw) / one;
  ledger.costBase += backingBase + feeBase;
  ledger.feesBase = (ledger.feesBase ?? 0n) + feeBase;
  const cost = sideCost(ledger, side);
  cost.backingBase += backingBase;
  cost.feeBase += feeBase;
  noteSide(ledger, side);
}

/**
 * A sell beyond inventory is a collateral-backed short, and the venue hands the seller the
 * complement: selling UP you do not hold is buying DOWN at (1 − price). Verified against the
 * chain's own balances (2026-09-02): the indexer labels these plain sells, the wallet ends up
 * holding the other side. The part that was inventory is a real sell with real proceeds.
 */
function sell(ledger: MarketLedger, side: OutcomeIdx, quantityRaw: bigint, priceRaw: bigint, one: bigint): void {
  const held = side === UP ? ledger.heldUpRaw : ledger.heldDownRaw;
  const sold = quantityRaw < held ? quantityRaw : held;
  const shorted = quantityRaw - sold;
  if (sold > 0n) {
    // The sold slice takes the ceiling of the backing and of the fee escrow; the kept leg keeps the rest (`BuyQuote_Accept`).
    const cost = sideCost(ledger, side);
    cost.backingBase -= ceilDiv(cost.backingBase * sold, held);
    cost.feeBase -= ceilDiv(cost.feeBase * sold, held);
    if (side === UP) ledger.heldUpRaw -= sold;
    else ledger.heldDownRaw -= sold;
    ledger.proceedsBase += (sold * priceRaw) / one;
  }
  if (shorted > 0n) {
    ledger.shortCount += 1;
    buy(ledger, side === UP ? DOWN : UP, shorted, one - priceRaw, one);
  }
}

function fillEvent(fill: LedgerFill, seq: number, one: bigint): Event {
  const isUp = fill.side === "BUY_YES" || fill.side === "SELL_YES";
  const isBuy = fill.side === "BUY_YES" || fill.side === "BUY_NO";
  const side: OutcomeIdx = isUp ? UP : DOWN;
  // The book prices in YES terms; the DOWN leg pays the complement (canon #20).
  const priceRaw = isUp ? fill.yesPriceRaw : one - fill.yesPriceRaw;
  return {
    atMs: fill.atMs,
    seq,
    marketId: fill.marketId,
    txHash: fill.txHash,
    apply: (ledger) => {
      ledger.fillCount += 1;
      if (isBuy) buy(ledger, side, fill.quantityRaw, priceRaw, one, fill.feeBase ?? 0n);
      else sell(ledger, side, fill.quantityRaw, priceRaw, one);
    },
  };
}

/** A complete set costs exactly one collateral per pair and merges back for the same, gross. */
function setEvent(action: LedgerSetAction, seq: number): Event {
  return {
    atMs: action.atMs,
    seq,
    marketId: action.marketId,
    txHash: action.txHash,
    apply: (ledger) => {
      if (action.kind === "mint") {
        ledger.heldUpRaw += action.amountRaw;
        ledger.heldDownRaw += action.amountRaw;
        ledger.costBase += action.amountRaw;
        // A complete set (the reference's router; Canton has none) backs each side with half its price.
        ledger.held!.up.backingBase += action.amountRaw - action.amountRaw / 2n;
        ledger.held!.down.backingBase += action.amountRaw / 2n;
        noteSide(ledger, UP);
        noteSide(ledger, DOWN);
      } else {
        const pairs = action.amountRaw < ledger.heldUpRaw ? action.amountRaw : ledger.heldUpRaw;
        const merged = pairs < ledger.heldDownRaw ? pairs : ledger.heldDownRaw;
        if (merged > 0n) {
          for (const [cost, heldRaw] of [[ledger.held!.up, ledger.heldUpRaw], [ledger.held!.down, ledger.heldDownRaw]] as const) {
            cost.backingBase -= ceilDiv(cost.backingBase * merged, heldRaw);
            cost.feeBase -= ceilDiv(cost.feeBase * merged, heldRaw);
          }
        }
        ledger.heldUpRaw -= merged;
        ledger.heldDownRaw -= merged;
        ledger.proceedsBase += merged;
      }
    },
  };
}

/**
 * Replays a wallet's fills and router actions oldest-first into one ledger per market.
 *
 * Order matters twice: a sell only counts as a sell against inventory bought before it, and a
 * merge can only remove pairs already held. Ties on the timestamp keep arrival order.
 */
export function buildLedgers(fills: readonly LedgerFill[], actions: readonly LedgerSetAction[], decimals: number): Map<MarketId, MarketLedger> {
  const one = oneUnit(decimals);
  const events: Event[] = [...fills.map((fill, i) => fillEvent(fill, i, one)), ...actions.map((action, i) => setEvent(action, fills.length + i))];
  events.sort((a, b) => a.atMs - b.atMs || a.seq - b.seq);

  const ledgers = new Map<MarketId, MarketLedger>();
  for (const event of events) {
    const ledger = ledgers.get(event.marketId) ?? fresh(event.marketId, event.atMs, event.txHash);
    event.apply(ledger);
    ledger.lastAtMs = event.atMs;
    ledgers.set(event.marketId, ledger);
  }
  return ledgers;
}

/** True while the wallet still holds something here, or ever traded — a ledger with no fills is not a round. */
export function ledgerHasActivity(ledger: MarketLedger): boolean {
  return ledger.fillCount > 0 || ledger.costBase > 0n;
}
