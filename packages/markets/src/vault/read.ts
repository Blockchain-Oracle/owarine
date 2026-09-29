/**
 * The trading balance reads (C8f): the seat's cash and its live `AgentGrant`s, one per kind, through our own route
 * (`/api/ledger/agents/vault`, read AS the leased party). A server or ops process that reads the ledger itself installs
 * its own reader (`installVaultReader`), so the same calls answer there without a seat. Holdings "in the vault" are the
 * seat's own legs on Canton (a grant's agent buys them in the owner's name), which the seat's positions already show;
 * the per-Window vault slot therefore holds nothing apart from them.
 */
import { err, ok, type Reading } from "@agari/core/schemas";
import type { Address, OnchainSnapshot } from "@agari/core/types";
import type { VaultGrant, VaultHoldings, VaultSnapshot } from "@agari/core/vault";
import { ReadingError } from "../errors/reading-error";
import { agentsReceiptReplyWire, grantReplyWire, vaultReplyWire } from "../provider/agents-wire";
import { nowMs } from "../provider/clock";
import { ledgerRequest, registeredSeatAddress } from "../provider/ledger-api";
import { absent } from "../stub/product";
import { goneGrantView } from "../ops/agents/views";
import { resolveVaultDeployment } from "./deployment";

export { loadVaultDeployment, resolveVaultDeployment } from "./deployment";
export { recoverVaultExecution, type RecoveredVaultExecution, type VaultExecutionEvidence } from "./recovery";


/** A grant that is not one: slot 0 on every holding. */
const NO_GRANT = 0n;

/** What a process with its own ledger access reads instead of the seat route (the web server, ops). */
export interface VaultReader {
  snapshot(owner: Address): Promise<Reading<VaultSnapshot | null>>;
  grant(grantId: bigint): Promise<VaultGrant>;
  /** The owner's own legs on one Window (an agent's "already in this Window" check). */
  holdings?(owner: Address, onchain: OnchainSnapshot): Promise<Reading<VaultHoldings>>;
}

let reader: VaultReader | null = null;
/** Installs (or with null removes) the process's own vault reader. */
export function installVaultReader(next: VaultReader | null): void {
  reader = next;
}

/** The balance and the live grant per kind, for the seat this client holds. */
export async function getVaultSnapshot(wallet: Address): Promise<Reading<VaultSnapshot | null>> {
  if (reader) return reader.snapshot(wallet);
  const r = await ledgerRequest("/agents/vault", { method: "GET", wire: vaultReplyWire });
  if (!r.ok) return r.diagnosis.kind === "not-deployed" ? ok(null, nowMs()) : err(r.diagnosis);
  const deployment = resolveVaultDeployment();
  if (!deployment) return ok(null, nowMs());
  const v = r.value;
  return ok({ deployment, account: v.account, grants: v.grants as VaultSnapshot["grants"], decimals: v.decimals }, nowMs());
}

/**
 * What the trading balance holds on one Window. For a seat's own screens: nothing apart from its legs, which its
 * positions already show (see the module note). An agent's process reads the owner's legs themselves.
 */
export const getVaultHoldings = (wallet: Address, onchain: OnchainSnapshot): Promise<Reading<VaultHoldings>> =>
  reader?.holdings ? reader.holdings(wallet, onchain) : absent({ marketId: onchain.marketId, upRaw: 0n, downRaw: 0n, upGrantId: NO_GRANT, downGrantId: NO_GRANT });

/** One of the seat's grants by id: live, or revoked once it has left the ledger (its only way off). */
export async function getVaultGrant(grantId: bigint): Promise<VaultGrant> {
  if (reader) return reader.grant(grantId);
  const r = await ledgerRequest(`/agents/vault/grants/${grantId}`, { method: "GET", wire: grantReplyWire });
  if (!r.ok) throw new ReadingError(r.diagnosis);
  if (r.value.grant) return r.value.grant as VaultGrant;
  return goneGrantView(grantId, registeredSeatAddress() ?? "", "");
}

/**
 * A landed transaction of the seat's (C8f): `success` with the cash it paid the seat (a revoke returns the grant's
 * whole budget), or null when it cannot be read. Canton leaves no transaction for a rejected command, so a landed one
 * never "reverted".
 */
export async function readSeatReceipt(updateId: string): Promise<{ status: "success"; paidBase: bigint } | null> {
  const r = await ledgerRequest(`/agents/receipt/${updateId}`, { method: "GET", wire: agentsReceiptReplyWire });
  return r.ok ? r.value.receipt : null;
}
