/**
 * `POST /internal/private/move` (L-39, C8d): a seat's demo credits between its balance and its private bucket, and a
 * settled private call's payout home. Each is ONE transaction signed by the seat and the venue together: the seat
 * withdraws its own cash (`VenueCash_Withdraw`, exactly the amount, split first so nothing else moves) and the venue
 * credits the same amount into the other bucket (`VenueAccount_Credit`); a cash-out also dismisses the seat's settlement
 * receipt, so a call comes home once. The web sends WHO from the lease row (HMAC); ops refuses infrastructure parties.
 * A way out is never refused by the venue mode: moving out and cashing out are not new risk.
 */
import { createHash } from "node:crypto";
import { PRIVATE_BUCKET } from "@agari/core/private";
import { diagnosis } from "@agari/core/types";
import { TEMPLATE_IDS } from "@agari/daml";
import type { Command } from "@agari/ledger";
import { cmd, decodeVenueAccount, decodeVenueCash, failureText, pick, readActive, templateSuffix, type RoleSession } from "@agari/markets/ops/canton";
import { exactCash } from "@agari/markets/server";
import type { InternalHandler } from "../../http/internal";
import { venueModeRefusalNow } from "../../runtime/venue-mode";
import type { VenueContext } from "./context";

export const OPS_PRIVATE_MOVE_PATH = "/internal/private/move";
const PARTY_ID = /^[A-Za-z0-9_\-:]{1,255}::[0-9a-f]{8,}$/;
const REQUEST_ID = /^[0-9a-f-]{8,64}$/;
const DEMO_BUCKET = "demo";
const MAX_MOVE_BASE = 100_000_000_000n;

const refused = (kind: Parameters<typeof diagnosis>[0], why: string) => ({ status: 200, body: { kind: "refused", diagnosis: diagnosis(kind, why) } });
const digest = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 32);

interface ReceiptData {
  owner: string;
  venue: string;
  payout: bigint;
  pairId: string;
}

export function privateMoveRoute(venue: VenueContext, log: (why: string) => void): InternalHandler | null {
  const v = venue.session("venue");
  if (!v) return null;
  const infrastructure = new Set(Object.values(venue.parties));
  const client = v.client;

  const cashOf = (bucket: (b: string) => boolean) => async (party: string) => {
    const acs = await readActive({ ...v, party } as RoleSession, [TEMPLATE_IDS.VenueCash]);
    return pick(acs, TEMPLATE_IDS.VenueCash, decodeVenueCash)
      .filter((c) => c.data.owner === party && c.data.venue === v.party && bucket(c.data.bucket))
      .map((c) => ({ cid: c.cid, amount: c.data.amount }));
  };
  const publicCash = cashOf((b) => b !== PRIVATE_BUCKET && !b.startsWith("cc:"));
  const privateCash = cashOf((b) => b === PRIVATE_BUCKET);

  async function accountOf(party: string): Promise<string | null> {
    const acs = await readActive(v!, [TEMPLATE_IDS.VenueAccount]);
    return pick(acs, TEMPLATE_IDS.VenueAccount, decodeVenueAccount).find((a) => a.data.owner === party && a.data.venue === v!.party)?.cid ?? null;
  }

  async function receiptOf(party: string, cid: string): Promise<ReceiptData | null> {
    const acs = await readActive({ ...v!, party } as RoleSession, [TEMPLATE_IDS.SettlementReceipt]);
    const hit = acs.find((c) => c.createdEvent.contractId === cid && templateSuffix(c.createdEvent.templateId) === templateSuffix(TEMPLATE_IDS.SettlementReceipt));
    if (!hit) return null;
    const a = hit.createdEvent.createArgument as Record<string, string>;
    return { owner: a.owner!, venue: a.venue!, payout: BigInt(a.payout!), pairId: a.pairId! };
  }

  /** The atomic move: the seat's exact cash withdrawn, the venue's credit into `to`, plus any extra command (a dismissal). */
  async function move(party: string, commandId: string, amount: bigint, from: typeof publicCash, to: string, extra: Command[] = []) {
    const accountCid = await accountOf(party);
    if (!accountCid) throw new Error("the seat has no venue account");
    const commands: Command[] = [...extra];
    if (amount > 0n) {
      const cid = await exactCash({ client, cashOf: from }, party, commandId, amount, "pmove", "the move");
      commands.push(cmd.withdrawCash(cid), cmd.creditAccount(accountCid, amount, to));
    }
    const out = await client.submitAndWaitForTransaction({ actAs: [party, v!.party], commandId, commands });
    return out.transaction.updateId;
  }

  return async (body) => {
    const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
    if (typeof b.party !== "string" || !PARTY_ID.test(b.party) || infrastructure.has(b.party)) return refused("signer-required", "party must be a seat's party id");
    if (typeof b.requestId !== "string" || !REQUEST_ID.test(b.requestId)) return refused("unknown", "requestId must be the write's journal id");
    const party = b.party;
    const op = b.op;
    const commandId = `private:${op}:${digest(`${party}|${b.requestId}`)}`;
    try {
      if (op === "in" || op === "out") {
        const amount = typeof b.amountBase === "string" && /^\d+$/.test(b.amountBase) ? BigInt(b.amountBase) : 0n;
        if (amount <= 0n || amount > MAX_MOVE_BASE) return refused("below-min-quantity", "the amount must be positive");
        // Moving money in is new private risk-taking capacity; moving it out is a way out and never asks the mode.
        const modeWhy = op === "in" ? venueModeRefusalNow("supply") : null;
        if (modeWhy) return refused("market-not-trading", modeWhy);
        const updateId = await move(party, commandId, amount, op === "in" ? publicCash : privateCash, op === "in" ? PRIVATE_BUCKET : DEMO_BUCKET);
        log(`private ${op} ${amount} for ${party.split("::")[0]} · ${updateId.slice(0, 16)}…`);
        return { status: 200, body: { kind: "moved", op, amountBase: amount.toString(), updateId, recovered: false } };
      }
      if (op === "cashout") {
        if (typeof b.receiptCid !== "string") return refused("unknown", "receiptCid is required");
        const r = await receiptOf(party, b.receiptCid);
        if (!r || r.owner !== party || r.venue !== v.party) return refused("already-claimed", "no live settlement receipt of this seat by that id (cashed out already?)");
        const updateId = await move(party, commandId, r.payout, publicCash, PRIVATE_BUCKET, [cmd.dismissReceipt(b.receiptCid)]);
        log(`private cash-out ${r.payout} for ${party.split("::")[0]} (pair ${r.pairId.slice(0, 8)}) · ${updateId.slice(0, 16)}…`);
        return { status: 200, body: { kind: "moved", op, amountBase: r.payout.toString(), updateId, recovered: false } };
      }
      return refused("unknown", "op must be in, out or cashout");
    } catch (error) {
      const text = failureText(error);
      // The same request again after it landed: the command id is the request's, so the ledger refuses the duplicate.
      if (/DUPLICATE_COMMAND|ALREADY_EXISTS/i.test(text)) return { status: 200, body: { kind: "moved", op, amountBase: String(b.amountBase ?? "0"), updateId: "", recovered: true } };
      log(`private ${String(op)} for ${party.split("::")[0]} failed: ${text.slice(0, 200)}`);
      return refused(/insufficient|holds/i.test(text) ? "insufficient-collateral" : "contract-revert", text.slice(0, 200));
    }
  };
}
