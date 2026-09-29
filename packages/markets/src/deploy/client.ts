/**
 * The operator client for deploy-time scripts and the venue actors (C1 stub). The reference built a Kit client whose
 * fee payer was the role key; on Canton a role acts as its own party through the venue's ledger session (C2x/C3),
 * and the user pays no network fee. This client is a descriptor naming the role key's address; every ledger call made
 * with it refuses as not live. Server-only.
 */
import type { Address } from "@agari/core/types";
import { keypairAddress } from "../sessions/keypair";

export type DeployClientConfig = {
  /** The ledger endpoint (a secret when it carries credentials: never log it). */
  rpcUrl: string;
  rpcSubscriptionsUrl: string;
  /** The role's 64-byte key (seed ‖ public key); its public half is the role's address. */
  payerSecret: Uint8Array;
  rpcLane?: "priority" | "default";
  skipPreflight?: boolean;
};

/** A role's signing identity: its key's address. Nothing signs a ledger command with it in C1. */
export type KeyPairSigner = { readonly address: Address };

export async function keypairSigner(secret: Uint8Array): Promise<KeyPairSigner> {
  if (secret.length !== 64) throw new Error(`expected a 64-byte keypair, got ${secret.length} bytes`);
  return { address: keypairAddress(secret) };
}

/** A role client: who acts, and where. `payer` keeps the reference's name for the acting role. */
export interface DeployClient {
  readonly payer: KeyPairSigner;
  readonly endpoint: string;
}

export async function createDeployClient(config: DeployClientConfig): Promise<DeployClient> {
  return { payer: await keypairSigner(config.payerSecret), endpoint: config.rpcUrl };
}
