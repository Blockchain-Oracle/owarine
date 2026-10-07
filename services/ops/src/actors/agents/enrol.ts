/**
 * `POST /internal/agents/enrol` (C8f): the venue's standing offers a seat needs before its first grant, consent,
 * strategy or desk, created only when missing and under deterministic command ids (two concurrent calls for one seat
 * create each offer once):
 *
 *   GrantDesk          open, top up grants                           enrol:<seat>:grant-desk
 *   DeskOffer          open the desk                                 enrol:<seat>:desk-offer
 *   SubscriberInvite   open the book of consents (unless it has one) enrol:<seat>:subscriber-invite
 *   CreatorLicense     publish strategies                            enrol:<seat>:creator-license
 *
 * The party comes from the web's lease row; an infrastructure party is never enrolled.
 */
import { diagnosis } from "@owarine/core/types";
import { AGENT_TEMPLATE_IDS } from "@owarine/daml";
import { readActive, submit, failureText, type RoleSession } from "@owarine/markets/ops/canton";
import { acmd, decodeCreatorLicense, decodeDeskOffer, decodeGrantDesk, decodeSubscriberBook, decodeSubscriberInvite } from "@owarine/markets/ops/agents";
import { sha256Hex } from "@owarine/markets/ops/agents";
import type { Command } from "@owarine/ledger";

const PARTY_ID = /^[A-Za-z0-9_\-:]{1,255}::[0-9a-f]{8,}$/;
const LEASE_ID = /^[A-Za-z0-9_\-]{1,64}$/;

export type Answer = { status: number; body: unknown };
const refused = (kind: Parameters<typeof diagnosis>[0], technical: string): Answer => ({ status: 200, body: { kind: "refused", diagnosis: diagnosis(kind, technical) } });

export async function handleEnrol(venue: RoleSession, infrastructure: ReadonlySet<string>, body: unknown, log: (why: string) => void): Promise<Answer> {
  const b = (body ?? {}) as { party?: unknown; leaseId?: unknown };
  if (typeof b.party !== "string" || !PARTY_ID.test(b.party)) return { status: 400, body: { diagnosis: diagnosis("unknown", "party must be a party id") } };
  if (typeof b.leaseId !== "string" || !LEASE_ID.test(b.leaseId)) return { status: 400, body: { diagnosis: diagnosis("unknown", "leaseId must be 1–64 of [A-Za-z0-9_-]") } };
  const seat = b.party;
  if (infrastructure.has(seat)) return refused("unknown", "an infrastructure party is not a seat");
  const A = AGENT_TEMPLATE_IDS;
  const acs = await readActive(venue, [A.GrantDesk, A.DeskOffer, A.SubscriberInvite, A.SubscriberBook, A.CreatorLicense]);
  const has = (templateId: string, decode: (v: unknown) => { owner?: string; subscriber?: string; creator?: string }) =>
    acs.some((c) => c.createdEvent.templateId.endsWith(templateId.slice(templateId.indexOf(":"))) && (() => {
      try {
        const x = decode(c.createdEvent.createArgument);
        return (x.owner ?? x.subscriber ?? x.creator) === seat;
      } catch {
        return false;
      }
    })());
  const want: Array<[string, Command]> = [];
  if (!has(A.GrantDesk, decodeGrantDesk)) want.push(["grant-desk", acmd.createGrantDesk(venue.party, seat)]);
  if (!has(A.DeskOffer, decodeDeskOffer)) want.push(["desk-offer", acmd.createDeskOffer(venue.party, seat)]);
  if (!has(A.SubscriberInvite, decodeSubscriberInvite) && !has(A.SubscriberBook, decodeSubscriberBook)) want.push(["subscriber-invite", acmd.createSubscriberInvite(venue.party, seat)]);
  if (!has(A.CreatorLicense, decodeCreatorLicense)) want.push(["creator-license", acmd.createCreatorLicense(venue.party, seat)]);
  if (want.length === 0) return { status: 200, body: { kind: "enrolled", created: [] } };
  if (venue.dryRun) return refused("not-deployed", `DRY_RUN: would create ${want.map(([w]) => w).join(", ")} for this seat`);
  const tag = sha256Hex(seat).slice(0, 24);
  const created: string[] = [];
  for (const [what, command] of want) {
    try {
      await submit(venue, { commandId: `enrol:${tag}:${what}`, commands: [command] });
      created.push(what);
    } catch (error) {
      log(`enrol ${seat.split("::")[0]} ${what} failed: ${failureText(error)}`);
      return refused("contract-revert", `the venue could not create the seat's ${what}: ${failureText(error).slice(0, 160)}`);
    }
  }
  log(`enrolled ${seat.split("::")[0]}: ${created.join(", ")}`);
  return { status: 200, body: { kind: "enrolled", created } };
}
