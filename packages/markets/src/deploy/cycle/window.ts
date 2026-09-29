/**
 * The drive's window cycle (C1 stub): open a window, fund a user, place orders; then record prints, settle and redeem.
 * On Canton these are `Series_OpenWindow`, demo-cash credits, `Quote_Accept`, `PriceQuote`, `Terms_Resolve` and
 * `SettleBatch` (C2x/C3). The order constants stay; every ledger step refuses as not live.
 */
import { encodeBase58, toAddress, type Address } from "@agari/core/types";
import type { KeyPairSigner } from "../client";
import { deployNotLive, type SendContext } from "../send";
import type { WindowAddresses } from "./accounts";
import type { Instruction } from "../../ops/shapes";

export type OpenedWindow = WindowAddresses & {
  book: Address;
  mint: Address;
  tradingStartSec: number;
  expirySec: number;
  policyVersion: number;
  signature: string;
};

export const KIND = { buyYes: 0, sellYes: 1, buyNo: 2, sellNo: 3 } as const;
export const ORDER_TYPE = { normal: 0, fok: 1, ioc: 2, postOnly: 3 } as const;
/** `seat_hint = u16::MAX`: the first empty seat, or the authority's own. */
export const ANY_SEAT = 0xffff;

/** A throwaway drive identity (never persisted): a fresh WebCrypto Ed25519 key's address. */
export async function newSigner(): Promise<KeyPairSigner> {
  const pair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  if (!("publicKey" in pair)) throw new Error("Ed25519 key generation returned no key pair");
  return { address: toAddress(encodeBase58(new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey)))) };
}

export type OrderInput = {
  kind: number;
  priceTicks: number;
  lots: bigint;
  orderType: number;
  expireTs?: number | bigint;
  selfMatch?: number;
  maxFills?: number;
  maxEvictions?: number;
  seatHint?: number;
  useCredit?: boolean;
  withdrawProceeds?: boolean;
  clientId?: bigint;
};

export async function openWindow(_ctx: SendContext, _input: { roller: KeyPairSigner; series: Address; mint: Address; tradingStartSec: number; expirySec?: number }): Promise<OpenedWindow> {
  throw deployNotLive();
}
export async function fundUser(_ctx: SendContext, _input: { faucet: KeyPairSigner; mint: Address; owner: Address; amount: bigint }): Promise<Address> {
  throw deployNotLive();
}
export async function seatHintFor(_ctx: SendContext, _w: OpenedWindow, _authority: Address): Promise<number> {
  throw deployNotLive();
}
export async function placeOrderInstruction(_ctx: SendContext, _w: OpenedWindow, _user: KeyPairSigner, _userToken: Address, _order: OrderInput): Promise<Instruction> {
  throw deployNotLive();
}
export async function placeOrder(_ctx: SendContext, _w: OpenedWindow, _user: KeyPairSigner, _userToken: Address, _order: OrderInput): Promise<string> {
  throw deployNotLive();
}
