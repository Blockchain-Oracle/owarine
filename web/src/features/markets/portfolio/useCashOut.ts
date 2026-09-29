"use client";

import { isOk } from "@agari/core/schemas";
import type { OrderRoute, WritePhase } from "@agari/core/ports";
import type { Diagnosis, ExitQuote, MarketId, Side } from "@agari/core/types";
import { formatBaseUnits } from "@agari/core/units";
import { marketsProvider, type HeldExit } from "@agari/markets";
import { invalidateAfterWrite, useSubmitter } from "@agari/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { diagnosisCopy } from "@/lib/copy";
import { notify } from "@/lib/toast";
import { useWalletSession } from "@/lib/wallet-session";

/** The plain cash-out's words (L-35): the link is `LeverageBetRow`'s, the refusals are the plan's (`00-plan.md:1001`). */
export const CASH_OUT = {
  cashOut: "Cash out",
  sellHalf: "Sell half",
  cashingOut: "Cashing out…",
  noLiquidity: "No exit liquidity right now",
  locked: "No exit liquidity: this Window has locked, it pays at settlement",
  notLive: "Cash-out isn't live on this network yet",
  nothingSold: "Nothing sold: the price moved before the sale landed. Your position is unchanged.",
  requote: (floor: string) => `The venue's price moved: the exit now pays ${floor}. Cash out again to take it.`,
  pending: "Waiting for the chain to answer — the sell is journaled, nothing is re-sent.",
  done: "Cashed out",
  doneBody: (proceeds: string, toVault: boolean) => `${proceeds} is back in your ${toVault ? "Trading Balance" : "demo credits"}.`,
  /** The held buy-back's line beside its ring: what the sale pays, for how many. */
  held: (proceeds: string, size: string) => `Pays ${proceeds} for ${size}`,
} as const;

export interface CashOutTarget {
  marketId: MarketId;
  side: Side;
  /** What this route holds on that side. */
  heldRaw: bigint;
  decimals: number;
  symbol: string | undefined;
  /** The wallet's own seat by default; `vault` sells from the Trading Balance's slot. */
  route?: OrderRoute;
  /** Reads outside the shared write families that this sell changes (the vault's open bets). */
  onConfirmed?: () => Promise<void>;
}

function refusalNote(d: Diagnosis): string {
  if (d.kind === "no-liquidity") return CASH_OUT.noLiquidity;
  if (d.kind === "market-not-trading") return CASH_OUT.locked;
  if (d.kind === "not-deployed") return CASH_OUT.notLive;
  return diagnosisCopy(d.kind).headline;
}

export type CashOutSize = "all" | "half";

const SOLD_STEPS_MS = 8_000;

/**
 * One open bet's cash-out: an indicative exit from the venue ladder at the tap, then the firm buy-back and the seat's
 * accept on the submitter's lane with that exit's floor (`minProceedsBase`). "Sell half" sells half the lots (partial
 * lots, C7a). While writing, the surface shows the held price with its ring and the write steps (direction B). A requote
 * keeps the fresh exit so the next tap accepts exactly that floor; every refusal is a sentence beside the link.
 */
export function useCashOut(target: CashOutTarget) {
  const submitter = useSubmitter();
  const { address } = useWalletSession();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [requoted, setRequoted] = useState<{ size: CashOutSize; exit: ExitQuote } | null>(null);
  const [phase, setPhase] = useState<WritePhase | null>(null);
  const [held, setHeld] = useState<HeldExit | null>(null);
  const [updateId, setUpdateId] = useState<string | null>(null);
  const money = (base: bigint) => `${formatBaseUnits(base, target.decimals)} ${target.symbol ?? ""}`.trim();

  const cashOut = async (size: CashOutSize = "all") => {
    if (!submitter || !address || busy) return;
    setBusy(true);
    setNote(null);
    setPhase(null);
    setHeld(null);
    setUpdateId(null);
    try {
      const market = await marketsProvider.getMarket(target.marketId);
      if (!isOk(market)) return setNote(refusalNote(market.error));
      if (!market.value) return setNote(CASH_OUT.noLiquidity);
      const want = size === "half" ? target.heldRaw / 2n : target.heldRaw;
      let exit = requoted?.size === size ? requoted.exit : null;
      if (!exit) {
        const { marketId, poolAddress, decimals, intervalSec } = market.value;
        const quote = await marketsProvider.freshExitQuote({ marketId, poolAddress, decimals, intervalSec }, target.side, want);
        if (!isOk(quote)) return setNote(refusalNote(quote.error));
        if (!quote.value) return setNote(CASH_OUT.noLiquidity);
        exit = quote.value;
      }
      setRequoted(null);
      const outcome = await submitter.submitCashOut(
        { market: market.value, side: target.side, contractsRaw: exit.contractsRaw, displayedExit: exit, wallet: address, ...(target.route ? { route: target.route } : {}) },
        (p, detail) => {
          setPhase(p);
          if (detail?.txHash) setUpdateId(detail.txHash);
        },
        setHeld,
      );
      switch (outcome.status) {
        case "confirmed":
          notify.neutral(CASH_OUT.done, CASH_OUT.doneBody(money(outcome.booked.proceedsBase ?? exit.expectedProceedsBase), target.route?.kind === "vault"));
          await Promise.all([invalidateAfterWrite(queryClient, { wallet: address, marketId: target.marketId }), target.onConfirmed?.()]);
          return;
        case "requote":
          setPhase(null);
          setRequoted({ size, exit: outcome.exit });
          return setNote(CASH_OUT.requote(money(outcome.exit.minProceedsBase)));
        case "nothingFilled":
          return setNote(CASH_OUT.nothingSold);
        case "unknown":
          return setNote(CASH_OUT.pending);
        default:
          setPhase((p) => (p === null || p === "composing" ? null : "reverted"));
          return setNote(refusalNote(outcome.diagnosis));
      }
    } finally {
      setBusy(false);
    }
  };

  // A finished sale's steps stay long enough to read the ledger update, then the row closes again.
  useEffect(() => {
    if (phase !== "confirmed") return;
    const id = setTimeout(() => {
      setPhase(null);
      setHeld(null);
      setUpdateId(null);
    }, SOLD_STEPS_MS);
    return () => clearTimeout(id);
  }, [phase]);

  /** Clears the finished write's steps (the row's receipt closes). */
  const dismiss = () => {
    setPhase(null);
    setHeld(null);
    setUpdateId(null);
  };

  return { canSign: submitter !== null && address !== null, busy, note, cashOut, phase, held, updateId, dismiss, money };
}
