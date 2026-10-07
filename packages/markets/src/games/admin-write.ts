import type { Address, Signature } from "@owarine/core/types";
import { diagnosis } from "@owarine/core/types";
import { hmac } from "@noble/hashes/hmac";
import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";
import { ReadingError } from "../errors/reading-error";
import { seasonDistributeReplyWire, seasonWithdrawReplyWire } from "../provider/games-wire";

/**
 * The season admin's payout: one winner list, one amount each, paid once from the pool (`Season_Distribute`).
 *
 * On Canton the pool is the venue's contract, so the payout is the venue's choice and runs in ops: this call is the
 * admin's HMAC-signed request to ops' `POST /internal/games/season/distribute`, which maps each winner's seat address to
 * its venue account and exercises the choice once. The reference's field names are kept; what they carry here:
 */
export interface DistributeSeasonInput {
  /** Unused on Canton (the venue's authority lives in ops, never in a caller's key); kept for the reference's shape. */
  secretKey: Uint8Array;
  /** Ops' internal base URL (`OPS_INTERNAL_URL`). */
  rpcUrl: string;
  /** Unused on Canton; kept for the reference's shape. */
  rpcSubscriptionsUrl: string;
  seasonId: string;
  winners: readonly Address[];
  amountsBase: readonly bigint[];
  /** `OPS_ADMIN_SECRET`, which signs the call; read from the environment when omitted (C4d L4: never the web's secret). */
  opsSecret?: string;
}

const DISTRIBUTE_PATH = "/internal/games/season/distribute";
const WITHDRAW_PATH = "/internal/games/season/withdraw";

/** The same signature `@owarine/markets/server` `opsSignature` computes (v2, with its nonce), with a browser-safe HMAC. */
export function adminSignature(secret: string, ts: number, nonce: string, path: string, body: string): string {
  return `v2=${bytesToHex(hmac(sha256, utf8ToBytes(secret), utf8ToBytes(`${ts}.${nonce}.POST.${path}.${body}`)))}`;
}

/** One HMAC-signed admin call to ops, under the admin's own secret; resolves with the reply's JSON, rejects with a diagnosis. */
async function adminPost(rpcUrl: string, path: string, body: string, opsSecret: string | undefined): Promise<unknown> {
  const secret = opsSecret ?? (typeof process !== "undefined" ? process.env.OPS_ADMIN_SECRET : undefined);
  if (!secret) throw new ReadingError(diagnosis("signer-required", "the season admin's calls are signed with OPS_ADMIN_SECRET, which is not set"));
  const ts = Date.now();
  const nonce = bytesToHex(globalThis.crypto.getRandomValues(new Uint8Array(16)));
  let res: Response;
  try {
    res = await fetch(`${rpcUrl.replace(/\/$/, "")}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-owarine-ops-ts": String(ts), "x-owarine-ops-nonce": nonce, "x-owarine-ops-sig": adminSignature(secret, ts, nonce, path, body) },
      body,
    });
  } catch (error) {
    throw new ReadingError(diagnosis("rpc-down", `ops unreachable: ${error instanceof Error ? error.message : String(error)}`));
  }
  const json = await res.json().catch(() => null);
  if (json === null) throw new ReadingError(diagnosis("rpc-down", `ops ${path} → ${res.status}`));
  return json;
}

/** A plain-promise write: resolves with the distribution's update id, rejects with a diagnosis. */
export async function distributeSeasonPrizes(input: DistributeSeasonInput): Promise<Signature> {
  if (input.winners.length !== input.amountsBase.length) throw new ReadingError(diagnosis("unknown", "one amount per winner"));
  const body = JSON.stringify({ seasonId: input.seasonId, payouts: input.winners.map((address, i) => ({ address, amountBase: String(input.amountsBase[i]) })) });
  const parsed = seasonDistributeReplyWire.safeParse(await adminPost(input.rpcUrl, DISTRIBUTE_PATH, body, input.opsSecret));
  if (!parsed.success) throw new ReadingError(diagnosis("rpc-down", `ops ${DISTRIBUTE_PATH}: unexpected reply`));
  if (parsed.data.kind === "refused") throw new ReadingError(parsed.data.diagnosis);
  return parsed.data.updateId;
}

export interface WithdrawSeasonInput {
  /** Ops' internal base URL (`OPS_INTERNAL_URL`). */
  rpcUrl: string;
  seasonId: string;
  /** `OPS_ADMIN_SECRET`, which signs the call; read from the environment when omitted. */
  opsSecret?: string;
}

/**
 * The reference's `withdrawSeasonRemainder` (an admin deploy step there): what is left in the pool after its one payout
 * goes back to the venue and the pool closes (`Season_WithdrawRemainder`). An admin act: ops refuses it before the
 * distribution, and no web route forwards it (K-105). Resolves with the update id and the amount returned.
 */
export async function withdrawSeasonRemainder(input: WithdrawSeasonInput): Promise<{ updateId: Signature; withdrawnBase: bigint }> {
  const parsed = seasonWithdrawReplyWire.safeParse(await adminPost(input.rpcUrl, WITHDRAW_PATH, JSON.stringify({ seasonId: input.seasonId }), input.opsSecret));
  if (!parsed.success) throw new ReadingError(diagnosis("rpc-down", `ops ${WITHDRAW_PATH}: unexpected reply`));
  if (parsed.data.kind === "refused") throw new ReadingError(parsed.data.diagnosis);
  return { updateId: parsed.data.updateId, withdrawnBase: parsed.data.withdrawnBase };
}
