/**
 * The seat's private-balance writes on Canton (C8d, L-39): moving demo credits into or out of the private bucket is one
 * seat-authorised request (`POST /api/private/balance`), which ops signs with the seat as one transaction. There is no
 * desk allowance on Canton, so an allow is already true and a revoke has nothing to revoke; the venue settles every
 * leg itself, so there is no slot to settle.
 */
import { diagnosis } from "@agari/core/types";
import type { PhaseListener, TxOutcome } from "@agari/core/ports";
import { privateRequestId, type PrivateIntent } from "@agari/core/private";
import type { Signature } from "@agari/core/types";
import { z } from "zod";
import { ledgerRequest } from "../provider/ledger-api";

const movedWire = z.object({ kind: z.literal("moved"), op: z.string(), amountBase: z.string(), updateId: z.string(), recovered: z.boolean() });

async function move(op: "in" | "out", amountBase: bigint, onPhase?: PhaseListener): Promise<TxOutcome> {
  onPhase?.("submitted");
  const r = await ledgerRequest("/private/balance", { method: "POST", wire: movedWire, root: true, body: { commandId: privateRequestId(), op, amountBase: amountBase.toString() } });
  if (!r.ok) return r.diagnosis.kind === "send-unknown" ? { status: "unknown", diagnosis: r.diagnosis } : { status: "refused", diagnosis: r.diagnosis };
  onPhase?.("confirmed", { txHash: r.value.updateId as Signature });
  return { status: "confirmed", txHash: r.value.updateId as Signature };
}

export async function submitPrivateTx(_ctx: unknown, intent: PrivateIntent, onPhase?: PhaseListener): Promise<TxOutcome> {
  switch (intent.kind) {
    case "private-deposit-and-allow":
      return intent.amountBase > 0n ? move("in", intent.amountBase, onPhase) : { status: "confirmed", txHash: "" as Signature };
    case "private-allow":
      return { status: "confirmed", txHash: "" as Signature };
    case "private-withdraw":
      return move("out", intent.amountBase, onPhase);
    case "private-revoke":
      return { status: "refused", diagnosis: diagnosis("grant-refused", "nothing to revoke on Canton: no desk holds an allowance over your private balance, which only your seat spends") };
    case "private-settle":
      return { status: "refused", diagnosis: diagnosis("grant-refused", "the venue settles every private call itself; cash it out from the private list once it has") };
  }
}
