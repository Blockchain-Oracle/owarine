import type { NextRequest } from "next/server";
import {
  payoutClaimRequestWire, strategyDeactivateRequestWire, strategyPublishRequestWire, strategyRunnerRequestWire, strategySubscribeRequestWire,
  strategyUnsubscribeRequestWire, strategyUpdateRequestWire,
} from "@agari/markets";
import { jsonBody, refusal, replyWith, seatFromRequest } from "@/lib/seat.server";

/**
 * The seat's own registry writes (C8f), each `actAs` the lease's seat party ONLY, under the commandId the client
 * journaled:
 *
 *   publish      License_Publish (sealed by the text's SHA-256)       {commandId, runner, envelope, feeBase, metadata}
 *   update       Strategy_Update (new text or fee; envelope kept)       {commandId, strategyId, metadata, feeBase}
 *   runner       Strategy_SetRunner                                     {commandId, strategyId, runner}
 *   deactivate   Strategy_Deactivate                                    {commandId, strategyId}
 *   subscribe    Subscriber_Subscribe (copy, mirror by spec, or fade)   {commandId, strategyId, grantId, feeBase, fade}
 *   unsubscribe  Subscriber_Unsubscribe                                 {commandId, strategyId, fade}
 *   claim        Payout_Claim on every waiting creator payout           {commandId}
 *
 * `runner` names the agent that will trade (the house runner's party, or the seat's own address to self-host).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIONS = ["publish", "update", "runner", "deactivate", "subscribe", "unsubscribe", "claim"] as const;
type Action = (typeof ACTIONS)[number];
const isAction = (a: string): a is Action => (ACTIONS as readonly string[]).includes(a);

export async function POST(request: NextRequest, context: { params: Promise<{ action: string }> }) {
  const { action } = await context.params;
  if (!isAction(action)) return refusal("unknown", `no strategy action ${action}`, 404);
  const auth = await seatFromRequest(request, { write: true });
  if (!auth.ok) return auth.response;
  const { server, lease } = auth.seat;
  const seat = { party: lease.party, leaseId: lease.leaseId, address: lease.address };
  const a = server.agents;
  const raw = await jsonBody(request);
  const bad = (what: string) => refusal("unknown", `expected ${what}`, 400);
  switch (action) {
    case "publish": {
      const b = strategyPublishRequestWire.safeParse(raw);
      if (!b.success) return bad("{commandId, runner, envelope, feeBase, metadata}");
      return replyWith(await a.publish(seat, { journalId: b.data.commandId, runner: b.data.runner, envelope: b.data.envelope, feeBase: b.data.feeBase, metadata: b.data.metadata }));
    }
    case "update": {
      const b = strategyUpdateRequestWire.safeParse(raw);
      if (!b.success) return bad("{commandId, strategyId, metadata, feeBase}");
      return replyWith(await a.update(seat, { journalId: b.data.commandId, strategyId: b.data.strategyId, metadata: b.data.metadata, feeBase: b.data.feeBase }));
    }
    case "runner": {
      const b = strategyRunnerRequestWire.safeParse(raw);
      if (!b.success) return bad("{commandId, strategyId, runner}");
      return replyWith(await a.setRunner(seat, { journalId: b.data.commandId, strategyId: b.data.strategyId, runner: b.data.runner }));
    }
    case "deactivate": {
      const b = strategyDeactivateRequestWire.safeParse(raw);
      if (!b.success) return bad("{commandId, strategyId}");
      return replyWith(await a.deactivate(seat, { journalId: b.data.commandId, strategyId: b.data.strategyId }));
    }
    case "subscribe": {
      const b = strategySubscribeRequestWire.safeParse(raw);
      if (!b.success) return bad("{commandId, strategyId, grantId, feeBase, fade}");
      return replyWith(await a.subscribe(seat, { journalId: b.data.commandId, strategyId: b.data.strategyId, grantId: b.data.grantId, feeBase: b.data.feeBase, fade: b.data.fade }));
    }
    case "unsubscribe": {
      const b = strategyUnsubscribeRequestWire.safeParse(raw);
      if (!b.success) return bad("{commandId, strategyId, fade}");
      return replyWith(await a.unsubscribe(seat, { journalId: b.data.commandId, strategyId: b.data.strategyId, fade: b.data.fade }));
    }
    case "claim": {
      const b = payoutClaimRequestWire.safeParse(raw);
      if (!b.success) return bad("{commandId}");
      return replyWith(await a.claimPayouts(seat, { journalId: b.data.commandId }));
    }
  }
}
