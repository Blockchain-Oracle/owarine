import type { Address, Signature } from "@agari/core/types";
import { addressUrl, txUrl } from "@agari/core/urls";
import { webEnv } from "@/lib/env";

/**
 * The proofs on `/demo` — real ledger actions and real parties, nothing else.
 *
 * The list is empty on purpose (Canton port, C4c): the rows that were here were Solana devnet signatures from the
 * app this one was ported from, and none of them happened on Canton. Rows return, one per acceptance-ledger ✅ row, when
 * the Canton DevNet drive records them; until then the page says so (`DEMO.sections.verify.pending`) and every
 * settlement on this venue opens on /proof instead.
 */
export const PROOF_WALLET: Address | null = null;
export const PROOFS_READ_ON: string | null = null;

export type ProofOperation = "deploy" | "listing" | "faucet" | "order" | "fill" | "print" | "settlement" | "payout" | "void" | "basket" | "desk";

/** Where the transaction landed: devnet rows open on the explorer; a fork row ran on a local fork of mainnet. */
export type ProofNetwork = "devnet" | "fork";

export interface TxProof {
  hash: Signature;
  operation: ProofOperation;
  status: "confirmed";
  network: ProofNetwork;
  detail: string;
}

export const TX_PROOFS: readonly TxProof[] = [];

const OPERATION_LABEL: Record<ProofOperation, string> = {
  deploy: "Program deployed",
  listing: "Series listed",
  faucet: "Test funds minted",
  order: "Order resting",
  fill: "Pair minted on a fill",
  print: "Signed print recorded",
  settlement: "Window settled",
  payout: "Winnings redeemed",
  void: "Window voided",
  basket: "Basket Window settled",
  desk: "Desk action",
};

export function txProofLabel(proof: TxProof): string {
  return OPERATION_LABEL[proof.operation];
}

/** Null for a fork row: there is no explorer page for a local fork of mainnet, so the page prints the signature instead. */
export function txProofHref(proof: TxProof): string | null {
  return proof.network === "fork" ? null : txUrl(proof.hash, webEnv.markets.cluster);
}

/** The first confirmed proof of an operation; the depth cards cite one each, or none while the list is empty. */
export function txProof(operation: ProofOperation): TxProof | null {
  return TX_PROOFS.find((candidate) => candidate.operation === operation) ?? null;
}

export type ContractKey = "events" | "vault" | "venue";

export interface ContractProof {
  key: ContractKey;
  label: string;
  /** Null when this build has no address configured for it; the row is then left out rather than invented. */
  address: Address | null;
}

// On Canton the engine is a Daml package, which has no base58 address to link: the events and vault rows are left out
// (never invented) until C10 points them at the package's proof page.
const CONTRACTS: Record<ContractKey, { label: string; address: Address | undefined }> = {
  events: { label: "agari-events (the book, the Windows, the prints, settlement)", address: undefined },
  vault: { label: "agari-vault (the Trading Balance and its grants)", address: undefined },
  venue: { label: "Venue config (signers, thresholds and roles every Window reads)", address: webEnv.markets.venueId },
};

export const CONTRACT_PROOFS: readonly ContractProof[] = (Object.keys(CONTRACTS) as ContractKey[]).map((key) => ({
  key,
  label: CONTRACTS[key].label,
  address: CONTRACTS[key].address ?? null,
}));

export function contractProofHref(proof: ContractProof): string | null {
  return proof.address === null ? null : addressUrl(proof.address, webEnv.markets.cluster);
}
