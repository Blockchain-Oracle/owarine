/**
 * Seat funding (plan §4 "Seats", `./faucet`): on a seat lease the server credits demo credits into the seat party's
 * `VenueCash`, server-side only. The seat first needs its bilateral `VenueAccount` (the standing consent for the venue
 * to credit, never debit): the venue invites, the seat party accepts (ops acts as the seat only for this, on a party the
 * lease names), then the venue credits. Every step has a stable command id, so a retried lease credits once.
 *
 * `POST /internal/seats/fund` `{ party, leaseId, address }` (the web's `@agari/markets/server` contract) →
 * `{ kind: "funded", amountBase }` · `{ kind: "already" }` (this lease was credited before) · `{ kind: "refused", diagnosis }`.
 * The amount is ops' own (`SEAT_FUND_CREDITS`, default 1,000 demo credits), never the caller's.
 */
import { TEMPLATE_IDS } from "@agari/daml";
import {
  acceptAccountCommandId, cmd, creditCommandId, decodeVenueAccount, failureText, inviteCommandId, pick, readActive, submit, templateSuffix,
  type RoleSession,
} from "@agari/markets/ops/canton";
import { diagnosis } from "@agari/core/types";
import type { VenueContext } from "../venue/context";

const PARTY_ID = /^[A-Za-z0-9_\-:]{1,255}::[0-9a-f]{8,}$/;
const LEASE_ID = /^[A-Za-z0-9_\-]{1,64}$/;
/** D-123: demo credits are sized to the reference's scale, 100,000 credits a day; one credit is 10⁶ base units. */
export const MAX_CREDIT_BASE = BigInt(Number(process.env.SEAT_CREDIT_MAX_CREDITS) || 100_000) * 1_000_000n;
/** What one lease is credited. */
export const SEAT_FUND_BASE = BigInt(Number(process.env.SEAT_FUND_CREDITS) || 1_000) * 1_000_000n;

type Answer = { status: number; body: Record<string, unknown> };
const refused = (kind: Parameters<typeof diagnosis>[0], technical: string): Answer => ({ status: 200, body: { kind: "refused", diagnosis: diagnosis(kind, technical) } });

export interface SeatFunding {
  fund(seatParty: string, amountBase: bigint, leaseId: string): Promise<Answer>;
  handle(body: unknown): Promise<Answer>;
}

export function createSeatFunding(input: { venue: VenueContext; log: (why: string) => void }): SeatFunding | null {
  const venue = input.venue.session("venue");
  if (!venue) {
    input.log("VENUE_PARTY and the parties file are missing: seats are not funded");
    return null;
  }
  const infrastructure = new Set(Object.values(input.venue.parties));
  const asSeat = (party: string): RoleSession => ({ role: "seat", party, client: venue.client, dryRun: venue.dryRun });

  async function account(seatParty: string): Promise<string | null> {
    const acs = await readActive(venue!, [TEMPLATE_IDS.VenueAccount, TEMPLATE_IDS.VenueAccountInvite]);
    const acct = pick(acs, TEMPLATE_IDS.VenueAccount, decodeVenueAccount).find((a) => a.data.owner === seatParty && a.data.venue === venue!.party);
    if (acct) return acct.cid;
    let invite = pick(acs, TEMPLATE_IDS.VenueAccountInvite, decodeVenueAccount).find((a) => a.data.owner === seatParty)?.cid;
    if (!invite) {
      const out = await submit(venue!, { commandId: inviteCommandId(seatParty), commands: [cmd.inviteAccount(venue!.party, seatParty, "seat")] });
      if (out.kind === "dry") return null;
      invite = out.created.find((e) => templateSuffix(e.templateId) === templateSuffix(TEMPLATE_IDS.VenueAccountInvite))?.contractId;
      if (!invite) return account(seatParty);
    }
    const accepted = await submit(asSeat(seatParty), { commandId: acceptAccountCommandId(seatParty), commands: [cmd.acceptInvite(invite)] });
    if (accepted.kind === "dry") return null;
    return accepted.created.find((e) => templateSuffix(e.templateId) === templateSuffix(TEMPLATE_IDS.VenueAccount))?.contractId ?? account(seatParty);
  }

  async function fund(seatParty: string, amountBase: bigint, leaseId: string): Promise<Answer> {
    if (infrastructure.has(seatParty)) return refused("faucet-refused", "an infrastructure party is not a seat");
    if (amountBase <= 0n || amountBase > MAX_CREDIT_BASE) return refused("faucet-refused", `a credit is 1..${MAX_CREDIT_BASE} base units`);
    try {
      const accountCid = await account(seatParty);
      if (!accountCid) return refused("not-deployed", "DRY RUN: the account and credit were prepared, not executed");
      const out = await submit(venue!, { commandId: creditCommandId(seatParty, leaseId), commands: [cmd.creditAccount(accountCid, amountBase)] });
      if (out.kind === "dry") return refused("not-deployed", `DRY RUN: ${out.note}`);
      input.log(`funded ${seatParty.split("::")[0]} with ${amountBase} base (lease ${leaseId})${out.recovered ? " · already funded for this lease" : ""}`);
      return { status: 200, body: out.recovered ? { kind: "already" } : { kind: "funded", amountBase: amountBase.toString() } };
    } catch (error) {
      input.log(`fund ${seatParty.split("::")[0]} failed: ${failureText(error)}`);
      return refused("faucet-refused", `ledger rejected the credit: ${failureText(error).slice(0, 200)}`);
    }
  }

  return {
    fund,
    async handle(body) {
      const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
      if (typeof b.party !== "string" || !PARTY_ID.test(b.party)) return { status: 400, body: { diagnosis: diagnosis("unknown", "party must be a party id") } };
      if (typeof b.leaseId !== "string" || !LEASE_ID.test(b.leaseId)) return { status: 400, body: { diagnosis: diagnosis("unknown", "leaseId must be 1–64 of [A-Za-z0-9_-]") } };
      if (b.address !== undefined && typeof b.address !== "string") return { status: 400, body: { diagnosis: diagnosis("unknown", "address must be text") } };
      return fund(b.party, SEAT_FUND_BASE, b.leaseId);
    },
  };
}
