import type { Cluster } from "@agari/core/constants";
import type { AttributionHook, IntentJournal, StopGate } from "@agari/core/ports";
import type { Address } from "@agari/core/types";
import type { MarketsEnv } from "../env";
import type { WalletSession } from "../react/wallet-session";
import { getVaultDeployment } from "../runtime/read-runtime";
import { createSubmitter, type MarketsSubmitter } from "../submitter/create";
import type { WriteRpc } from "../submitter/write-rpc";
import type { SponsorCosigner, VaultContracts } from "../vault";
import type { AuthorityKind } from "./authority";
import { signerFromSecretKey } from "./ed25519";
import { createNonceQueue } from "./nonce-queue";
import type { SeatSigner } from "./seat-signer";

/**
 * Exactly one of these — a session signs one way, decided once, at construction:
 * - `wallet`: the person's seat as the web or the phone hands it over (`WalletSession`, D-014);
 * - `seat`: a seat signer the caller already holds;
 * - `secretKey`: a server role's or a drive's 64-byte keypair (`seed ‖ public key`), until C3 moves ops onto role parties.
 */
export type SessionSigner = { wallet: WalletSession } | { seat: SeatSigner } | { secretKey: Uint8Array };

export interface SubmitterSessionConfig {
  env: MarketsEnv;
  authority: AuthorityKind;
  signer: SessionSigner;
  /** Off-ledger durability for this actor's intents. Defaults to an in-memory journal. */
  journal?: IntentJournal;
  stopGate?: StopGate;
  attribution?: AttributionHook;
  nowMs?: () => number;
  /** A server or script session's own ledger access; a browser session goes through our route handlers. */
  rpc?: WriteRpc;
  /** Kept for the config's shape; Canton has no fee payer to co-sign. */
  sponsor?: SponsorCosigner;
}

export interface SubmitterSession {
  readonly authority: AuthorityKind;
  readonly address: Address;
  readonly cluster: Cluster;
  /** The numeric network id product intents still bind (D-012). */
  readonly chainId: number;
  readonly submitter: MarketsSubmitter;
  /** Who signs product writes, and against which deployment. */
  readonly contracts: VaultContracts;
  readonly disposed: boolean;
  /** A disposed session can never sign again. */
  dispose(): Promise<void>;
}

export class SessionDisposedError extends Error {
  constructor(authority: AuthorityKind) {
    super(`the ${authority} session has been disposed; construct a new one to sign again`);
    this.name = "SessionDisposedError";
  }
}

async function seatOf(signer: SessionSigner): Promise<{ address: Address; seat: SeatSigner | undefined }> {
  if ("wallet" in signer) return { address: signer.wallet.address, seat: signer.wallet.signer };
  if ("seat" in signer) return { address: signer.seat.address, seat: signer.seat };
  const seat = await signerFromSecretKey(signer.secretKey);
  return { address: seat.address, seat };
}

/**
 * One seat, one network, one authority, one writer.
 *
 * The signer is fixed at construction and never swapped, so an in-flight write can't find a different authority than
 * the one it started with. Disposal is required on disconnect, seat release or lease loss.
 */
export async function createSubmitterSession(config: SubmitterSessionConfig): Promise<SubmitterSession> {
  const { env, authority } = config;
  const { address, seat } = await seatOf(config.signer);

  let disposed = false;
  const enqueue = createNonceQueue();
  const guardedEnqueue = <T>(task: () => Promise<T>): Promise<T> =>
    enqueue(() => (disposed ? Promise.reject(new SessionDisposedError(authority)) : task()));

  const contracts: VaultContracts = { signer: address, deployment: getVaultDeployment() };
  const submitter = createSubmitter({
    wallet: address,
    ...(seat ? { signer: seat } : {}),
    enqueue: guardedEnqueue,
    ...(config.rpc ? { rpc: config.rpc } : {}),
    ...(config.journal ? { journal: config.journal } : {}),
    ...(config.stopGate ? { stopGate: config.stopGate } : {}),
    ...(config.attribution ? { attribution: config.attribution } : {}),
    ...(config.nowMs ? { nowMs: config.nowMs } : {}),
    ...(config.sponsor ? { sponsor: config.sponsor } : {}),
  });

  return {
    authority,
    address,
    cluster: env.cluster,
    chainId: env.chainId,
    submitter,
    contracts,
    get disposed() {
      return disposed;
    },
    async dispose() {
      disposed = true;
    },
  };
}
