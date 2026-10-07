/**
 * The faucet's ledger side. The reference funded a wallet on Solana with a SOL transfer and a tUSDC mint; on Canton a
 * seat's demo cash is credited into `VenueCash` server-side (C4), and there is no SOL leg. Until then every chain step
 * refuses with a 503 `FaucetError` naming the stub, so the faucet reports itself unavailable instead of pretending.
 * The shape is kept for `web/src/features/funding/faucet-service.server.ts`. Server-only.
 */
import { FaucetError, SOL_FAUCET_POLICY, type AnyFaucetClaim, type FaucetClaimStatus } from "@owarine/core/faucet";
import type { Address } from "@owarine/core/types";
import { keypairAddress } from "../sessions/keypair";
import { cantonNotLive } from "../stub/not-deployed";

export interface FaucetKeys {
  /** The faucet role's key; its address is the funder the service names. */
  funder: Uint8Array;
  /** The demo-cash issuer's key; null leaves demo-cash claims unavailable. */
  mintAuthority: Uint8Array | null;
}
export interface PreparedFaucetTransaction { lastValidBlockHeight: number; feeLamports: string; rawTransaction: string; txHash: string }
export interface FaucetMint { address: Address; decimals: number; authority: Address }

const notLive = (): FaucetError => new FaucetError("not-live", cantonNotLive("faucet"), 503);

export function createFaucetChain(keys: FaucetKeys, _rpcUrl?: string) {
  return {
    address: keypairAddress(keys.funder) as Address,
    mintAuthority: keys.mintAuthority ? (keypairAddress(keys.mintAuthority) as Address) : null,
    cluster: SOL_FAUCET_POLICY.cluster,
    async balance(_wallet: string): Promise<bigint> {
      throw notLive();
    },
    async mint(): Promise<FaucetMint> {
      throw notLive();
    },
    async tokenBalance(_wallet: string): Promise<bigint | null> {
      throw notLive();
    },
    async prepare(_wallet: string, _amountLamports: bigint): Promise<PreparedFaucetTransaction> {
      throw notLive();
    },
    async prepareMint(_wallet: string, _amountBase: bigint): Promise<PreparedFaucetTransaction> {
      throw notLive();
    },
    async inspect(_claim: AnyFaucetClaim): Promise<FaucetClaimStatus> {
      throw notLive();
    },
    async broadcast(_claim: AnyFaucetClaim): Promise<void> {
      throw notLive();
    },
  };
}

export type FaucetChain = ReturnType<typeof createFaucetChain>;
