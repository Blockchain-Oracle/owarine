import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
  canRenewRoomToken,
  mintRoomToken,
  parseRoomToken,
  renewRoomTokenClaims,
  roomAuthFresh,
  roomAuthMessage,
  roomSessionClaims,
  roomTokenExpiresAtMs,
  verifyRoomToken,
  type RoomTokenClaims,
} from "@agari/core/games";
import { isSignature, type Address } from "@agari/core/types";
import { verifyWalletMessage } from "@/lib/auth/verify-signed-message.server";
import { ensureMarkets, parseMarketsEnv } from "@agari/markets";
import { resolveArenaDeployment } from "@agari/markets/games";
import { seatServer } from "@/lib/ledger.server";

/**
 * Minting the duel room's credential — server only. Nothing here may be imported by a component.
 *
 * The browser's game key signs, silently; this route turns that signature into a token the ops room server can check on
 * its own, with no shared database and no call back to the app. `ROOM_TOKEN_SECRET` is the only thing
 * the two processes share, and it is the same variable the Stage 3 comment Room already uses — one
 * secret for the deployment, not one per feature.
 *
 * A per-process random fallback exists so a dev machine works without configuration, but it is a
 * different value in each process, which means the ops room would refuse every token it minted. That is
 * the correct failure: it is loudly broken rather than quietly unauthenticated.
 */
const SECRET = process.env.ROOM_TOKEN_SECRET ?? randomBytes(32).toString("hex");

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

/** Constant time, matching the room server's own comparison — a MAC is never checked with `===` here. */
function macMatches(payload: string, mac: string): boolean {
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(mac);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export interface RoomTokenGrant {
  token: string;
  /** When the browser should ask for another one — it renews without a second signature until the session ends. */
  expiresAtMs: number;
  sessionEndsAtMs: number;
  /** Where the room listens, or null when this deployment has not been given one. */
  url: string | null;
}

function grant(claims: RoomTokenClaims): RoomTokenGrant {
  return {
    token: mintRoomToken(claims, sign),
    expiresAtMs: roomTokenExpiresAtMs(claims),
    sessionEndsAtMs: claims.sessionEndsAtMs,
    url: process.env.GAME_ROOM_PUBLIC_URL ?? null,
  };
}

/** The arena this deployment's rooms are about, or null where none is deployed. */
export async function roomArena(): Promise<{ chainId: number; arena: Address } | null> {
  const env = parseMarketsEnv();
  ensureMarkets(env);
  // The arena is ops' desk's read of `ArenaTerms`; the seat tier registers that source when it is built, so it is
  // built first (without it the read falls back to our own routes, which this server cannot call over loopback).
  seatServer();
  const deployment = await resolveArenaDeployment(env);
  return deployment ? { chainId: deployment.chainId, arena: deployment.gameArena } : null;
}

export type MintOutcome = { ok: true; grant: RoomTokenGrant } | { ok: false; status: number; error: string };

/** Whether the seat that asks may speak for `wallet` (C4c): true only for a key of that seat's own live lease. */
export type Vouch = (wallet: Address) => Promise<boolean>;

/** The seat a request proved, as much of it as the vouch needs (`SeatContext` from `seatFromRequest`). */
export interface ProvenSeat {
  caller: string;
  lease: { leaseId: string; address: string };
  server: { store: { byAddress(address: string): Promise<{ leaseId: string } | null> } };
}

/**
 * C4c (security review M1): the room trusted the wallet a key claimed, and on Canton no arena record ever names a
 * seat's key (`readArenaAgent` answers "absent"), so any key could mint a token for any wallet and enter its room.
 * A wallet is now vouched for only by the seat the request proves (the cookie, or the phone's signed header): the
 * key that proved it, the key that took its lease, or a key joined to that same live lease (`byAddress`, the one
 * address → party resolution). Another seat's address, or a lease that has ended, is refused.
 */
export function seatVouch(seat: ProvenSeat): Vouch {
  return async (wallet) => {
    if (wallet === seat.caller || wallet === seat.lease.address) return true;
    const lease = await seat.server.store.byAddress(wallet).catch(() => null);
    return lease !== null && lease.leaseId === seat.lease.leaseId;
  };
}

const NOT_VOUCHED = { ok: false as const, status: 403, error: "That wallet is not this seat's. Take the seat on this device, or link this device to it." };

/**
 * A first token: the browser key's signature is verified against the message this app would have asked
 * for, then discarded. The reference took the wallet on the key's word (its `hello`) and let the arena's
 * agent record check it later; on Canton there is no such record, so the seat the request proves must
 * vouch for the wallet first (`seatVouch`, C4c).
 */
export async function mintFromSignature(wallet: Address, key: Address, issuedAtMs: number, signature: string, nowMs: number, vouch: Vouch): Promise<MintOutcome> {
  const target = await roomArena();
  if (!target) return { ok: false, status: 503, error: "No duel arena is deployed on this network." };
  if (!roomAuthFresh(issuedAtMs, nowMs)) return { ok: false, status: 400, error: "That signature is too old." };

  const message = roomAuthMessage({ wallet, key, chainId: target.chainId, arena: target.arena, issuedAtMs });
  const verified = isSignature(signature) && (await verifyWalletMessage({ text: message, signature, signer: key }));
  if (!verified) return { ok: false, status: 401, error: "That signature is not this key's." };
  if (!(await vouch(wallet))) return NOT_VOUCHED;

  return { ok: true, grant: grant(roomSessionClaims(wallet, key, target.chainId, target.arena, nowMs)) };
}

/**
 * A later token on the same signature. The presented token must be ours and its session still open —
 * an expired token still renews, because expiry is what renewal is for; a finished session does not.
 */
export async function renewFromToken(token: string, nowMs: number, vouch: Vouch): Promise<MintOutcome> {
  const parsed = parseRoomToken(token);
  if (!parsed || !macMatches(parsed.payload, parsed.mac)) return { ok: false, status: 401, error: "That room token is not ours." };
  if (!canRenewRoomToken(parsed.claims, nowMs)) return { ok: false, status: 401, error: "That room session has ended." };
  // A session outlives no lease: the seat must still vouch for the wallet at every renewal.
  if (!(await vouch(parsed.claims.wallet))) return NOT_VOUCHED;

  const target = await roomArena();
  if (!target || parsed.claims.chainId !== target.chainId || parsed.claims.arena !== target.arena) {
    return { ok: false, status: 403, error: "That room token was minted for another arena." };
  }

  const next = renewRoomTokenClaims(parsed.claims, nowMs);
  return next ? { ok: true, grant: grant(next) } : { ok: false, status: 401, error: "That room session has ended." };
}

export type TokenWallet = { ok: true; wallet: Address } | { ok: false; status: number; error: string };

/**
 * The wallet a live token claims — the arcade's posting identity, checked the way the room checks it:
 * the MAC first, then the arena binding and the clocks. The claim is the browser key's word for a
 * wallet that never entered a duel; the arcade's label says what that is worth, and no money rides on it.
 */
export async function walletFromRoomToken(token: string, nowMs: number, vouch: Vouch): Promise<TokenWallet> {
  const target = await roomArena();
  if (!target) return { ok: false, status: 503, error: "No duel arena is deployed on this network, so no key can vouch for a seat here." };
  const verdict = verifyRoomToken(token, { chainId: target.chainId, arena: target.arena }, nowMs, macMatches);
  if (!verdict.ok) return { ok: false, status: verdict.code === "forbidden" ? 403 : 401, error: `That room token is not accepted: ${verdict.why}.` };
  // C4c: the bearer must also be the seat the token names (M1), so a leaked or stale token posts nothing as it.
  if (!(await vouch(verdict.claims.wallet))) return NOT_VOUCHED;
  return { ok: true, wallet: verdict.claims.wallet };
}

/** The text the browser's key signs, built here so the two copies cannot drift. */
export async function roomAuthPrompt(wallet: Address, key: Address, issuedAtMs: number): Promise<string | null> {
  const target = await roomArena();
  return target ? roomAuthMessage({ wallet, key, chainId: target.chainId, arena: target.arena, issuedAtMs }) : null;
}
