import { randomUUID } from "node:crypto";
import {
  FaucetError, SOL_FAUCET_POLICY as POLICY, TUSDC_FAUCET_POLICY as TUSDC, anyClaimView, faucetChallengeMessage, faucetClaimView, faucetTopUpLamports,
  tusdcBaseUnits, tusdcClaimView, unavailableTusdcStatus, type AnyFaucetClaim, type AnyFaucetClaimView, type FaucetAsset, type FaucetStatus, type TusdcFaucetStatus,
} from "@owarine/core/faucet";
import { isAddress, isSignature } from "@owarine/core/types";
import { readFaucetStore, withFaucetLock, type ClaimJournal, type FaucetStore } from "@owarine/db";
import type { FaucetChain } from "@owarine/markets/faucet";
import { verifyWalletMessage } from "@/lib/auth/verify-signed-message.server";

export interface FaucetServiceDeps {
  chain: FaucetChain;
  read: () => Promise<FaucetStore>;
  lock: <T>(run: (store: FaucetStore) => Promise<T>) => Promise<T>;
  now: () => number;
  id: () => string;
  /** ed25519 over the challenge text; needs no chain, so it works before the transfer path does (D-012). */
  verify: (wallet: string, message: string, signature: string) => Promise<boolean>;
}

/** The funder must keep its reserve after paying a new ATA's rent and both signatures of a mint (first-call.md §4). */
export const TUSDC_FUNDING_FLOOR_LAMPORTS = POLICY.reserveLamports + TUSDC.ataRentLamports + TUSDC.maxMintFeeLamports;
const RULES = {
  sol: { cooldownMs: POLICY.cooldownMs, maxPerIp: POLICY.maxPerIpPerDay, cooldown: "This seat can request another top-up 24 hours after its last request.", ip: "This connection has reached its daily top-up allocation.", pending: "A top-up is still being checked. Please try again shortly." },
  tusdc: { cooldownMs: TUSDC.cooldownMs, maxPerIp: TUSDC.maxPerIpPerDay, cooldown: "This seat can claim demo credits again 24 hours after its last claim.", ip: "This connection has reached its daily demo credits claims.", pending: "A credits claim is still being checked. Please try again shortly." },
} as const;
const TUSDC_AMOUNT_TEXT = `${TUSDC.amountUnits.toLocaleString("en-US")} demo credits`;

/** A base58 wallet's signature over exactly `message`; malformed input is a plain false. */
export async function verifyChallengeSignature(wallet: string, message: string, signature: string): Promise<boolean> {
  if (!isAddress(wallet) || !isSignature(signature)) return false;
  return verifyWalletMessage({ text: message, signature, signer: wallet });
}
export function createFaucetService(chain: FaucetChain, overrides: Partial<FaucetServiceDeps> = {}) {
  const deps: FaucetServiceDeps = { chain, read: readFaucetStore, lock: withFaucetLock, now: Date.now, id: randomUUID, verify: verifyChallengeSignature, ...overrides };
  const journal = (store: FaucetStore, asset: FaucetAsset): ClaimJournal<AnyFaucetClaim> => store[asset];
  async function inspect<C extends AnyFaucetClaim>(claim: C): Promise<C> {
    if (claim.status !== "prepared") return claim;
    const status = await deps.chain.inspect(claim);
    if (status !== "prepared") await journal(await deps.read(), claim.asset).mark(claim.id, status);
    return { ...claim, status };
  }
  async function deliver<C extends AnyFaucetClaim>(claim: C): Promise<C> {
    const current = await inspect(claim);
    if (current.status !== "prepared") return current;
    try { await deps.chain.broadcast(current); } catch { /* A lost acknowledgement never creates a new transfer. */ }
    return inspect(current).catch(() => current);
  }
  const refill = () => new FaucetError("refill-needed", "The faucet is waiting for a refill. Please try again later.", 503);
  /** A new SOL top-up's amount and signed bytes, inside the reservation lock. */
  async function reserveSol(wallet: string, usedLamports: bigint) {
    const balance = await deps.chain.balance(wallet);
    const amountLamports = faucetTopUpLamports(balance);
    if (amountLamports === 0n) throw new FaucetError("already-funded", "Canton charges no network fee, so there is nothing to top up. Continue to get demo credits.");
    if (usedLamports + amountLamports > POLICY.dailyLamports) throw new FaucetError("daily-limit", "Today's top-up allocation is used up. Please try again later.", 429);
    const funding = await deps.chain.balance(deps.chain.address);
    if (funding < POLICY.reserveLamports + amountLamports) throw refill();
    const prepared = await deps.chain.prepare(wallet, amountLamports);
    if (funding < POLICY.reserveLamports + amountLamports + BigInt(prepared.feeLamports)) throw refill();
    return { asset: "sol" as const, amountLamports: amountLamports.toString(), ...prepared };
  }
  /** A new tUSDC mint's amount and signed bytes, inside the reservation lock. The wallet needs no SOL. */
  async function reserveTusdc(wallet: string, usedBase: bigint) {
    const { decimals } = await deps.chain.mint();
    const amountBase = tusdcBaseUnits(TUSDC.amountUnits, decimals);
    if (usedBase + amountBase > tusdcBaseUnits(TUSDC.dailyUnits, decimals)) throw new FaucetError("daily-limit", "Today's demo credits allocation is used up. Please try again later.", 429);
    if (await deps.chain.balance(deps.chain.address) < TUSDC_FUNDING_FLOOR_LAMPORTS) throw new FaucetError("refill-needed", "The faucet is waiting for a refill, so credits claims are paused. Please try again later.", 503);
    const prepared = await deps.chain.prepareMint(wallet, amountBase);
    return { asset: "tusdc" as const, amountBase: amountBase.toString(), ...prepared };
  }
  async function tusdcStatus(store: FaucetStore, wallet: string | null, fundingLamports: bigint): Promise<TusdcFaucetStatus> {
    if (!deps.chain.mintAuthority) return unavailableTusdcStatus();
    const facts = await deps.chain.mint().catch((error: unknown) => { if (error instanceof FaucetError) return error; throw error; });
    if (facts instanceof FaucetError) return unavailableTusdcStatus(facts.message);
    const [used, previous, balance] = await Promise.all([store.tusdc.used(deps.now() - TUSDC.cooldownMs, ""), wallet ? store.tusdc.latest(wallet) : null, wallet ? deps.chain.tokenBalance(wallet) : null]);
    const current = previous ? await inspect(previous) : null;
    const amount = tusdcBaseUnits(TUSDC.amountUnits, facts.decimals);
    const daily = tusdcBaseUnits(TUSDC.dailyUnits, facts.decimals);
    const remaining = daily > used.amount ? daily - used.amount : 0n;
    const funded = fundingLamports >= TUSDC_FUNDING_FLOOR_LAMPORTS;
    const nextMs = current ? current.createdAtMs + TUSDC.cooldownMs : null;
    const message = current?.status === "prepared" ? "Your credits claim is confirming. It will not be minted twice."
      : current?.status === "conflict" ? "Your credits claim needs operator review."
      : nextMs !== null && nextMs > deps.now() ? "This seat has claimed its demo credits for the last 24 hours."
      : !funded ? "The faucet is waiting for a refill, so credits claims are paused."
      : remaining < amount ? "Today's demo credits allocation is used up. Please try again later."
      : `The same free signature adds ${TUSDC_AMOUNT_TEXT}. There is no transaction to approve and no fee.`;
    return { configured: true, ready: funded && remaining >= amount, mint: facts.address, decimals: facts.decimals, amountBase: amount.toString(), walletBalanceBase: balance?.toString() ?? null, dailyRemainingBase: remaining.toString(), claim: current ? tusdcClaimView(current) : null, message };
  }
  return {
    async status(wallet: string | null): Promise<FaucetStatus> {
      const store = await deps.read();
      const [funding, balance, used, previous] = await Promise.all([
        deps.chain.balance(deps.chain.address), wallet ? deps.chain.balance(wallet) : null,
        store.sol.used(deps.now() - POLICY.cooldownMs, ""), wallet ? store.sol.latest(wallet) : null,
      ]);
      const [current, tusdc] = await Promise.all([previous ? inspect(previous) : null, tusdcStatus(store, wallet, funding)]);
      const amount = balance === null ? POLICY.targetLamports : faucetTopUpLamports(balance);
      const remaining = POLICY.dailyLamports > used.amount ? POLICY.dailyLamports - used.amount : 0n;
      const funded = funding >= POLICY.reserveLamports + amount + POLICY.maxTransferFeeLamports;
      const ready = funded && remaining >= amount;
      const nextMs = current ? current.createdAtMs + POLICY.cooldownMs : null;
      const message = current?.status === "prepared" ? "Your top-up is confirming. It will not be paid twice."
        : current?.status === "conflict" ? "Your top-up needs operator review."
        : balance !== null && amount === 0n ? "Canton charges no network fee, so there is nothing to top up. Continue to get demo credits."
        : nextMs !== null && nextMs > deps.now() ? "This seat has used its top-up for the last 24 hours."
        : !funded ? "The faucet is waiting for a refill. Please try again later."
        : remaining < amount ? "Today's top-up allocation is used up. Please try again later."
        : "Verify with a free seat signature, then the faucet adds your demo credits. There is no network fee.";
      return { configured: true, ready, address: deps.chain.address, fundingBalanceLamports: funding.toString(), walletBalanceLamports: balance?.toString() ?? null, dailyRemainingLamports: remaining.toString(), targetLamports: POLICY.targetLamports.toString(), thresholdLamports: POLICY.thresholdLamports.toString(), claim: current ? faucetClaimView(current) : null, tusdc, message };
    },
    async challenge(wallet: string, ipHash: string, origin: string) {
      const nowMs = deps.now();
      return deps.lock(async (store) => {
        const counts = await store.challengeCounts(wallet, ipHash, nowMs - 3_600_000);
        if (counts.wallet >= 6 || counts.ip >= 20 || counts.total >= 300) throw new FaucetError("rate-limited", "Too many test funds requests. Please try again later.", 429);
        const id = deps.id();
        const expiresAtMs = nowMs + POLICY.challengeTtlMs;
        const message = faucetChallengeMessage({ origin, wallet, id, expiresAtMs });
        await store.addChallenge({ id, wallet, ipHash, message, createdAtMs: nowMs, expiresAtMs });
        return { id, message, expiresAtMs };
      });
    },
    /** One challenge signature claims each asset at most once: `id` keys both journals. */
    async claim(id: string, signature: string, ipHash: string, asset: FaucetAsset = "sol"): Promise<AnyFaucetClaimView> {
      const store = await deps.read();
      const claims = journal(store, asset);
      const rules = RULES[asset];
      const challenge = await store.challenge(id);
      if (!challenge) throw new FaucetError("challenge-missing", "Request a new seat verification message.", 400);
      const existing = await claims.claim(id);
      if (!existing && challenge.expiresAtMs <= deps.now()) throw new FaucetError("challenge-expired", "Seat verification expired. Please try again.", 400);
      if (!existing && challenge.ipHash !== ipHash) throw new FaucetError("request-changed", "Your connection changed. Please request a new verification message.", 400);
      if (!await deps.verify(challenge.wallet, challenge.message, signature)) throw new FaucetError("signature-invalid", "The signature does not match this seat's request.", 403);

      // A signed retry may recover its existing transfer even after the message expired.
      if (existing) return anyClaimView(await deliver(existing));
      const pending = await claims.pending();
      if (pending) await deliver(pending);

      const reserved = await deps.lock(async (locked) => {
        const lockedClaims = journal(locked, asset);
        const duplicate = await lockedClaims.claim(id);
        if (duplicate) return duplicate;
        const nowMs = deps.now();
        if (challenge.expiresAtMs <= nowMs) throw new FaucetError("challenge-expired", "Seat verification expired. Please try again.", 400);
        if (await lockedClaims.pending()) throw new FaucetError("pending-transfer", rules.pending);
        const previous = await lockedClaims.latest(challenge.wallet);
        if (previous && previous.createdAtMs + rules.cooldownMs > nowMs) throw new FaucetError("cooldown", rules.cooldown, 429);
        const used = await lockedClaims.used(nowMs - rules.cooldownMs, ipHash);
        if (used.ip >= rules.maxPerIp) throw new FaucetError("rate-limited", rules.ip, 429);
        const reservation = asset === "sol" ? await reserveSol(challenge.wallet, used.amount) : await reserveTusdc(challenge.wallet, used.amount);
        const record: AnyFaucetClaim = { id, wallet: challenge.wallet, funder: deps.chain.address, ipHash, status: "prepared", createdAtMs: nowMs, ...reservation };
        await lockedClaims.insert(record);
        return record;
      });
      // withFaucetLock has committed the signed bytes, last valid block height and signature before this line.
      return anyClaimView(await deliver(reserved));
    },
  };
}
