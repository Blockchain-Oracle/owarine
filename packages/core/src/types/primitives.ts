import { z } from "zod";
import { isBase58OfLength } from "./base58";

declare const addressBrand: unique symbol;
declare const signatureBrand: unique symbol;

/**
 * A Solana account address: base58 of 32 bytes (a wallet key or a PDA).
 * Base58 is case-sensitive, so an Address is compared and stored exactly as written, never lowercased.
 */
export type Address = string & { readonly [addressBrand]: true };

/**
 * A transaction's id, as a receipt names it. On Canton it is the ledger **update id** (`isUpdateId`): lowercase hex of a
 * SHA-256 multihash, `1220` followed by 64 hex digits, exactly as the JSON Ledger API returns it. The base58 form of 64
 * bytes (`isEd25519Signature`) is still accepted, because an ed25519 message signature and the reference's recorded
 * Solana receipts share the brand. The two forms never overlap (base58 has no `0`), and neither is ever padded into the other.
 */
export type Signature = string & { readonly [signatureBrand]: true };

/** Raw bytes as 0x-prefixed hex: keccak commitments, oracle feed ids, RedStone's 20-byte signer ids. */
export type Hex = `0x${string}`;

/** A 32-byte hash or feed id as 0x-prefixed hex (Pyth feed ids, keccak digests, Switchboard feed hashes). */
export type Hash32 = Hex;

const HEX_RE = /^0x[0-9a-fA-F]*$/;
/** A Canton update id: the `1220` SHA-256 multihash prefix and 32 bytes of lowercase hex (JSON Ledger API v2 `updateId`). */
const UPDATE_ID_RE = /^1220[0-9a-f]{64}$/;
const HASH32_RE = /^0x[0-9a-fA-F]{64}$/;

export const isAddress = (v: unknown): v is Address => isBase58OfLength(v, 32);
/** Base58 of 64 bytes: an ed25519 signature (a seat key's signed text) or a recorded Solana transaction id. */
export const isEd25519Signature = (v: unknown): v is Signature => isBase58OfLength(v, 64);
/** A Canton ledger update id (`1220…`, 68 lowercase hex digits). */
export const isUpdateId = (v: unknown): v is Signature => typeof v === "string" && UPDATE_ID_RE.test(v);
/** Either transaction-id form: a Canton update id, or base58 of 64 bytes. */
export const isSignature = (v: unknown): v is Signature => isUpdateId(v) || isEd25519Signature(v);
export const isHex = (v: unknown): v is Hex => typeof v === "string" && HEX_RE.test(v);
export const isHash32 = (v: unknown): v is Hash32 => typeof v === "string" && HASH32_RE.test(v);

export function toAddress(value: string): Address {
  if (!isAddress(value)) throw new Error(`not a base58 address: ${value}`);
  return value;
}

export function toSignature(value: string): Signature {
  if (!isSignature(value)) throw new Error(`not a Canton update id or base58 signature: ${value}`);
  return value;
}

export const addressSchema = z.custom<Address>(isAddress, "expected a base58 Solana address");
export const signatureSchema = z.custom<Signature>(isSignature, "expected a Canton update id or a base58 signature");
export const updateIdSchema = z.custom<Signature>(isUpdateId, "expected a Canton update id");
export const hexSchema = z.custom<Hex>(isHex, "expected 0x-prefixed hex");
export const hash32Schema = z.custom<Hash32>(isHash32, "expected a 32-byte hex value");
