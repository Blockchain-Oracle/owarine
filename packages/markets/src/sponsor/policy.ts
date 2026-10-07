/**
 * The sponsor's refusal shape, kept for the route and the pure gates (`gates.ts`). The reference's static co-sign policy
 * decoded a Solana v0 transaction; Canton charges the user no network fee, so there is no transaction to co-sign and no
 * static policy (C1). Server-only (`@owarine/markets/sponsor`).
 */
export interface StaticLimits {
  maxComputeUnits: number;
  maxMicroLamports: bigint;
}

export type Refusal = { ok: false; status: 400 | 403 | 409 | 429 | 502 | 503; error: string };

export const refuse = (status: Refusal["status"], error: string): Refusal => ({ ok: false, status, error });
