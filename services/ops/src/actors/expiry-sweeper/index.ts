/**
 * The expiry sweeper (review B5): archives every firm quote nobody accepted (`Quote_Expire`, and `BuyQuote_Expire` for
 * the C7a exits) once `validUntil + 5 s` has
 * passed (the ledger's own slack, so accept and expire are exact complements and exactly one wins). The locked venue
 * stake comes back as a shard and joins the pool. An inactive quote was accepted first: that is done, not a failure.
 */
import { TEMPLATE_IDS } from "@owarine/daml";
import { cmd, decodeBuyQuote, decodeQuote, expireBuyCommandId, expireCommandId, failureText, isInactive, pick, readActive, submit, type RoleSession } from "@owarine/markets/ops/canton";
import { runActor, type PassResult } from "../../runtime/actor";
import type { ShardPool } from "../quote-issuer/pool";
import { venueCashCreated } from "../quote-issuer/pooled-submit";
import { emitVenueEvent } from "../venue/events";

/** `expireSlackSec` in `PM/Quote.daml`, plus a second for ledger time trailing the wall clock. */
export const EXPIRE_AFTER_SEC = 5 + 1;
const PER_PASS = 20;

export function startExpirySweeper(input: { venue: RoleSession; pool: ShardPool | null; log: (why: string) => void }): { stop: () => void } {
  const counters = { expired: 0, alreadyAccepted: 0, failed: 0 };
  const pass = async (): Promise<PassResult> => {
    const nowSec = Math.floor(Date.now() / 1000);
    const acs = await readActive(input.venue, [TEMPLATE_IDS.Quote, TEMPLATE_IDS.BuyQuote]);
    // Buy quotes and buy-backs (C7a exits) alike: both lock venue stake until accepted or swept.
    const quotes = [
      ...pick(acs, TEMPLATE_IDS.Quote, decodeQuote).map((q) => ({ cid: q.cid, venue: q.data.venue, validUntilSec: q.data.validUntilSec, marketId: q.data.marketId, buy: false })),
      ...pick(acs, TEMPLATE_IDS.BuyQuote, decodeBuyQuote).map((q) => ({ cid: q.cid, venue: q.data.venue, validUntilSec: q.data.validUntilSec, marketId: q.data.termsCid, buy: true })),
    ].filter((q) => q.venue === input.venue.party);
    const due = quotes.filter((q) => q.validUntilSec + EXPIRE_AFTER_SEC <= nowSec).slice(0, PER_PASS);
    const notes = await Promise.all(
      due.map(async (q) => {
        try {
          const out = await submit(input.venue, q.buy
            ? { commandId: expireBuyCommandId(q.cid), commands: [cmd.expireBuyQuote(q.cid)] }
            : { commandId: expireCommandId(q.cid), commands: [cmd.expireQuote(q.cid)] });
          if (out.kind === "dry") return out.note;
          input.pool?.complete([], new Set(), venueCashCreated(out));
          counters.expired++;
          if (!q.buy) emitVenueEvent({ kind: "expired", marketId: q.marketId, quoteCid: q.cid, atMs: Date.now() });
          return null;
        } catch (error) {
          if (isInactive(error)) {
            counters.alreadyAccepted++;
            return null;
          }
          counters.failed++;
          return `expire ${q.cid.slice(0, 12)}… failed: ${failureText(error)}`;
        }
      }),
    );
    for (const n of notes) if (n) input.log(n);
    const live = quotes.length - due.length;
    return {
      why: `${live} live quotes; expired ${counters.expired}, already accepted ${counters.alreadyAccepted}, failed ${counters.failed}${input.venue.dryRun ? " · DRY RUN" : ""}`,
      detail: { ...counters, live },
      nextDelayMs: due.length === PER_PASS ? 200 : 3_000,
    };
  };
  return runActor({ name: "expiry-sweeper", log: input.log, dryRun: input.venue.dryRun, everyMs: 3_000, pass });
}
