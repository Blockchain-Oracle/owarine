import type { PhaseListener, TxOutcome, VaultIntent } from "@agari/core/ports";
import { formatBaseUnits } from "@agari/core/units";
import { refusedFor } from "../stub/product";
import { VAULT_NOT_LIVE } from "./deployment";

/** The journal's one line (Masayume `summarizeVault`), written for the person who reads it back after a timeout. */
export function summarizeVault(intent: VaultIntent, decimals: number): string {
  const amount = (base: bigint) => formatBaseUnits(base, decimals);
  switch (intent.kind) {
    case "vault-deposit":
      return `deposit ${amount(intent.amountBase)} into the Trading Balance`;
    case "vault-withdraw":
      return `withdraw ${amount(intent.amountBase)} from the Trading Balance`;
    case "vault-move-private":
      return `move ${amount(intent.amountBase)} to the private balance`;
    case "vault-withdraw-private":
      return `withdraw ${amount(intent.amountBase)} from the private balance`;
    case "vault-grant":
      return `grant ${intent.terms.kind} to ${intent.terms.actor} with ${amount(intent.terms.budgetBase)}`;
    case "vault-deposit-and-grant":
      return `deposit ${amount(intent.amountBase)} and grant ${intent.terms.kind} to ${intent.terms.actor}`;
    case "vault-fund-grant":
      return `add ${amount(intent.amountBase)} to grant #${intent.grantId}`;
    case "vault-revoke":
      return `revoke grant #${intent.grantId}`;
    case "vault-key-top-up":
      return `top up the session key ${intent.key} with ${intent.lamports} lamports`;
    case "vault-crank-settle":
      return `settle ${intent.marketId} into ${intent.owner}'s Trading Balance`;
    case "vault-sweep":
      return "sweep the vault's seat credit";
  }
}

/** `submitTx` for every `vault-*` intent refuses before anything is journaled or signed until `VenueCash` lands (C7a). */
export async function submitVaultTx(_ctx: unknown, _intent: VaultIntent, _onPhase?: PhaseListener): Promise<TxOutcome> {
  return refusedFor(VAULT_NOT_LIVE);
}
