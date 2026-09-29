import { CLUSTER_ID, DEFAULT_CLUSTER } from "@agari/core/constants";
import { encodeBase58, toAddress, type Address, type Hash32 } from "@agari/core/types";

/**
 * The desk's own key, server-side only. On Canton the desk's writes are the venue's (C8); until then the client keeps
 * its identity and its per-slot lock, and reports that there is no desk contract, so every route answers not-live.
 */
export interface DeskClient {
  readonly address: Address;
  /** The numeric network id product types still bind (D-012). */
  readonly chainId: number;
  /** The desk's contract on the ledger, or null while there is none (always, until C8). */
  contract(): Promise<Address | null>;
  withSlotLock<T>(slotId: Hash32, task: () => Promise<T>): Promise<T>;
}

export interface DeskClientConfig {
  /** The desk role's 64-byte key (32-byte seed ‖ public key, `PRIVATE_DESK_PRIVATE_KEY`, parsed with `parseSecretKey`). */
  secretKey: Uint8Array;
  /** Kept for the callers' config shape; the Canton desk reaches the ledger through the venue (C8). */
  rpcUrl: string;
  rpcSubscriptionsUrl: string;
}

export async function createDeskClient({ secretKey }: DeskClientConfig): Promise<DeskClient> {
  if (secretKey.length !== 64) throw new Error("expected a 64-byte desk key (seed ‖ public key)");
  const locks = new Map<string, Promise<unknown>>();
  return {
    address: toAddress(encodeBase58(secretKey.subarray(32))),
    chainId: CLUSTER_ID[DEFAULT_CLUSTER],
    async contract() {
      return null;
    },
    withSlotLock<T>(slotId: Hash32, task: () => Promise<T>): Promise<T> {
      const previous = locks.get(slotId) ?? Promise.resolve();
      const next = previous.then(task, task);
      locks.set(slotId, next.then(() => undefined, () => undefined));
      return next;
    },
  };
}
