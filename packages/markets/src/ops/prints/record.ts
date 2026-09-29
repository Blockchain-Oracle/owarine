/**
 * Recording prints into slots (C1 stub). The reference sent one agari-events instruction per slot; on Canton each
 * oracle party posts one `PriceQuote` command per boundary covering all symbols (C3). Nothing is sent in C1: every
 * record answers `failed` with the not-live reason, which the relay logs and retries honestly.
 */
import type { KeyPairSigner } from "../../deploy/client";
import type { RedStonePackage } from "../../prices/redstone";
import { cantonNotLive } from "../../stub/not-deployed";
import type { OpsClient } from "../client";
import { opsNotLive } from "../shapes";
import type { PrintSlot } from "./slots";

export type SlotStatus = "recorded" | "already" | "early" | "late" | "failed";

export interface SlotOutcome {
  slot: PrintSlot;
  status: SlotStatus;
  signature?: string;
  code?: number | null;
  error?: string;
}

/** The not-live outcome every record gives in C1. */
export const notLiveOutcome = (slot: PrintSlot): SlotOutcome => ({ slot, status: "failed", code: null, error: cantonNotLive("ops/prints") });

export function recordRedstoneSlot(_client: OpsClient, slot: PrintSlot, _packages: RedStonePackage[]): Promise<SlotOutcome> {
  return Promise.resolve(notLiveOutcome(slot));
}

export type AttestedSlotInput = { attestor: KeyPairSigner; clusterTag: number; priceE8: bigint; fetchedAtSec: number };

export function recordAttestedSlot(_client: OpsClient, slot: PrintSlot, _input: AttestedSlotInput): Promise<SlotOutcome> {
  return Promise.resolve(notLiveOutcome(slot));
}

export type PythBoundaryInput = {
  client: OpsClient;
  rpcUrl: string;
  payerSecret: Uint8Array;
  slots: PrintSlot[];
  updatesBase64: string[];
  concurrency?: number;
};

export type PythBoundaryResult = { outcomes: SlotOutcome[]; posted: string[]; postSignatures: string[]; closeSignatures: string[]; closeError?: string };

/** Runs `run` over `items`, `size` at a time. Pure. */
export async function inBatches<T, R>(items: T[], size: number, run: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(run))));
  return out;
}

/** Nothing is posted on Canton (no Pyth receiver): every slot answers the not-live outcome. */
export async function recordPythBoundary(input: PythBoundaryInput): Promise<PythBoundaryResult> {
  return { outcomes: input.slots.map(notLiveOutcome), posted: [], postSignatures: [], closeSignatures: [] };
}

/** The network tag attested messages bind; read from the venue in C3. */
export async function readClusterTag(_client: OpsClient): Promise<number> {
  throw opsNotLive("ops/prints");
}
