/**
 * The desk runner's environment (S21 C4, plan §8), read once at boot. On Canton the live desk is a Canton desk whose
 * live leg is gated on C7b (plan "Adapted rows"), so there is no chain endpoint to default to: `DESK_RPC_URL` is kept
 * for the reader's shape and the C1 desk reader refuses with its not-live reason. Practice desks need nothing.
 */
import type { DeskCluster } from "@agari/db";
import { roleSecret } from "../../runtime/keys";

export interface DeskRunnerEnv {
  /** `desk-runner`: the operator role's 64-byte keypair; null means nothing is sent. */
  operatorSecret: Uint8Array | null;
  /** `price-attestor`: signs the venue reference the program measures against; null means references are never refreshed here. */
  attestorSecret: Uint8Array | null;
  /** May carry a provider key. Never log it. */
  rpcUrl: string;
  cluster: DeskCluster;
  intervalMs: number;
  maxModelCallsPerHour: number;
  modelTimeoutMs: number;
  aiModel: string | undefined;
  jupiterApiKey: string | undefined;
  dryRun: boolean;
  /**
   * `DESK_MODEL_STUB=ACT_NOW|WAIT|DECLINE` replaces the model's timing answer with a fixed one, honoured ONLY on
   * localnet (the C6 fork rehearsal) and written into the record as an override. Never read on any other cluster.
   */
  modelStub?: DeskModelStub;
}

export type DeskModelStub = "ACT_NOW" | "WAIT" | "DECLINE";
const MODEL_STUBS: readonly DeskModelStub[] = ["ACT_NOW", "WAIT", "DECLINE"];

const DEFAULT_INTERVAL_MS = 60_000;
const DEFAULT_MAX_CALLS_PER_HOUR = 12;
const DEFAULT_MODEL_TIMEOUT_MS = 45_000;

function intEnv(env: NodeJS.ProcessEnv, name: string, fallback: number, min: number): number {
  const value = Number(env[name]);
  return Number.isFinite(value) && value >= min ? Math.floor(value) : fallback;
}

/** `DESK_CLUSTER=localnet` runs the desk against LocalNet (the rehearsal); Canton MainNet otherwise. */
function clusterOf(env: NodeJS.ProcessEnv): DeskCluster {
  return env.DESK_CLUSTER === "localnet" ? "localnet" : env.DESK_CLUSTER === "devnet" ? "devnet" : "mainnet";
}

export function deskRpcUrl(env: NodeJS.ProcessEnv = process.env): string {
  return env.DESK_RPC_URL ?? "";
}

export function readDeskRunnerEnv(env: NodeJS.ProcessEnv = process.env): DeskRunnerEnv {
  const stub = env.DESK_MODEL_STUB?.trim();
  const modelStub = clusterOf(env) === "localnet" && stub && (MODEL_STUBS as readonly string[]).includes(stub) ? (stub as DeskModelStub) : undefined;
  return {
    ...(modelStub ? { modelStub } : {}),
    operatorSecret: roleSecret("desk-runner", env),
    attestorSecret: roleSecret("price-attestor", env),
    rpcUrl: deskRpcUrl(env),
    cluster: clusterOf(env),
    intervalMs: intEnv(env, "DESK_INTERVAL_MS", DEFAULT_INTERVAL_MS, 5_000),
    maxModelCallsPerHour: intEnv(env, "DESK_MAX_MODEL_CALLS_PER_HOUR", DEFAULT_MAX_CALLS_PER_HOUR, 1),
    modelTimeoutMs: intEnv(env, "DESK_MODEL_TIMEOUT_MS", DEFAULT_MODEL_TIMEOUT_MS, 1_000),
    aiModel: env.DESK_AI_MODEL?.trim() || undefined,
    jupiterApiKey: env.JUPITER_API_KEY?.trim() || undefined,
    dryRun: !(env.DRY_RUN === "0" || env.DRY_RUN === "false"),
  };
}
