"use client";

import { isOk } from "@agari/core/schemas";
import { formatBaseUnits } from "@agari/core/units";
import { collateralOrNull } from "@agari/markets";
import { useBalanceSheet } from "@agari/markets/react";
import { useEffect, useRef } from "react";
import { useWalletSession } from "@/lib/wallet-session";
import { leasedOf, useSeatLeaseState } from "@/providers/wallet/seat-lease-context";
import { announceCredit } from "./credited";

/**
 * Where a seat stands on its demo credits (plan §4): the grant is the seat funding the lease asks ops for on the
 * seat's first lease, so asking for it is asking for the lease again; the server funds a seat once per lease and says
 * `funded` when it did.
 *
 * - `no-seat`: take a seat first. `unleased`: a key with no party (lease one). `unfunded`: leased, the grant has not
 *   landed (ask again). `funded`: the credits are in the seat.
 */
export type SeatCreditStatus = "no-seat" | "unleased" | "unfunded" | "funded";

export function useSeatCredit() {
  const { address } = useWalletSession();
  const lease = useSeatLeaseState();
  const leased = leasedOf(lease.view);
  const sheet = useBalanceSheet(leased ? address : null);
  const balance = sheet && isOk(sheet) ? sheet.value : null;
  const symbol = collateralOrNull()?.symbol ?? "credits";
  const status: SeatCreditStatus = !address ? "no-seat" : !leased ? "unleased" : leased.funded ? "funded" : "unfunded";
  return {
    status,
    party: leased?.party ?? null,
    balanceText: balance ? `${formatBaseUnits(balance.spendableBase, balance.decimals)} ${symbol}` : null,
    spendableBase: balance?.spendableBase ?? null,
    decimals: balance?.decimals ?? null,
    symbol,
    busy: lease.leasing,
    refusal: lease.view?.kind === "refused" ? lease.view.diagnosis : null,
    /** The grant: a fresh lease request, which funds a leased seat that has not been funded yet. */
    request: () => lease.lease(),
  };
}

/**
 * Fires the reference's credit moment (`CreditWelcome`) once a seat's grant has landed and its cash has been read:
 * `announceCredit` keeps the first-time guard per address, so this says it once per seat and never again.
 */
export function useSeatCreditAnnouncer(): void {
  const { address } = useWalletSession();
  const credit = useSeatCredit();
  const said = useRef<string | null>(null);
  useEffect(() => {
    if (!address || credit.status !== "funded" || credit.spendableBase === null || credit.spendableBase <= 0n || credit.decimals === null) return;
    if (said.current === address) return;
    said.current = address;
    announceCredit(address, formatBaseUnits(credit.spendableBase, credit.decimals), credit.symbol);
  }, [address, credit.status, credit.spendableBase, credit.decimals, credit.symbol]);
}
