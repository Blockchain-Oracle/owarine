/**
 * The desk runner's environment (S21 C4, plan §8; Canton C8f), read once at boot. The live desk's operator is the
 * agent-runner party (K-087: `AGENT_RUNNER_PARTY` or the parties file), acting through the process's ledger client; the
 * venue's ladders and firm quotes come from the ops process itself when the venue runs here, else from
 * `OPS_INTERNAL_URL` (signed with `OPS_INTERNAL_SECRET`; `/ladders/latest` is public). Practice desks need nothing.
 */
import type { DeskCluster } from "@agari/db";
import { roleParty } from "../../runtime/keys";

export interface DeskRunnerEnv {
  /** The operator party (the agent-runner role); null means live desks are read and recorded, never traded. */
  operatorParty: string | null;
  /** Reference-only (the Solana RPC); unused on Canton. */
  rpcUrl: string;
  /** Ops' internal URL and secret, for a runner outside the venue's process (ladders, firm quotes). */
  opsUrl: string | undefined;
  opsSecret: string | undefined;
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
    operatorParty: roleParty("agent-runner", env),
    rpcUrl: deskRpcUrl(env),
    opsUrl: env.OPS_INTERNAL_URL?.trim() || undefined,
    opsSecret: env.OPS_INTERNAL_SECRET?.trim() || undefined,
    cluster: clusterOf(env),
    intervalMs: intEnv(env, "DESK_INTERVAL_MS", DEFAULT_INTERVAL_MS, 5_000),
    maxModelCallsPerHour: intEnv(env, "DESK_MAX_MODEL_CALLS_PER_HOUR", DEFAULT_MAX_CALLS_PER_HOUR, 1),
    modelTimeoutMs: intEnv(env, "DESK_MODEL_TIMEOUT_MS", DEFAULT_MODEL_TIMEOUT_MS, 1_000),
    aiModel: env.DESK_AI_MODEL?.trim() || undefined,
    jupiterApiKey: env.JUPITER_API_KEY?.trim() || undefined,
    dryRun: !(env.DRY_RUN === "0" || env.DRY_RUN === "false"),
  };
}
