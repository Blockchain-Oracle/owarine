import type { Address, Signature } from "@agari/core/types";
import { diagnosis } from "@agari/core/types";
import { hmac } from "@noble/hashes/hmac";
import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";
import { ReadingError } from "../errors/reading-error";
import { seasonDistributeReplyWire } from "../provider/games-wire";

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
  /** `OPS_INTERNAL_SECRET`, which signs the call; read from the environment when omitted. */
  opsSecret?: string;
}

const PATH = "/internal/games/season/distribute";

/** The same signature `@agari/markets/server` `opsSignature` computes, with a browser-safe HMAC. */
function sign(secret: string, ts: number, body: string): string {
  return `v1=${bytesToHex(hmac(sha256, utf8ToBytes(secret), utf8ToBytes(`${ts}.POST.${PATH}.${body}`)))}`;
}

/** A plain-promise write: resolves with the distribution's update id, rejects with a diagnosis. */
export async function distributeSeasonPrizes(input: DistributeSeasonInput): Promise<Signature> {
  const secret = input.opsSecret ?? (typeof process !== "undefined" ? process.env.OPS_INTERNAL_SECRET : undefined);
  if (!secret) throw new ReadingError(diagnosis("signer-required", "the season payout is signed with OPS_INTERNAL_SECRET, which is not set"));
  if (input.winners.length !== input.amountsBase.length) throw new ReadingError(diagnosis("unknown", "one amount per winner"));
  const body = JSON.stringify({ seasonId: input.seasonId, payouts: input.winners.map((address, i) => ({ address, amountBase: String(input.amountsBase[i]) })) });
  const ts = Date.now();
  let res: Response;
  try {
    res = await fetch(`${input.rpcUrl.replace(/\/$/, "")}${PATH}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-agari-ops-ts": String(ts), "x-agari-ops-sig": sign(secret, ts, body) },
      body,
    });
  } catch (error) {
    throw new ReadingError(diagnosis("rpc-down", `ops unreachable: ${error instanceof Error ? error.message : String(error)}`));
  }
  const parsed = seasonDistributeReplyWire.safeParse(await res.json().catch(() => null));
  if (!parsed.success) throw new ReadingError(diagnosis("rpc-down", `ops ${PATH} → ${res.status}`));
  if (parsed.data.kind === "refused") throw new ReadingError(parsed.data.diagnosis);
  return parsed.data.updateId;
}
