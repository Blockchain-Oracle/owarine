import type { DeskMode } from "@agari/core/desk";
import type { Address } from "@agari/core/types";
import { readSealsOf, type DeskRpc, type DeskState, type SealedAction } from "@agari/markets/desk";
import { seatServer } from "@/lib/ledger.server";
import { deskStore } from "./desk.server";
import type { ChainStateWire } from "./protocol";

/**
 * The server's own ledger reads for the desk routes (C8f, K-090): a live desk's `DeskMandate` beside the index's rows,
 * and the seals an update carries. Everything is read as the venue, read-only; a seat address becomes its party
 * through the lease table. A deployment without the seat tier answers `chain: null, chainError` and every surface says
 * the ledger was not read, never a guessed figure.
 */
const CHAIN_NOT_CONFIGURED = "live desk reads are not configured on this deployment";

/** The venue's ledger reader, resolving a seat address to its leased party. */
export function mainnetRpc(): DeskRpc | null {
  const state = seatServer();
  if (!state.ok) return null;
  const { server } = state;
  return server.desk.rpc(async (address) => (await server.store.byAddress(address))?.party ?? null);
}

/** The venue's desk operator every desk is opened with: the agent-runner party (K-087), or null when this deployment has none. */
export function operatorAddress(): string | null {
  const state = seatServer();
  return state.ok ? state.server.parties.agentRunner : null;
}

/** The index's own mode for the seat's desk (ask first or on its own); the ledger only knows live or shadow. */
export async function indexModeOf(address: string): Promise<DeskMode | null> {
  const store = deskStore();
  if (!store) return null;
  const desk = await store.getDeskByOwner("mainnet", address).catch(() => null);
  return desk?.mode === "ask_first" || desk?.mode === "on_its_own" ? desk.mode : null;
}

export function toChainWire(s: DeskState): ChainStateWire {
  return {
    address: s.address, operator: s.operator, seq: s.seq.toString(), head: s.head, perActionCapE6: s.perActionCapE6.toString(), dailyCapE6: s.dailyCapE6.toString(),
    spentInWindowE6: s.spentInWindowE6.toString(), remainingDailyCapE6: s.remainingDailyCapE6.toString(), maxPremiumBps: s.maxPremiumBps, mode: s.mode, paused: s.paused,
    usdcRaw: s.usdc.raw.toString(), tokens: s.tokens.map((t) => ({ symbol: t.symbol, mint: t.mint, raw: t.raw.toString(), enabled: t.enabled, frozen: t.frozen, exists: t.exists })), slot: s.slot.toString(),
  };
}

/**
 * A desk's ledger state by its address (the index row's), or by its owner's seat when the row has none yet. Either way
 * only under the owner's CURRENT lease (C4d, K-210): the mandate must belong to the party that owner leases now, so an
 * earlier visitor's row never shows the live desk of the party's next visitor.
 */
export async function readChain(owner: Address, _nowSec: number, address?: string | null): Promise<{ state: ChainStateWire | null; error: string | null }> {
  const state = seatServer();
  if (!state.ok) return { state: null, error: CHAIN_NOT_CONFIGURED };
  const { server } = state;
  try {
    const mode = await indexModeOf(owner);
    const lease = await server.store.byAddress(owner);
    let s: DeskState | null = null;
    if (address) s = await server.desk.leasedState({ party: lease?.party ?? null, address }, mode);
    else s = lease ? await server.desk.state(lease.party, mode) : null;
    return { state: s ? toChainWire(s) : null, error: null };
  } catch (error) {
    return { state: null, error: `the ledger could not be read (${error instanceof Error ? error.name : "unknown"})` };
  }
}

/** True when the owner's leased seat has a live desk at exactly this address naming this operator (the attach check). */
export async function chainMatches(owner: Address, address: string, operator: string, _nowSec: number): Promise<boolean | null> {
  const state = seatServer();
  if (!state.ok) return null;
  try {
    const lease = await state.server.store.byAddress(owner);
    if (!lease) return false;
    const s = await state.server.desk.state(lease.party);
    return s !== null && (s.address as string) === address && s.operator === operator;
  } catch {
    return null;
  }
}

export async function sealsOf(signature: string): Promise<SealedAction[] | null> {
  const rpc = mainnetRpc();
  if (!rpc) return null;
  try {
    return await readSealsOf(rpc, signature as never);
  } catch {
    return null;
  }
}
