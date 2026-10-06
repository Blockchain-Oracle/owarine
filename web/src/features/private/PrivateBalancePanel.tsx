"use client";

import { isOk } from "@agari/core/schemas";
import { formatBaseUnits, parseDecimalToBaseUnits } from "@agari/core/units";
import { useBalanceSheet, usePrivateBudget, usePrivateDesk } from "@agari/markets/react";
import { useState } from "react";
import { Money } from "@/components/data";
import { ErrorState, LoadingState } from "@/components/states";
import { blockerLabel } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { useRegionRestricted } from "@/lib/region";
import { useWalletSession } from "@/lib/wallet-session";
import { RegionNote } from "../region/RegionNote";
import { useVenue } from "../markets/useVenue";
import { AmountField } from "../vault/AmountField";
import { deriveVaultBlocker } from "../vault/vault-blocker";
import "../vault/vault.css";
import { PRIVATE } from "./copy";
import { PrivateClaims } from "./PrivateClaims";
import { usePrivateCashout } from "./usePrivateCashout";
import { usePrivatePositions } from "./usePrivatePositions";
import { usePrivateWrites } from "./usePrivateWrites";

const DEFAULT_AMOUNT = "5";

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="vault-cell-label">{label}</span>
      <div className="vault-cell-value">{children}</div>
    </div>
  );
}

/**
 * The private balance behind the plate's Private row — the Trading Balance block's grammar (eyebrow, one
 * sentence, controls, cells), then the private calls. On Canton (C8d, L-39) the balance is the seat's private
 * bucket: Deposit moves demo credits in from the seat's balance, Withdraw moves all of it back, each one transaction
 * the seat and the venue sign together. There is no desk allowance to revoke: only the seat spends this balance.
 */
export function PrivateBalancePanel({ inline, className }: { inline?: boolean; className?: string }) {
  const session = useWalletSession();
  // The geofence (D-095): the deposit is held; withdraw and revoke stay reachable so no test funds are stranded.
  const regionHeld = useRegionRestricted();
  const { address } = session;
  const { boot } = useVenue();
  const symbol = boot && isOk(boot) ? boot.value.collateral.symbol : "credits";
  const deskReading = usePrivateDesk();
  const budgetReading = usePrivateBudget(address);
  const sheet = useBalanceSheet(address);
  const writes = usePrivateWrites();
  const positions = usePrivatePositions(address);
  const desk = deskReading && isOk(deskReading) ? deskReading.value : null;
  const decimals = desk?.decimals ?? 6;
  const cashout = usePrivateCashout(() => undefined, decimals, symbol);
  const [typed, setAmount] = useState<string | null>(null);
  const frame = cn("vault-panel", inline && "vault-panel-inline", className);

  if (!address) return null;
  if (deskReading === null) return <LoadingState shape="row" className={frame} />;
  if (!isOk(deskReading)) return <ErrorState diagnosis={deskReading.error} className={frame} />;
  if (!desk) {
    return (
      <div className={frame}>
        <p className="type-body text-ink">{PRIVATE.notDeployed.why}</p>
        <p className="mt-1 type-caption text-ink-muted">{PRIVATE.notDeployed.how}</p>
      </div>
    );
  }

  const budget = budgetReading && isOk(budgetReading) ? budgetReading.value : null;
  const walletSpendable = sheet && isOk(sheet) ? sheet.value.spendableBase : null;
  // Untouched, the default never asks for more than the wallet holds: a wallet with less starts at what it has.
  const amount = typed ?? (walletSpendable !== null && walletSpendable > 0n && (parseDecimalToBaseUnits(DEFAULT_AMOUNT, decimals) ?? 0n) > walletSpendable ? formatBaseUnits(walletSpendable, decimals, { minDp: 0 }).replace(/,/g, "") : DEFAULT_AMOUNT);
  const amountBase = parseDecimalToBaseUnits(amount, decimals) ?? 0n;
  const blocker = deriveVaultBlocker({ session, hasSigner: writes.hasSigner, busy: writes.state.busy !== null, gasShort: writes.state.gasShort });
  const blocked = blocker !== null;
  const busy = writes.state.busy;
  const depositDisabled = regionHeld || blocked || amountBase <= 0n || walletSpendable === null || walletSpendable < amountBase || budget === null;
  const withdrawDisabled = blocked || !budget || budget.balanceBase <= 0n;

  return (
    <div className={frame}>
      <div className="vault-head">
        <div>
          <span className="vault-eyebrow">{PRIVATE.panel.eyebrow}</span>
          <p className="vault-note">{PRIVATE.panel.note}</p>
        </div>
        <div className="flex flex-col gap-2">
          <div className="vault-controls">
            <AmountField value={amount} onChange={setAmount} decimals={decimals} symbol={symbol} maxBase={walletSpendable} label={PRIVATE.panel.amountLabel} />
            <div className="vault-buttons">
              <button
                type="button"
                onClick={() => budget && void writes.run({ kind: "private-deposit-and-allow", amountBase, allowanceBase: budget.balanceBase + amountBase }, PRIVATE.toasts.deposited)}
                disabled={depositDisabled}
                className="vault-btn vault-btn-primary"
                data-cursor="hover"
              >
                {busy === "private-deposit-and-allow" ? PRIVATE.panel.depositing : PRIVATE.panel.deposit}
              </button>
              <button type="button" onClick={() => budget && void writes.run({ kind: "private-withdraw", amountBase: budget.balanceBase }, PRIVATE.toasts.withdrawn)} disabled={withdrawDisabled} className="vault-btn vault-btn-outline" data-cursor="hover">
                {busy === "private-withdraw" ? PRIVATE.panel.withdrawing : PRIVATE.panel.withdraw}
              </button>
            </div>
          </div>
          {regionHeld ? (
            <RegionNote />
          ) : blocker ? (
            <span className="type-caption text-ink-secondary">{blockerLabel(blocker)}</span>
          ) : (
            <span className="type-caption text-ink-secondary">{PRIVATE.panel.allowanceNote}</span>
          )}
        </div>
      </div>

      <div className="vault-cells">
        <Cell label={PRIVATE.panel.cells.balance}>{budget ? <Money value={budget.balanceBase} decimals={decimals} /> : "—"}</Cell>
        <Cell label={PRIVATE.panel.cells.spendable}>{budget ? <Money value={budget.spendableBase} decimals={decimals} className={cn(budget.spendableBase > 0n && "vault-cell-value-live")} /> : "—"}</Cell>
        <Cell label={PRIVATE.panel.cells.inCalls}>{positions?.ok ? <Money value={positions.value.positions.filter((p) => p.status === "open").reduce((s, p) => s + BigInt(p.costBase), 0n)} decimals={decimals} /> : "—"}</Cell>
        <Cell label={PRIVATE.panel.cells.cap}>{`${formatBaseUnits(desk.params.maxStakeBase, decimals, { minDp: 0 })} ${symbol}`}</Cell>
      </div>
      <p className="vault-loading">{PRIVATE.panel.trust}</p>
      <p className="vault-loading">{PRIVATE.panel.correlation}</p>

      <div className="vault-grants">
        <PrivateClaims positions={positions?.ok ? positions.value.positions : null} decimals={decimals} symbol={symbol} onCashOut={(p) => void cashout.cashOut(p)} busySlot={cashout.busySlot} />
      </div>
    </div>
  );
}
