import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";
import type { Cluster } from "../constants/chain";
import { isAddress, isEd25519Signature, type Address, type Signature } from "../types/primitives";
import { networkLine, SIGNED_MESSAGE_BRAND } from "./signed-message";

/**
 * The phone's proof for ONE seat write (C4d M2b). The read header (`x-owarine-seat-read`) is reused for minutes and says
 * nothing about what it is sent with, so it only ever authorises reads. A write from the phone carries this header
 * instead: the seat key signs the method, the path with its query, the SHA-256 of the exact body bytes, a random nonce
 * and the time, and the server takes it once, within 30 seconds. A captured write proof replays nothing: it names one
 * request, the server keeps its nonce until it goes stale, and it cannot be moved to another path or body.
 *
 * Header: `address.issuedAtMs.nonce.signature` (base58 and hex never contain a dot).
 */
export const SEAT_WRITE_HEADER = "x-owarine-seat-write";
/** How long a write proof is good for. */
export const SEAT_WRITE_TTL_MS = 30_000;
/** Clock skew allowed for a proof issued slightly in the future. */
export const SEAT_WRITE_SKEW_MS = 5_000;

export interface SeatWriteRequest {
  method: string;
  /** The URL's path with its query string, exactly as sent (`/api/seat/link?x=1`). */
  path: string;
  /** Lowercase hex SHA-256 of the body's bytes (of the empty string when there is none). */
  bodySha256: string;
}

export interface SeatWriteProof {
  address: Address;
  issuedAtMs: number;
  /** 16 random bytes as lowercase hex. */
  nonce: string;
  signature: Signature;
}

const NONCE = /^[0-9a-f]{32}$/;

/** Lowercase hex SHA-256 of a body's UTF-8 text. */
export const bodySha256 = (body: string): string => bytesToHex(sha256(utf8ToBytes(body)));

/** The text a seat signs for one write. Written to be read: it names exactly the one request it allows. */
export function seatWriteText(p: { address: Address; issuedAtMs: number; nonce: string } & SeatWriteRequest, cluster: Cluster): string {
  return [
    `${SIGNED_MESSAGE_BRAND} seat write`,
    "",
    "This signature lets this device send ONE request as my seat, within 30 seconds. It is good for nothing else.",
    "",
    `Seat: ${p.address}`,
    `Request: ${p.method.toUpperCase()} ${p.path}`,
    `Body SHA-256: ${p.bodySha256}`,
    `Nonce: ${p.nonce}`,
    `Issued at: ${new Date(p.issuedAtMs).toISOString()}`,
    networkLine(cluster),
  ].join("\n");
}

export function formatSeatWriteHeader(proof: SeatWriteProof): string {
  return `${proof.address}.${proof.issuedAtMs}.${proof.nonce}.${proof.signature}`;
}

/** Null for anything that is not `address.issuedAtMs.nonce.signature` in the expected alphabets. */
export function parseSeatWriteHeader(value: string | null | undefined): SeatWriteProof | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  const [address, issued, nonce, signature] = parts as [string, string, string, string];
  if (!/^\d{1,16}$/.test(issued) || !isAddress(address) || !NONCE.test(nonce) || !isEd25519Signature(signature)) return null;
  return { address, issuedAtMs: Number(issued), nonce, signature };
}

/** Whether a write proof's issue time is inside its 30-second window at `nowMs`. */
export function seatWriteFresh(issuedAtMs: number, nowMs: number): boolean {
  return issuedAtMs <= nowMs + SEAT_WRITE_SKEW_MS && nowMs - issuedAtMs <= SEAT_WRITE_TTL_MS;
}
