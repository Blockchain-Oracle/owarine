/**
 * Commits what `consider` decided (Shijima `commit.ts`): the record and every row that must exist with it in ONE
 * transaction, then the action itself. Writing first is the point: whatever happens to the process, the database
 * already knows what was intended. A practice desk moves its paper ledger at the quote net of the fee. A live desk
 * (C8f, K-090) sends the buy or sell through the owner's `DeskMandate` with the record's hash as the decision hash
 * (the operator client posts the attestors' marks at the Window's fair price right before it), and trusts its own
 * record only once the mandate's `nextHead(prev, seq, hash)` equals the sealed head.
 */
import { buildDecisionBody, deskCopy, GENESIS_SLOT, hashRecord, nameOf, netOfFee, paperFeeBpsFor, ZERO_HASH, type ApprovalOf, type PaperLedger } from "@agari/core/desk";
import { CLUSTER_ID } from "@agari/core/constants";
import type { Hash32 } from "@agari/core/types";
import { buy, cantonChainHead, DeskSendError, DeskSendUnknownError, sell } from "@agari/markets/desk";
import { errorText } from "../../runtime/env";
import { APPROVAL_TTL_SEC, DEADLINE_SEC, type Considered } from "./consider";
import { REFERENCE_REFRESH_SEC } from "./market";
import { loadPaper, paperFill, savePaper } from "./paper";
import type { RunnerContext, WakeFrame, WakeRecord } from "./types";

export { REFERENCE_REFRESH_SEC };
const DEFERRAL_REVISIT_SEC = 24 * 3600;

const iso = (sec: number) => new Date(sec * 1000).toISOString();

export interface CommitResult extends WakeRecord {
  seq: number;
  hash: Hash32;
  moved: boolean;
  note?: string;
}

/** The record body for this desk at this slot; `paper` is the ledger after the check for a practice desk. */
export function bodyFor(frame: WakeFrame, k: Considered | null, slot: { seq: number; prevHash: string }, outcome: Considered["outcome"], extra: { approvalOf?: ApprovalOf | null; paper?: PaperLedger | null; trigger?: string } = {}) {
  const chain = frame.standing.kind === "live" ? { seqBefore: Number(frame.standing.chain.seq), headBefore: frame.standing.chain.head } : { seqBefore: 0, headBefore: ZERO_HASH };
  return buildDecisionBody({
    chainId: CLUSTER_ID[frame.desk.cluster],
    owner: frame.desk.owner,
    slot: { seq: slot.seq, prevHash: slot.prevHash as Hash32 },
    chain,
    decidedAtIso: iso(frame.nowSec),
    wake: { scheduledForIso: iso(frame.scheduledForSec), trigger: extra.trigger ?? frame.trigger },
    mode: frame.desk.mode,
    mandate: { version: frame.mandateRow.version, fingerprint: frame.mandateRow.fingerprint as Hash32 },
    valuation: frame.valuation,
    need: k?.need ?? null,
    deferral: k?.deferral ? { decisionSeq: k.deferral.baseline.decisionSeq, decidedAtIso: iso(k.deferral.baseline.decidedAtSec), stillStanding: k.deferral.status === "standing", endedBecause: k.deferral.endedBecause } : null,
    blockers: k?.blockers ?? [],
    evidence: k?.pack?.evidence ?? [],
    answer: k?.answer ?? null,
    gate: k?.gate ?? null,
    override: k?.override ?? null,
    outcome,
    ask: k?.ask ?? null,
    approvalOf: extra.approvalOf ?? null,
    preview: k?.preview ?? null,
    paper: extra.paper ?? null,
  });
}

/** A record with no candidate: nothing to do, not looking, a checkpoint, a failed read. */
export async function appendPlainRecord(ctx: RunnerContext, frame: WakeFrame, outcome: Considered["outcome"], summary: string, trigger?: string): Promise<CommitResult> {
  const paper = frame.standing.kind === "practice" ? await loadPaper(ctx.q, frame.desk.id) : null;
  const saved = await ctx.q.appendRecord({
    deskId: frame.desk.id,
    body: (slot) => bodyFor(frame, null, slot, outcome, { paper, ...(trigger ? { trigger } : {}) }),
    privateNotes: null,
    outcome,
    summary,
    mode: frame.desk.mode,
    wakeId: frame.wakeId,
    decidedAtSec: frame.nowSec,
  });
  return { seq: saved.seq, hash: saved.hash as Hash32, outcome, summary, moved: false };
}

/** Saves the record and everything that must exist with it, then acts if the desk is acting. */
export async function commit(ctx: RunnerContext, frame: WakeFrame, k: Considered, approval?: { id: string; of: ApprovalOf }): Promise<CommitResult> {
  const { desk } = frame;
  const c = k.need.candidate;
  const practiceFill = frame.standing.kind === "practice" && k.outcome === "WOULD_HAVE_ACTED" && k.preview && k.quote;
  const ledgerBefore = frame.standing.kind === "practice" ? await loadPaper(ctx.q, desk.id) : null;
  const routeLabels = k.quote?.routeLabels ?? [];
  const ledgerAfter = practiceFill && ledgerBefore && k.preview ? paperFill(ledgerBefore, { side: c.side, symbol: c.symbol, amountIn: k.preview.amountIn, quoteOut: k.preview.expectedOut }, routeLabels) : ledgerBefore;
  const expiresAtSec = frame.scheduledForSec + APPROVAL_TTL_SEC;

  const saved = await ctx.q.appendRecord({
    deskId: desk.id,
    body: (slot) => bodyFor(frame, k, slot, k.outcome, { approvalOf: approval?.of ?? null, paper: ledgerAfter }),
    privateNotes: k.pack?.privateNotes ?? null,
    outcome: k.outcome,
    summary: k.summary,
    mode: desk.mode,
    symbol: c.symbol,
    side: c.side,
    wakeId: frame.wakeId,
    decidedAtSec: frame.nowSec,
    alongside: async (tx, seq) => {
      if (approval) await ctx.q.markApprovalExecuted({ approvalId: approval.id, executedSeq: seq }, tx);
      if (k.deferral && k.deferral.status !== "standing") await ctx.q.endDeferral({ id: k.deferral.row.id, because: k.deferral.endedBecause ?? "", nowSec: frame.nowSec }, tx);
      if (k.newDeferralBaseline) await ctx.q.createDeferral({ deskId: desk.id, symbol: c.symbol, kind: k.newDeferralBaseline.kind, baseline: { ...k.newDeferralBaseline, decisionSeq: seq }, decisionSeq: seq, revisitAtSec: frame.nowSec + DEFERRAL_REVISIT_SEC }, tx);
      if (k.ask && k.preview) await ctx.q.createApproval({ deskId: desk.id, recordSeq: seq, symbol: c.symbol, side: c.side, askedBecause: k.ask, amountIn: k.preview.amountIn.toString(), expectedOut: k.preview.expectedOut.toString(), summary: k.summary, askedAtSec: frame.nowSec, expiresAtSec }, tx);
      if (practiceFill && ledgerAfter && k.preview) {
        await savePaper(ctx.q, desk.id, ledgerAfter, frame.nowSec, tx);
        await ctx.q.insertAction({ deskId: desk.id, recordSeq: seq, kind: c.side, state: "confirmed", signature: null, symbol: c.symbol, amountIn: k.preview.amountIn.toString(), expectedOut: k.preview.expectedOut.toString(), minOut: k.gate.minOut.toString(), amountOut: netOfFee(k.preview.expectedOut, paperFeeBpsFor(routeLabels)).toString(), countedE6: k.gate.countedE6.toString(), deadlineSec: null, sentAtSec: frame.nowSec }, tx);
      }
    },
  });
  const base: CommitResult = { seq: saved.seq, hash: saved.hash as Hash32, outcome: k.outcome, summary: k.summary, moved: Boolean(practiceFill) };
  if (frame.standing.kind === "practice" || !k.willAct || !k.preview || k.preview.deadlineSec === null) return base;
  return sendLive(ctx, frame, k, base);
}

/** The live send: reference, route, the instruction, the sealed head checked, the action row resolved. */
async function sendLive(ctx: RunnerContext, frame: WakeFrame, k: Considered, base: CommitResult): Promise<CommitResult> {
  const { desk } = frame;
  const c = k.need.candidate;
  const chain = frame.standing.kind === "live" ? frame.standing.chain : null;
  const client = ctx.operator;
  if (!chain || !client || !k.preview || !k.quote) return base;
  const actionId = await ctx.q.insertAction({ deskId: desk.id, recordSeq: base.seq, kind: c.side, state: "attempting", signature: null, symbol: c.symbol, amountIn: k.preview.amountIn.toString(), expectedOut: k.preview.expectedOut.toString(), minOut: k.gate.minOut.toString(), countedE6: k.gate.countedE6.toString(), deadlineSec: k.preview.deadlineSec, sentAtSec: frame.nowSec });
  const failed = async (state: "refused" | "reverted", signature: string | null, why: string): Promise<CommitResult> => {
    await ctx.q.resolveAction({ id: actionId, state, signature, error: why, nowSec: frame.nowSec });
    const summary = deskCopy.line.failed(why);
    const follow = await appendPlainRecord(ctx, frame, "NOT_EXECUTED", summary);
    frame.say(`  record ${follow.seq}: NOT_EXECUTED. ${summary}`);
    return { ...base, moved: false, note: `FAILED: ${why}` };
  };
  try {
    // The desk's own address names its mandate; the operator client finds it, quotes, posts the marks and seals.
    const action = { owner: (desk.address ?? desk.owner) as never, mint: c.mint as never, amountIn: k.preview.amountIn, minOut: k.gate.minOut, deadlineSec: k.preview.deadlineSec ?? frame.nowSec + DEADLINE_SEC, decisionHash: base.hash, quote: k.quote, note: `${c.side} ${nameOf(c.symbol)} (record ${base.seq})` };
    const sent = c.side === "buy" ? await buy(client, action) : await sell(client, action);
    const expectedHead = cantonChainHead(chain.head, sent.sealed.seq, base.hash);
    const sealedOk = sent.sealed.decisionHash.toLowerCase() === base.hash.toLowerCase() && sent.sealed.head.toLowerCase() === expectedHead.toLowerCase() && sent.sealed.seq === chain.seq + 1n;
    const out = sent.events.flatMap((e) => (e.name === "Bought" ? [e.data.tokenOut] : e.name === "Sold" ? [e.data.usdcOut] : []))[0] ?? null;
    await ctx.q.resolveAction({ id: actionId, state: "confirmed", signature: sent.signature, chainSeq: Number(sent.sealed.seq), amountOut: out?.toString() ?? null, nowSec: frame.nowSec });
    await ctx.q.markSealed({ deskId: desk.id, seq: base.seq, signature: sent.signature, chainSeq: Number(sent.sealed.seq) });
    await ctx.q.setChainPosition({ deskId: desk.id, chainSeq: Number(sent.sealed.seq), chainHead: sent.sealed.head, nowSec: frame.nowSec });
    if (!sealedOk) {
      const why = `the chain sealed record ${base.seq} in ${sent.signature} with a head this desk cannot reproduce`;
      await ctx.q.setDeskState({ deskId: desk.id, state: "needs_attention", reason: why, actor: "desk", nowSec: frame.nowSec });
      return { ...base, moved: true, note: `tx ${sent.signature} HEAD MISMATCH` };
    }
    return { ...base, moved: true, note: `tx ${sent.signature}` };
  } catch (error) {
    if (error instanceof DeskSendUnknownError) {
      await ctx.q.resolveAction({ id: actionId, state: "unknown", signature: error.signature, error: error.message, nowSec: frame.nowSec });
      ctx.holding.add(desk.id);
      return { ...base, moved: false, note: `UNKNOWN: ${error.signature}; holding new sends until reconciled` };
    }
    if (error instanceof DeskSendError) return failed(error.stage === "landed" ? "reverted" : "refused", error.signature, error.message);
    return failed("refused", null, errorText(error));
  }
}

/** `GENESIS_SLOT` and `hashRecord` are re-exported for the drive's print of a record's fingerprint. */
export { GENESIS_SLOT, hashRecord };
