import "server-only";
import { randomUUID } from "node:crypto";
import { isAddress, isEd25519Signature, type Address } from "@agari/core/types";
import { seatLeaseRequestWire, seatLeaseText, SEAT_LEASE_TTL_MS, type SeatLeaseView } from "@agari/markets";
import { verifyWalletMessage } from "./auth/verify-signed-message.server";
import { webEnv } from "./env";
import type { SeatServer } from "./ledger.server";
import { DEFAULT_RULES, freeAtMs, type LeaseRow, type LeaseRules } from "./seat-store.server";

/**
 * Taking, renewing and recycling seats (plan §4). A lease is taken only on an explicit, signed request; the first
 * lease of a seat asks ops to fund it (demo cash into `VenueCash`); a drained seat is recycled only when the ledger,
 * read as that party, shows no open leg, no live quote and no grant, consent or desk (C8f), and its leftover cash is withdrawn by the seat itself, so
 * the next visitor starts from an empty party.
 */
export function leaseRules(server: SeatServer): LeaseRules {
  return { ...DEFAULT_RULES, idleTtlMs: server.env.AGARI_SEAT_IDLE_TTL_SEC * 1000, hardCapMs: server.env.AGARI_SEAT_HARD_CAP_SEC * 1000 };
}

export function leaseView(lease: LeaseRow, rules: LeaseRules): Extract<SeatLeaseView, { kind: "leased" }> {
  return {
    kind: "leased",
    leaseId: lease.leaseId,
    address: lease.address,
    party: lease.party,
    leasedAtMs: lease.leasedAtMs,
    idleExpiresAtMs: freeAtMs(lease, rules),
    hardCapAtMs: lease.hardCapAtMs,
    openLegs: lease.openLegs,
    funded: lease.fundedAtMs !== null,
  };
}

export type LeaseRequestCheck = { ok: true; address: Address } | { ok: false; reason: string };

/** The signed body `{address, issuedAtMs, signature}`: a fresh `seatLeaseText` signed by that address's key. */
export async function checkLeaseRequest(body: unknown, nowMs: number): Promise<LeaseRequestCheck> {
  const parsed = seatLeaseRequestWire.safeParse(body);
  if (!parsed.success) return { ok: false, reason: "expected {address, issuedAtMs, signature}" };
  const { address, issuedAtMs, signature } = parsed.data;
  if (!isAddress(address) || !isEd25519Signature(signature)) return { ok: false, reason: "malformed address or signature" };
  if (issuedAtMs > nowMs + 30_000 || nowMs - issuedAtMs > SEAT_LEASE_TTL_MS) return { ok: false, reason: "the lease request is stale; sign a fresh one" };
  const text = seatLeaseText(address, issuedAtMs, webEnv.markets.cluster);
  const valid = await verifyWalletMessage({ text, signature, signer: address });
  return valid ? { ok: true, address } : { ok: false, reason: "the signature is not this seat key's" };
}

/** At most `limit` drained seats checked per call: empty ones are swept and freed; ones still holding legs wait for ops. */
export async function recycleDrained(server: SeatServer, nowMs: number, limit = 2): Promise<number> {
  let freed = 0;
  for (const party of await server.store.draining(limit)) {
    try {
      const snap = await server.ledger.seats.read(party, { fresh: true });
      const live = snap.quotes.filter((q) => q.validUntilMs > nowMs);
      if (snap.legs.length > 0 || live.length > 0) continue;
      // C8f: a grant, a consent or a desk still on the party is ended by ops' drain first (its budget returns to cash).
      const agents = await server.agents.read(party);
      if (agents.grants.some((g) => g.data.owner === party) || agents.subscriptions.some((x) => x.data.subscriber === party) || (await server.agents.hasDesk(party))) continue;
      await server.ledger.writer.sweepCash(party, `${nowMs}-${randomUUID().slice(0, 8)}`);
      if (await server.store.markFree(party, nowMs)) freed += 1;
    } catch {
      // A seat that cannot be read or swept now stays draining; the next lease attempt tries again.
    }
  }
  return freed;
}

export async function takeSeat(server: SeatServer, address: Address, nowMs: number): Promise<SeatLeaseView> {
  const rules = leaseRules(server);
  const existing = await server.store.byAddress(address);
  if (!existing) {
    await server.store.expire(nowMs, rules);
    const stats = await server.store.stats(nowMs, rules);
    if (stats.free === 0 && stats.draining > 0) await recycleDrained(server, nowMs);
  }
  const startOffset = existing ? existing.startOffset : await server.client.ledgerEnd();
  const outcome = await server.store.lease(address, nowMs, { startOffset, leaseId: randomUUID(), rules });
  if (outcome.kind === "pool-full") return outcome;
  let lease = outcome.lease;
  if (lease.fundedAtMs === null) {
    const funded = await server.ops.fundSeat({ party: lease.party, leaseId: lease.leaseId, address });
    if (funded.kind !== "refused") {
      await server.store.markFunded(lease.leaseId, nowMs);
      lease = { ...lease, fundedAtMs: nowMs };
    }
  }
  return leaseView(lease, rules);
}
