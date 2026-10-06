/**
 * The venue's offer to hold a pre-open resting call (C7c, K-235): `POST /internal/resting-offers`. Like a quote, the
 * offer is the venue's consent and the seat's own place is the seat's; ops never spends a seat's cash.
 *
 * The checks the reference made on `user_place_order` for a post-only call, on Canton shapes:
 *   a Window that is listed (before its bell, with the seconds an offer needs)   else `market-not-trading`, or
 *     `post-only-would-cross` when the Window already quotes a price the call reaches ("Your price would fill immediately")
 *   a call sized on the Window's own grid, as the ticket sized it                 else a requote with the fresh quote
 *   at most 16 calls (and offers) of the seat on the Window                        else `too-many-resting`
 * and then `RestDesk_Offer`, which fetches the terms itself, so the offer carries the Window's own times and grid and
 * lives at most until the bell. Before the bell the venue has no ladder for a Window (it prices from the opening print),
 * so nothing can cross yet; the call meets the venue's ladder at the bell (`rule.ts`).
 *
 * The contract is the web's (`@agari/markets/server` `OpsRestingRequest`, `restingOfferReplyWire`):
 *   request  `{ marketId, side, stakeBase, priceCents, restUntil, displayedEscrowBase, party, leaseId }`, bigints as strings
 *   reply    `{ kind: "offer", offerCid, rested, validUntilMs }` · `{ kind: "requote", quote }` · `{ kind: "refused", diagnosis }`
 */
import { randomUUID } from "node:crypto";
import { MAX_RESTING_PER_SEAT, restExpirySec, restingQuote } from "@agari/core/orders";
import { diagnosis, type Diagnosis, type DiagnosisKind } from "@agari/core/types";
import { TEMPLATE_IDS } from "@agari/daml";
import { cmd, createdOf, failureText, isIndefinite, refusalId, restOfferCommandId, submit, type Active, type RoleSession, type TermsC } from "@agari/markets/ops/canton";
import { CASH_DECIMALS } from "@agari/markets/server";
import type { LadderBoard } from "../market-maker/seat/ladder-board";
import { fillableLots, MIN_OFFER_LIFE_SEC, OFFER_LIFE_SEC } from "./rule";
import { parseRestingRequest, type RestingOfferRequest } from "./parse";
import { venueModeRefusalNow } from "../../runtime/venue-mode";

export interface OfferDeps {
  venue: RoleSession;
  /** The Window's terms by the app's market id, or null when the venue holds none. */
  terms: (marketId: string) => Promise<Active<TermsC> | null>;
  deskCid: () => Promise<string>;
  board: LadderBoard;
  /** Parties that are never a seat (the infrastructure roles): a call for one is refused. */
  infrastructure: ReadonlySet<string>;
  /** Seats being drained: no new calls. */
  draining?: ReadonlySet<string>;
  /** How many calls and unplaced offers `owner` holds on the Window (the venue reads them all: it signs every one). */
  countOpen: (owner: string, damlMarketId: string) => Promise<number>;
  nowMs?: () => number;
  log: (why: string) => void;
}

type Answer = { status: number; body: unknown };

const refused = (kind: DiagnosisKind, technical: string): Answer => ({ status: 200, body: { kind: "refused", diagnosis: diagnosis(kind, technical) satisfies Diagnosis } });

/** Ledger refusals of `RestDesk_Offer` onto the app's kinds. */
function refusalKind(id: string | null): DiagnosisKind {
  if (id === "stdlib.daml.com/deadline-exceeded") return "market-not-trading";
  if (id === "abu-pm/bad-grid" || id === "abu-pm/bad-rest-expiry") return "invalid-price";
  return "contract-revert";
}

export function createOfferHandler(d: OfferDeps): (body: unknown) => Promise<Answer> {
  const nowMs = d.nowMs ?? Date.now;
  return async (body) => {
    const req = parseRestingRequest(body);
    if (typeof req === "string") return { status: 400, body: { diagnosis: diagnosis("unknown", `bad resting call: ${req}`) } };
    return offer(d, nowMs, req);
  };
}

export async function offer(d: OfferDeps, nowMs: () => number, req: RestingOfferRequest): Promise<Answer> {
  if (d.infrastructure.has(req.party)) return refused("unknown", "an infrastructure party is not a seat");
  if (d.draining?.has(req.party)) return refused("market-not-trading", "this seat is draining: no new calls");
  const modeWhy = venueModeRefusalNow("open-position");
  if (modeWhy) return refused("market-not-trading", modeWhy);
  const terms = await d.terms(req.marketId);
  if (!terms) return refused("market-not-trading", "the venue holds no such Window");
  const t = terms.data;
  const nowSec = Math.floor(nowMs() / 1000);

  // A Window that has started is no longer listed: it has (or is about to have) the venue's own price.
  if (nowSec >= t.tradingStartSec) {
    const entry = d.board.get({ marketId: req.marketId });
    const ownTicks = req.priceCents * 10;
    if (entry && entry.state === "quoting" && fillableLots({ priceTicks: ownTicks, lots: 1n }, req.side === "up" ? entry.up : entry.down).lots > 0n) {
      return refused("post-only-would-cross", `the Window has opened and the venue already quotes ${req.side} at or under ${req.priceCents}¢: a call would fill now`);
    }
    return refused("market-not-trading", "the Window has started: a call can only rest before the bell");
  }
  if (t.tradingStartSec - nowSec < MIN_OFFER_LIFE_SEC) return refused("market-not-trading", "the bell is seconds away: too late to rest a call");

  // The ticket sized this on the Series grid; the Window's own grid is the ledger's. A different escrow is a requote.
  const grid = { lotBase: t.cashUnit * 1000n, tickBase: t.cashUnit, cashUnit: t.cashUnit, minLots: 1n };
  const sized = restingQuote({ side: req.side, priceCents: req.priceCents, stakeBase: req.stakeBase, grid, decimals: CASH_DECIMALS, quotedAtMs: nowMs() });
  if (!sized.ok) return refused(sized.blocker === "no-price" ? "invalid-price" : "below-min-quantity", sized.blocker === "too-small" ? "the stake does not buy one lot at this price" : "no stake to rest");
  if (sized.quote.maxCostBase !== req.displayedEscrowBase) return { status: 200, body: { kind: "requote", quote: sized.quote } };

  const expiresAtSec = restExpirySec(nowSec, { tradingStartSec: t.tradingStartSec, lockAtSec: t.lockAtSec }, req.restUntil);
  if (expiresAtSec === null) return refused("market-not-trading", "no expiry is left for a call on this Window");

  if ((await d.countOpen(req.party, t.marketId)) >= MAX_RESTING_PER_SEAT) return refused("too-many-resting", `the seat already holds ${MAX_RESTING_PER_SEAT} calls on this Window`);

  const requestId = randomUUID();
  const callRef = `rc-${requestId}`;
  const validUntilSec = Math.min(nowSec + OFFER_LIFE_SEC, t.tradingStartSec);
  const started = nowMs();
  try {
    const deskCid = await d.deskCid();
    const out = await submit(d.venue, {
      commandId: restOfferCommandId(requestId),
      commands: [
        cmd.offerRest(deskCid, {
          owner: req.party, termsCid: terms.cid, callRef, side: req.side === "up" ? "SideUp" : "SideDown", lots: sized.sizing.lots,
          priceTicks: sized.sizing.ownTicks, expiresAtSec, validUntilSec,
        }),
      ],
    });
    if (out.kind === "dry") return refused("not-deployed", `DRY RUN: ${out.note}`);
    const created = createdOf(out.created, TEMPLATE_IDS.RestingOffer)[0];
    if (!created) return refused("unknown", "the offer landed without a contract");
    d.log(`rest offer ${t.marketId} ${req.side} ${sized.sizing.lots} lots @ ${sized.sizing.ownTicks} (escrow ${sized.sizing.escrowBase}) to ${req.party.split("::")[0]} until ${new Date(validUntilSec * 1000).toISOString()} in ${nowMs() - started} ms`);
    return {
      status: 200,
      body: {
        kind: "offer",
        offerCid: created.contractId,
        validUntilMs: validUntilSec * 1000,
        rested: {
          marketId: req.marketId, side: req.side, callRef, lots: sized.sizing.lots, priceTicks: sized.sizing.yesTicks,
          contractsRaw: sized.quote.contractsRaw, escrowBase: sized.sizing.escrowBase, expireSec: expiresAtSec,
        },
      },
    };
  } catch (error) {
    if (isIndefinite(error)) return refused("send-unknown", `the ledger did not answer in time (offer ${requestId})`);
    d.log(`rest offer ${t.marketId} refused: ${failureText(error)}`);
    return refused(refusalKind(refusalId(error)), refusalId(error) ?? failureText(error).slice(0, 200));
  }
}
