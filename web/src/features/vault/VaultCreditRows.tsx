"use client";

import { formatCadence } from "@agari/core/copy";
import { isOk } from "@agari/core/schemas";
import { useVaultSnapshot, useWalletHistory } from "@agari/markets/react";
import { useWalletSession } from "@/lib/wallet-session";
import { VAULT } from "./copy";
import { useVaultWrite } from "./useVaultWrite";
import "./vault.css";

/**
 * The Trading Balance's side of /claims. A Vault credit is a withdrawal, not a redeem (AD-1), so
 * nothing here joins the wallet's claim-all: settled Windows the vault still holds get their own
 * permissionless crank.
 *
 * No credit line (C4f, K-325): on Canton the seat's own `VenueCash` is the Trading Balance (K-087).
 * A settled leg pays the seat directly and a withdrawal has nowhere to go (`vault-withdraw` is
 * refused as the same cash), so the vault read's available cash is the seat's money already counted
 * as Demo credits — never a credit waiting here. C11b saw "998.29 credits sits in your Trading
 * Balance" under To collect beside a plate that read Trading Balance 0.00.
 */
export function VaultCreditRows({ className }: { className?: string }) {
  const { address } = useWalletSession();
  const snapshot = useVaultSnapshot(address);
  const history = useWalletHistory(address);
  const { state, run } = useVaultWrite();

  const vault = snapshot && isOk(snapshot) ? snapshot.value : null;
  if (!address || !vault) return null;
  const pending = history && isOk(history) ? history.value.rounds.filter((round) => round.source === "vault" && round.claim === "to-collect") : [];
  if (pending.length === 0) return null;

  return (
    <section className={className} aria-label={VAULT.claims.title}>
      <span className="vault-eyebrow">{VAULT.claims.title}</span>
      <ul className="mt-2 flex flex-col gap-2">
        {pending.length > 0 && <li className="type-caption text-ink-muted">{VAULT.claims.waiting(pending.length)}</li>}
        {pending.map((round) => (
          <li key={round.marketId} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-md border border-hairline bg-surface-1 p-3">
            <span className="type-caption text-ink-secondary">
              <span className="text-ink">
                {round.asset} · {formatCadence(round.intervalSec)}
              </span>{" "}
              · {VAULT.rounds.via} · {VAULT.rounds.crankNote}
            </span>
            <button
              type="button"
              onClick={() => void run({ kind: "vault-crank-settle", owner: address, marketId: round.marketId }, VAULT.rounds.cranked)}
              disabled={state.busy !== null}
              className="vault-btn vault-btn-outline"
              data-cursor="hover"
            >
              {state.busy === "vault-crank-settle" ? VAULT.rounds.cranking : VAULT.rounds.crank}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
