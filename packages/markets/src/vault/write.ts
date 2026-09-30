import type { PhaseListener, TxOutcome, VaultIntent } from "@agari/core/ports";
import { formatBaseUnits } from "@agari/core/units";
import { refusedFor } from "../stub/product";
import { agentsVaultLane } from "../submitter/agents-lane";
import type { SeatLaneDeps } from "../submitter/seat-lane";
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
      return `top up the session key ${intent.key} (${intent.lamports} base units)`;
    case "vault-crank-settle":
      return `settle ${intent.marketId} into ${intent.owner}'s Trading Balance`;
    case "vault-sweep":
      return "sweep the vault's seat credit";
  }
}

const isLane = (ctx: unknown): ctx is SeatLaneDeps =>
  typeof ctx === "object" && ctx !== null && "journal" in ctx && "wallet" in ctx && "nowMs" in ctx && "stopGate" in ctx;

/**
 * `submitTx` for every `vault-*` intent (C8f): grants open, top up and revoke through the seat's journaled agents lane
 * (`agents-lane.ts`); a call without the seat's lane refuses before anything is journaled or sent.
 */
export async function submitVaultTx(ctx: unknown, intent: VaultIntent, onPhase?: PhaseListener): Promise<TxOutcome> {
  if (!isLane(ctx)) return refusedFor(VAULT_NOT_LIVE);
  return agentsVaultLane(ctx, intent, onPhase);
}
