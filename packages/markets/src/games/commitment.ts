import { duelDeckPreimage, type DuelDeckInput } from "@owarine/core/games";
import type { Hash32, Hex } from "@owarine/core/types";
import { sha256 } from "@noble/hashes/sha2";
import { keccak_256 } from "@noble/hashes/sha3";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils";

/**
 * keccak-256 over the bytes a `0x`-hex string encodes: the hash the off-ledger commitments are taken over (a room
 * client seed's commitment, a Lucky seed and its candidate set). `@owarine/core` carries no crypto by design, so it builds
 * the preimage and the caller hashes it. The duel deck no longer uses it: its reveal is checked on the ledger, and the
 * ledger's hash is `DA.Text.sha256` (below).
 */
export function keccak256(data: Hex): Hash32 {
  return `0x${bytesToHex(keccak_256(hexToBytes(data.slice(2))))}`;
}

/**
 * sha256 over UTF-8 text, lowercase hex without `0x`: exactly what `DA.Text.sha256` returns, so the value the ops
 * deckmaster commits to is the value `Duel_Reveal` recomputes and compares.
 */
export function sha256Text(text: string): string {
  return bytesToHex(sha256(utf8ToBytes(text)));
}

/** The deck commitment as the ledger stores it (`DuelOpen.deckHash`): 64 lowercase hex characters. */
export function duelDeckHash(input: DuelDeckInput): string {
  return sha256Text(duelDeckPreimage(input));
}

/** The commitment for one deck as the app keys it (`0x` + the ledger's hex): what the room shows before the reveal. */
export function deckCommitment(input: DuelDeckInput): Hash32 {
  return `0x${duelDeckHash(input)}`;
}
