/**
 * The duel's write lane on Canton (C9b), the ticket lane's shape (`submitter/ticket-lane.ts`):
 *
 *   journal   the intent is recorded BEFORE the call; its id is the ledger commandId (never re-sent under another)
 *   write     POST /api/ledger/games/duel/<action> {commandId, matchId, cardIndex?, side?} → the web server submits as
 *             the leased seat's party only: `Arena_OpenDuel`, `Open_Join`, a pick (a firm quote accepted with the duel's
 *             tag, then `Duel_RecordPick`), `Open_Cancel`, and the cranks any named player may run (`Duel_Lock`, the
 *             seat's own `Duel_Score`, `Duel_Finalize`, the three refunds)
 *   confirm   only when no answer came: GET /api/ledger/commands/<id> until landed, absent or 90 s
 *
 * What the Solana arena needed and Canton does not is refused plainly: the deck's reveal is the deckmaster's (a seat
 * never holds its preimage), and there are no agent keys or arena credit (the seat's server acts for it, and a decided
 * pot is paid straight into each player's cash).
 */
import type { ArenaIntent } from "@agari/core/games";
import type { PhaseListener, TxOutcome } from "@agari/core/ports";
import { diagnosis, type Diagnosis, type Signature } from "@agari/core/types";
import { ledgerRequest } from "../provider/ledger-api";
import { duelWriteReplyWire, type DuelAction, type DuelWriteReply } from "../provider/games-wire";
import { pollCommand, type SeatLaneDeps } from "../submitter/seat-lane";
import { forgetArenaReads } from "./source";

/** What one confirmed pick actually did, from the ledger's own record of the leg. */
export type ArenaPickOutcome =
  | { status: "confirmed"; txHash: Signature; quantity: bigint; costBase: bigint; refundBase: bigint }
  | { status: "refused"; diagnosis: Diagnosis }
  | { status: "reverted"; diagnosis: Diagnosis; txHash?: Signature }
  | { status: "unknown"; diagnosis: Diagnosis; txHash?: Signature };

type Confirmed = Extract<DuelWriteReply, { kind: "confirmed" }>;
type Write = { status: "confirmed"; reply: Confirmed } | { status: "refused"; diagnosis: Diagnosis } | { status: "unknown"; diagnosis: Diagnosis };

const refused = (d: Diagnosis) => ({ status: "refused" as const, diagnosis: d });

function isLane(ctx: unknown): ctx is SeatLaneDeps {
  const c = ctx as Partial<SeatLaneDeps> | null;
  return Boolean(c && typeof c.wallet === "string" && c.journal && typeof c.nowMs === "function");
}

/** One journaled duel write and its outcome; an answer that never came is asked of the ledger by the same id. */
async function journaledDuel(deps: SeatLaneDeps, intent: ArenaIntent, action: DuelAction, body: { matchId: string; cardIndex?: number; side?: "up" | "down" }, onPhase?: PhaseListener): Promise<Write> {
  const record = await deps.journal.record({ kind: intent.kind, wallet: deps.wallet, summary: `duel ${action} ${body.matchId.slice(0, 10)}${body.cardIndex === undefined ? "" : ` #${body.cardIndex}`}` });
  onPhase?.("submitted");
  const send = () => ledgerRequest(`/games/duel/${action}`, { method: "POST", body: { ...body, commandId: record.id }, wire: duelWriteReplyWire });
  const done = async (r: Confirmed): Promise<Write> => {
    await deps.journal.markSent(record.id, r.updateId);
    await deps.journal.markConfirmed(record.id);
    onPhase?.("confirmed", { txHash: r.updateId });
    return { status: "confirmed", reply: r };
  };
  try {
    const reply = await send();
    if (reply.ok && reply.value.kind === "confirmed") return await done(reply.value);
    if (reply.ok && reply.value.kind === "refused") {
      await deps.journal.markFailed(record.id, reply.value.diagnosis.technical);
      return refused(reply.value.diagnosis);
    }
    if (!reply.ok && reply.status !== null && reply.status < 500) {
      await deps.journal.markFailed(record.id, reply.diagnosis.technical);
      return refused(reply.diagnosis);
    }
    await deps.journal.markUnknown(record.id);
    onPhase?.("confirming");
    const settled = await pollCommand(record.id, deps);
    if (settled?.status === "landed") {
      const again = await send();
      if (again.ok && again.value.kind === "confirmed") return await done(again.value);
    }
    if (settled?.status === "failed" || settled?.status === "absent") {
      await deps.journal.markFailed(record.id, settled.diagnosis?.technical ?? settled.status);
      return refused(settled.diagnosis ?? diagnosis("send-unknown", "the write did not land"));
    }
    onPhase?.("unknown");
    const why = reply.ok ? ("diagnosis" in reply.value ? reply.value.diagnosis.technical : "no answer") : reply.diagnosis.technical;
    return { status: "unknown", diagnosis: diagnosis("send-unknown", why) };
  } finally {
    forgetArenaReads();
  }
}

const asTx = (w: Write): TxOutcome => (w.status === "confirmed" ? { status: "confirmed", txHash: w.reply.updateId } : w);

/** Every duel write except a pick (which reports what it bought): `ctx` is the seat lane the submitter binds. */
export async function submitArenaTx(ctx: unknown, intent: ArenaIntent, onPhase?: PhaseListener): Promise<TxOutcome> {
  if (!isLane(ctx)) return refused(diagnosis("signer-required", "a duel write needs a seat session"));
  switch (intent.kind) {
    case "arena-create":
      return asTx(await journaledDuel(ctx, intent, "open", { matchId: intent.matchId }, onPhase));
    case "arena-join":
      return asTx(await journaledDuel(ctx, intent, "join", { matchId: intent.matchId }, onPhase));
    case "arena-cancel":
      return asTx(await journaledDuel(ctx, intent, "cancel", { matchId: intent.matchId }, onPhase));
    case "arena-lock":
      return asTx(await journaledDuel(ctx, intent, "lock", { matchId: intent.matchId }, onPhase));
    case "arena-settle-card":
      return asTx(await journaledDuel(ctx, intent, "settle", { matchId: intent.matchId, cardIndex: intent.cardIndex }, onPhase));
    case "arena-finalize":
      return asTx(await journaledDuel(ctx, intent, "finalize", { matchId: intent.matchId }, onPhase));
    case "arena-refund-unjoined":
      return asTx(await journaledDuel(ctx, intent, "refund-unjoined", { matchId: intent.matchId }, onPhase));
    case "arena-refund-unrevealed":
      return asTx(await journaledDuel(ctx, intent, "refund-unrevealed", { matchId: intent.matchId }, onPhase));
    case "arena-pick":
    case "arena-pick-for": {
      const r = await submitArenaPickWrite(ctx, intent, onPhase);
      return r.status === "confirmed" ? { status: "confirmed", txHash: r.txHash } : r;
    }
    case "arena-reveal":
      return refused(diagnosis("contract-revert", "the deck is opened by the venue's deckmaster, which alone holds its preimage; the ledger checks it with sha256"));
    case "arena-claim":
      return refused(diagnosis("already-claimed", "a decided pot is paid straight into each player's cash on Canton: there is nothing to claim"));
    case "arena-authorize":
    case "arena-release-agent":
      return refused(diagnosis("contract-revert", "Canton has no agent keys: the seat's own server acts for the seat under its lease"));
  }
}

/** One card, one side: a firm quote within the tier's per-card cap, accepted with the duel's tag and recorded on the match. */
export async function submitArenaPickWrite(ctx: unknown, intent: Extract<ArenaIntent, { kind: "arena-pick" | "arena-pick-for" }>, onPhase?: PhaseListener): Promise<ArenaPickOutcome> {
  if (!isLane(ctx)) return refused(diagnosis("signer-required", "a duel pick needs a seat session"));
  if (intent.kind === "arena-pick-for" && intent.player !== ctx.wallet) return refused(diagnosis("signer-required", "a seat picks only for itself"));
  const w = await journaledDuel(ctx, intent, "pick", { matchId: intent.matchId, cardIndex: intent.cardIndex, side: intent.pick }, onPhase);
  if (w.status !== "confirmed") return w;
  return { status: "confirmed", txHash: w.reply.updateId, quantity: w.reply.quantity ?? 0n, costBase: w.reply.costBase ?? 0n, refundBase: 0n };
}
