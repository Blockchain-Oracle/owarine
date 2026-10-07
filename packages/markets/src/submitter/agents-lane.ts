/**
 * The agents' lane on Canton (C8f), the ticket lane's shape (`ticket-lane.ts`) for the seat's grant and registry writes:
 *
 *   journal   the intent is recorded BEFORE the write; its id is the ledger commandId (`agent:<uuid>`), never re-sent
 *             under another
 *   write     POST /api/ledger/agents/<vault|strategies>/<action> {commandId, …} → submit-and-wait as the seat's party
 *   confirm   only when no answer came: GET /api/ledger/commands/<id> until landed, absent or 90 s; a landed one is
 *             asked for again under the same id, which the server answers with the original transaction
 *
 * Every `vault-*` and `strategy-*` intent maps here. On Canton the seat's cash IS the trading balance, so a deposit
 * into it or a withdrawal out of it moves nothing and is answered as such (never faked as a transaction); a grant
 * "deposit and grant" funds the grant straight from the seat's cash. No retries anywhere.
 */
import type { IntentRecord, PhaseListener, TxOutcome, VaultIntent } from "@owarine/core/ports";
import { encodeStrategyMetadata, type StrategyIntent } from "@owarine/core/strategies";
import { diagnosis, type Diagnosis } from "@owarine/core/types";
import { toWire } from "../provider/ledger-wire";
import { agentsWriteReplyWire, type AgentsWriteReply } from "../provider/agents-wire";
import { ledgerRequest } from "../provider/ledger-api";
import { cantonNotLive } from "../stub/not-deployed";
import { pollCommand, type SeatLaneDeps } from "./seat-lane";

const refused = (d: Diagnosis): TxOutcome => ({ status: "refused", diagnosis: d });

/** The honest answer for a move between two names of the same cash. */
export const SAME_CASH = "On Canton the seat's cash is the Trading Balance: there is nothing to move between them";
const PRIVATE_NOT_LIVE = cantonNotLive("private");

async function journaled(deps: SeatLaneDeps, entry: Pick<IntentRecord, "kind" | "summary">, path: string, body: Record<string, unknown>, onPhase?: PhaseListener): Promise<TxOutcome> {
  const record = await deps.journal.record({ ...entry, wallet: deps.wallet });
  onPhase?.("submitted");
  const send = () => ledgerRequest(path, { method: "POST", body: { ...(toWire(body) as Record<string, unknown>), commandId: record.id }, wire: agentsWriteReplyWire });
  const done = async (r: Extract<AgentsWriteReply, { kind: "confirmed" }>): Promise<TxOutcome> => {
    await deps.journal.markSent(record.id, r.updateId);
    await deps.journal.markConfirmed(record.id);
    onPhase?.("confirmed", { txHash: r.updateId });
    return { status: "confirmed", txHash: r.updateId };
  };
  const reply = await send();
  if (reply.ok && reply.value.kind === "confirmed") return done(reply.value);
  if (reply.ok && reply.value.kind === "refused") {
    await deps.journal.markFailed(record.id, reply.value.diagnosis.technical);
    return refused(reply.value.diagnosis);
  }
  await deps.journal.markUnknown(record.id);
  onPhase?.("confirming");
  const settled = await pollCommand(record.id, deps);
  if (settled?.status === "landed") {
    const again = await send();
    if (again.ok && again.value.kind === "confirmed") return done(again.value);
  }
  if (settled?.status === "failed" || settled?.status === "absent") {
    await deps.journal.markFailed(record.id, settled.diagnosis?.technical ?? settled.status);
    return refused(settled.diagnosis ?? diagnosis("send-unknown", "the write did not land"));
  }
  onPhase?.("unknown");
  const why = reply.ok ? ("diagnosis" in reply.value ? reply.value.diagnosis.technical : "no answer") : reply.diagnosis.technical;
  return { status: "unknown", diagnosis: diagnosis("send-unknown", why) };
}

/** Every `vault-*` intent on Canton. */
export function agentsVaultLane(deps: SeatLaneDeps, intent: VaultIntent, onPhase?: PhaseListener): Promise<TxOutcome> {
  const w = (summary: string, action: string, body: Record<string, unknown>) => journaled(deps, { kind: intent.kind, summary }, `/agents/vault/${action}`, body, onPhase);
  switch (intent.kind) {
    case "vault-grant":
    case "vault-deposit-and-grant": {
      const t = intent.terms;
      return w(`grant ${t.kind} to ${t.actor} with ${t.budgetBase}`, "open", { kind: t.kind, actor: t.actor, caps: t.caps, expiresAtSec: t.expiresAtSec, budgetBase: t.budgetBase });
    }
    case "vault-fund-grant":
      return w(`add ${intent.amountBase} to grant #${intent.grantId}`, "fund", { grantId: intent.grantId, amountBase: intent.amountBase });
    case "vault-revoke":
      return w(`revoke grant #${intent.grantId}`, "revoke", { grantId: intent.grantId });
    case "vault-deposit":
    case "vault-withdraw":
      return Promise.resolve(refused(diagnosis("grant-refused", SAME_CASH)));
    case "vault-move-private":
    case "vault-withdraw-private":
      return Promise.resolve(refused(diagnosis("not-deployed", PRIVATE_NOT_LIVE)));
    case "vault-key-top-up":
      return Promise.resolve(refused(diagnosis("grant-refused", "a seat already trades in one tap: there is no session key to top up on Canton")));
    case "vault-crank-settle":
      return Promise.resolve(refused(diagnosis("grant-refused", "the venue settles every leg at resolution into its owner's cash: there is nothing to crank")));
    case "vault-sweep":
      return Promise.resolve(refused(diagnosis("grant-refused", "a seat holds no venue credit to sweep on Canton: settlement pays its cash directly")));
  }
}

/** Every `strategy-*` intent on Canton. */
export function agentsStrategyLane(deps: SeatLaneDeps, intent: StrategyIntent, onPhase?: PhaseListener): Promise<TxOutcome> {
  const w = (summary: string, action: string, body: Record<string, unknown>) => journaled(deps, { kind: intent.kind, summary }, `/agents/strategies/${action}`, body, onPhase);
  switch (intent.kind) {
    case "strategy-publish":
      return w(`publish ${intent.metadata.name}`, "publish", { runner: intent.runner, envelope: intent.envelope, feeBase: intent.feeBase, metadata: encodeStrategyMetadata({ ...intent.metadata, spec: intent.spec }) });
    case "strategy-update":
      return w(`revise strategy #${intent.strategyId}`, "update", { strategyId: intent.strategyId, metadata: encodeStrategyMetadata({ ...intent.metadata, spec: intent.spec }), feeBase: intent.feeBase });
    case "strategy-subscribe":
      return w(`copy strategy #${intent.strategyId}`, "subscribe", { strategyId: intent.strategyId, grantId: intent.grantId, feeBase: intent.feeBase, fade: false });
    case "strategy-fade":
      return w(`fade strategy #${intent.strategyId}`, "subscribe", { strategyId: intent.strategyId, grantId: intent.grantId, feeBase: intent.feeBase, fade: true });
    case "strategy-unsubscribe":
      return w(`stop copying strategy #${intent.strategyId}`, "unsubscribe", { strategyId: intent.strategyId, fade: false });
    case "strategy-unfade":
      return w(`stop fading strategy #${intent.strategyId}`, "unsubscribe", { strategyId: intent.strategyId, fade: true });
    case "strategy-deactivate":
      return w(`deactivate strategy #${intent.strategyId}`, "deactivate", { strategyId: intent.strategyId });
    case "strategy-claim-fees":
      return w("claim creator fee payouts", "claim", {});
  }
}

/** A creator-only write the port's intents do not name: rotating the runner. */
export function setStrategyRunnerLane(deps: SeatLaneDeps, strategyId: bigint, runner: string, onPhase?: PhaseListener): Promise<TxOutcome> {
  return journaled(deps, { kind: "strategy-update", summary: `set strategy #${strategyId}'s runner to ${runner}` }, "/agents/strategies/runner", { strategyId, runner }, onPhase);
}
/** The same write as the `strategy-claim-fees` intent, for a caller holding a lane rather than a submitter. */
export function claimCreatorPayoutsLane(deps: SeatLaneDeps, onPhase?: PhaseListener): Promise<TxOutcome> {
  return agentsStrategyLane(deps, { kind: "strategy-claim-fees" }, onPhase);
}
