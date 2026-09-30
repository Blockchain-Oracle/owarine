/**
 * The agents' stable ids and unit rules (C8f). The screens keep the reference's numeric ids (`grantId`, `strategyId`),
 * but on Canton a grant and a strategy are contracts that are re-created by every trade or revision, so an id cannot
 * be a contract id. Each is a hash of what never changes about it:
 *
 *   grantId     owner · agent · expiresAt · dayZero   (a trade, a top-up and a day rollover keep all four)
 *   strategyId  the registry's own text id `<creator party>/<index>` (sealed at publish, kept by every revision)
 *
 * both cut to 52 bits so they stay exact in a JS number (and fit the reference's bigint fields). The X grant's
 * "no monetary cap" ceiling (`X_MONETARY_CEILING`, 2^64 − 1) does not fit a Daml `Int` (2^63 − 1): it travels as
 * `DAML_NO_CAP` and reads back as the ceiling.
 */
import { encodeBase58, type Address } from "@agari/core/types";
import { X_MONETARY_CEILING } from "@agari/core/x";
import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";

const id52 = (tag: string, parts: readonly (string | number)[]): bigint => {
  const digest = bytesToHex(sha256(utf8ToBytes(`${tag}\u0000${parts.join("\u0000")}`)));
  return BigInt(`0x${digest.slice(0, 13)}`);
};

/** The grant's id: stable across its trades, top-ups and day rollovers; a new grant is a new id. */
export const grantIdOf = (g: { owner: string; agent: string; expiresAtSec: number; dayZeroSec: number }): bigint =>
  id52("agari-grant", [g.owner, g.agent, g.expiresAtSec, g.dayZeroSec]);

/** A strategy's numeric id from the registry's text id (`<creator party>/<index>`). */
export const strategyNumOf = (strategyId: string): bigint => id52("agari-strategy", [strategyId]);

/** The largest cap a grant carries on the ledger; anything at or over it reads back as "no monetary cap". */
export const DAML_NO_CAP = 9_000_000_000_000_000_000n;
export const capToDaml = (base: bigint): bigint => (base >= DAML_NO_CAP ? DAML_NO_CAP : base);
export const capFromDaml = (v: bigint): bigint => (v >= DAML_NO_CAP ? X_MONETARY_CEILING : v);

/** 00:00 UTC of the day `sec` falls in: a grant's day 0 (the reference's cap clock resets at 00:00 UTC). */
export const utcDayStartSec = (sec: number): number => Math.floor(sec / 86_400) * 86_400;

/** SHA-256 of UTF-8 text as lowercase hex: exactly Daml's `DA.Text.sha256`, which seals a strategy's spec. */
export const sha256Hex = (text: string): string => bytesToHex(sha256(utf8ToBytes(text)));

/**
 * A desk's address-shaped id (C4d, K-210): base58 of SHA-256(venue · owner party · its opening), derived and stable,
 * never a chain account. The opening is the embedded grant's expiry, which `DeskOffer_Open` sets once from the server's
 * clock and every later choice keeps. A seat party is recycled to later visitors, and each opening falls inside one
 * lease (the drain closes the mandate before the party can be leased again), so a later lessee's desk on the same
 * party never has an earlier lessee's address.
 */
export const deskAddressOf = (m: { owner: string; venue: string; grant: { expiresAtSec: number } }): Address =>
  encodeBase58(sha256(utf8ToBytes(`agari-desk/2\u0000${m.venue}\u0000${m.owner}\u0000${m.grant.expiresAtSec}`))) as Address;

/**
 * The address before C4d: venue · owner party only, so every lessee of a recycled party had the same one. Index rows
 * written then keep it; it is honoured only through the row owner's CURRENT lease (`chain.server.ts`, the runner's
 * reconcile), never on its own.
 */
export const legacyDeskAddressOf = (owner: string, venue: string): Address => encodeBase58(sha256(utf8ToBytes(`agari-desk\u0000${venue}\u0000${owner}`))) as Address;

/** YES-terms raw price (10^decimals = 1) ↔ the side's ticks (1000 = 1). */
export const ticksOfRaw = (raw: bigint, decimals: number): number => Number((raw * 1000n) / 10n ** BigInt(decimals));
export const rawOfTicks = (ticks: number, decimals: number): bigint => (BigInt(ticks) * 10n ** BigInt(decimals)) / 1000n;
