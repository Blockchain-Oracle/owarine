import { ensureMarkets, getCollateral, loadCollateral, syncClock } from "@agari/markets";
import type { OpsRoute } from "@agari/markets/ops/agents";
import { agentSessionFrom } from "../agents/from-env";
import type { VenueContext } from "../venue/context";
import { xAcquireReplyDelivery, xBeginReplyPost, xClaimMention, xFinishReplyPost, xMarkInterruptedReplyPosts, xReceiptByMention, xRelayStateGet, xRelayStateSet, xStopReplyDelivery, xRecoveryCandidates, xStoreRecoveredReceipt, xSetStageHealth, xHasUnresolvedBroadcast, xIsRelayReply, xSuppressRelayReplyDeliveries } from "@agari/db";
import type { Hash32 } from "@agari/core/types";
import { readRelayEnv, RELAY_ENV } from "./env";
import { executeMention, resolveVenue, xReceiptUpsert } from "./execute";
import { rettiwtTransport } from "./rettiwt";
import { startReplyDelivery } from "./reply-delivery";
import { renderReplyCardPng } from "./reply-card";
import { createXExecutionJournal } from "./execution-journal";
import { recoverXExecutions, resolveXExecution } from "./execution-recovery";
import { pollMentionCycle } from "./poll-cycle";
import { opsMarketsEnv } from "../../runtime/markets-env";

const HEARTBEAT_MS = 60_000;
const CURSOR_KEY = "mentions.since_id";

/**
 * The X mention relay (doc 03 §X prediction rail): bounded polling of the account's mentions,
 * one receipt per mention, idempotent by tweet id, executing from an isolated x-executor
 * session under the owner's EXECUTOR grant, through the account's own session (`rettiwt.ts`). Without
 * its key it heartbeats what is missing and never crashes; without `X_POSTING_ENABLED` it executes but
 * does not reply.
 */
/** Every stage of an unconfigured relay reads "Disabled": it is off on purpose, not unverified. */
export async function markRelayDisabled(): Promise<void> {
  await Promise.all((["polling", "execution", "delivery"] as const).map((stage) => xSetStageHealth(stage, "disabled")));
}

export async function startXRelay(log: (why: string) => void, o: { venue?: VenueContext; routes?: { quotes: OpsRoute; exitQuotes: OpsRoute } | null } = {}): Promise<void> {
  const reading = readRelayEnv();
  if (!reading.ok) {
    const why = `not configured — set ${reading.missing.join(", ")}`;
    // C9e: with a store to write to, the relay says it is switched off ("Disabled" on /trade-from-x) rather than
    // leaving every stage "Not verified"; refreshed each heartbeat so it never reads as out of date.
    const disabled = () => (process.env.DATABASE_URL ? markRelayDisabled().catch(() => undefined) : undefined);
    log(why);
    void disabled();
    setInterval(() => {
      log(why);
      void disabled();
    }, HEARTBEAT_MS);
    return;
  }
  const relay = reading.env;
  const marketsEnv = opsMarketsEnv(process.env.VENUE_ID);
  ensureMarkets(marketsEnv);
  await loadCollateral();
  await syncClock();
  const venueId = await resolveVenue(marketsEnv.venueId);
  if (!venueId) {
    log("no live venue — nothing to execute against");
    setInterval(() => log("no live venue"), HEARTBEAT_MS);
    return;
  }
  const execution = createXExecutionJournal();
  // C8f: the executor is an agent party acting through each bound seat's EXECUTOR grant (`Grant_AcceptQuote`).
  const made = agentSessionFrom({ authority: "x-executor", partyEnv: "X_EXECUTOR_PARTY", ...(o.venue ? { venue: o.venue } : {}), routes: o.routes ?? null, journal: execution.journal });
  if (!made.ok) {
    log(`not configured — ${made.why}`);
    setInterval(() => log(`not configured — ${made.why}`), HEARTBEAT_MS);
    return;
  }
  const session = made.session;
  // The way to X: the account's own session. Replies go out as the account only when asked for.
  const transport = rettiwtTransport(relay.rettiwtApiKey, relay.handle);
  let botAuthorId: string;
  for (;;) {
    try {
      botAuthorId = await transport.authenticatedAuthorId();
      const suppressed = await xSuppressRelayReplyDeliveries();
      if (suppressed) log(`${suppressed} recursive reply delivery(s) suppressed; original acknowledgements retained`);
      break;
    } catch {
      // A provider/DB outage must hold this relay without rejecting main's detached actor startup.
      log("relay startup paused: account identity or reply suppression could not be verified; retrying in one minute");
      await xSetStageHealth("polling", "error").catch(() => {});
      await new Promise(resolve => setTimeout(resolve, HEARTBEAT_MS));
    }
  }
  if (!relay.postingEnabled) transport.reply = null;
  const delivery = {
    store: { acquire: xAcquireReplyDelivery, receipt: xReceiptByMention, beginPost: xBeginReplyPost, sent: xFinishReplyPost, stop: xStopReplyDelivery, markInterrupted: xMarkInterruptedReplyPosts },
    transport, decimals: getCollateral().decimals, symbol: getCollateral().symbol,
    imagesEnabled: relay.replyImagesEnabled, render: renderReplyCardPng, log,
    health: (state: "ok" | "idle" | "error" | "disabled") => xSetStageHealth("delivery", state, relay.replyImagesEnabled),
  };
  log(`executor ${session.address} on venue ${venueId}; via ${transport.describe()}; posting ${transport.reply ? "on (as the account)" : `off (set ${RELAY_ENV.posting}=1)`}`);
  // Delivery has its own busy gate and error boundary; it never schedules financial execution.
  startReplyDelivery(delivery);

  let busy = false;
  const cycle = async () => {
    if (busy) return;
    busy = true;
    try {
      // Recovery reads chain truth even when X itself is unavailable. It never re-enters executeMention.
      await xSetStageHealth("execution", "idle");
      if (session.contracts.deployment) await recoverXExecutions({
        candidates: xRecoveryCandidates, save: xStoreRecoveredReceipt, resolve: resolveXExecution, log,
      });
      const processed = await pollMentionCycle({
        getCursor: () => xRelayStateGet(CURSOR_KEY), setCursor: id => xRelayStateSet(CURSOR_KEY, id),
        fetch: async since => {
          try {
            const mentions = await transport.fetchMentions(since);
            await xSetStageHealth("polling", "ok");
            return mentions;
          } catch (error) {
            await xSetStageHealth("polling", "error");
            throw error;
          }
        },
        claim: receipt => xClaimMention(receipt, Boolean(transport.reply)), receipt: xReceiptByMention,
        isRelayReply: async mention => {
          if (!await xIsRelayReply(mention, botAuthorId)) return false;
          await xSuppressRelayReplyDeliveries(mention.id);
          return true;
        },
        canExecute: async () => {
          if (!await xHasUnresolvedBroadcast(session.address)) return true;
          await xSetStageHealth("execution", "error");
          log("execution paused: an earlier broadcast has no confirmed hash; the attempt will not be sent again");
          return false;
        },
        save: async receipt => {
          await xReceiptUpsert(receipt);
          await xSetStageHealth("execution", receipt.status === "unknown" ? "error" : "ok");
        },
        execute: mention => execution.forMention(mention.id, () => executeMention({ session, venueId, log, checkpoint: xReceiptUpsert }, mention)),
      });
      if (!processed) log("mention scan completed; no new execution");
    } catch (error) {
      log(`cycle failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      busy = false;
    }
  };
  await cycle();
  setInterval(() => void cycle(), relay.pollMs);
}
