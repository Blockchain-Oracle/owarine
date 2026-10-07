/** Prints, settlement and redemption for the drives (C1 stub); every step refuses as not live. */
import type { Address } from "@owarine/core/types";
import type { KeyPairSigner } from "../client";
import { deployNotLive, type SendContext } from "../send";
import type { OpenedWindow } from "./window";

/** `which` on the wire: 0 open, 1 close, 2 check open, 3 check close. */
export const WHICH = { open: 0, close: 1, checkOpen: 2, checkClose: 3 } as const;

export type AttestedInput = {
  attestor: KeyPairSigner;
  clusterTag: number;
  which: number;
  boundaryTs: number;
  price: bigint;
  feedId: Uint8Array;
  barLenSec: number;
  fetchedAtTs: number;
};

export async function recordPythPrint(_ctx: SendContext, _w: OpenedWindow, _which: number, _priceUpdate: Address): Promise<string> {
  throw deployNotLive();
}
export async function recordRedstonePrint(_ctx: SendContext, _w: OpenedWindow, _which: number, _payload: Uint8Array, _signers: number): Promise<string> {
  throw deployNotLive();
}
export async function recordAttestedPrint(_ctx: SendContext, _w: OpenedWindow, _a: AttestedInput): Promise<string> {
  throw deployNotLive();
}
export async function settleWindow(_ctx: SendContext, _w: OpenedWindow): Promise<string> {
  throw deployNotLive();
}
export async function voidExpired(_ctx: SendContext, _w: OpenedWindow): Promise<string> {
  throw deployNotLive();
}
export async function sweepExpired(_ctx: SendContext, _w: OpenedWindow, _max = 32): Promise<string> {
  throw deployNotLive();
}
export async function redeem(_ctx: SendContext, _w: OpenedWindow, _user: KeyPairSigner, _userToken: Address, _seatIdx: number): Promise<string> {
  throw deployNotLive();
}
export async function recycleBooks(_ctx: SendContext, _series: Address, _books: Address[]): Promise<number> {
  throw deployNotLive();
}

export type TransactionProfile = { computeUnits: number; bytes: number; error: string | null; logs: string[] };

/** The reference measured compute units on Surfpool; there is no compute budget on Canton. Not live. */
export async function profileOnSurfpool(_ctx: SendContext, _rpcUrl: string, _instructions: unknown[]): Promise<TransactionProfile> {
  throw deployNotLive();
}
