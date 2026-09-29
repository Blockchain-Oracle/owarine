import type { Address, Diagnosis } from "@agari/core/types";

/** Which write is being funded; kept for the same call sites as the reference's fee lanes (D-015). */
export type FeeLane = "order" | "faucet" | "redeem" | "vault" | "vault-order" | "parlay" | "range" | "maker" | "leverage" | "private" | "arena";

/**
 * Whether the signer can pay this write's network fee. The names are kept for their call sites; on Canton a seat pays
 * no network fee (the venue's participant pays traffic), so the check always passes with zero required.
 */
export type GasCheck =
  | { ok: true; lane: FeeLane; balanceLamports: bigint; requiredLamports: bigint }
  | { ok: false; lane: FeeLane; balanceLamports: bigint | null; requiredLamports: bigint; diagnosis: Diagnosis };

/** Always satisfied: nothing is required, so nothing is read. */
export async function checkGas(_wallet: Address, lane: FeeLane): Promise<GasCheck> {
  return { ok: true, lane, balanceLamports: 0n, requiredLamports: 0n };
}
