/**
 * What a seat party still holds (plan §4 "Seats", C9d): the one test both recyclers (ops' seat drain and the web's
 * lease fallback) apply before a `draining` seat goes back to `free`. A seat is recycled only when, read AS its party,
 * it holds none of:
 *
 *   - legs       any open `Leg` (a leg on a resolved market is the settler's, one on a live market ops closes out),
 *   - quotes     a live offer made to it: `Quote`, `BuyQuote`, a ticket quote, a Boost exit, an Earn supply/withdraw,
 *   - tickets    an open `RangeRound`, `ParlayTicket` or `BoostPosition` (the ticket keeper settles or refunds them),
 *   - shares     an Earn `LpShare` (ops' drain redeems them through the Earn desk),
 *   - duels      a `DuelOpen` or `DuelMatch` it plays in (the duel settler finalises or refunds it),
 *   - agents     an `AgentGrant` it gave, a `Subscription` it holds or a `DeskMandate` it owns (ops' drain ends them),
 *   - creator    (C8i) an active `Strategy` it published or a `CreatorPayout` made to it (ops' drain deactivates the one
 *                and claims the other into the seat's cash), so the next visitor inherits neither.
 *
 * Its `VenueCash` is not a blocker: the recycler withdraws it as the seat's own choice before the seat is freed.
 */
import { AGENT_TEMPLATE_IDS, GAMES_TEMPLATE_IDS, TEMPLATE_IDS, TICKET_TEMPLATE_IDS } from "@agari/daml";
import { LedgerError, type CreatedEvent, type LedgerClient, type Party } from "@agari/ledger";
import { templateSuffix } from "../ops/canton/decode";

export type HoldingKind = "legs" | "quotes" | "tickets" | "shares" | "duels" | "agents" | "creator";

export interface SeatHoldings {
  party: Party;
  /** Contracts that keep the seat draining, by kind. */
  counts: Record<HoldingKind, number>;
  /** The seat's own `VenueCash` contracts, withdrawn when it is recycled. */
  cash: string[];
  /** The seat's Earn shares (provider, reserve, shares), for the drain to redeem. */
  lpShares: Array<{ cid: string; reserveId: string; shares: bigint }>;
}

type Rule = { kind: HoldingKind; field: string | readonly string[]; live?: boolean; when?: (arg: Record<string, unknown>) => boolean };

/** Template suffix (`:Module:Entity`) → which kind it is and which field names the seat. */
const RULES = new Map<string, Rule>([
  [templateSuffix(TEMPLATE_IDS.Leg), { kind: "legs", field: "owner" }],
  [templateSuffix(TEMPLATE_IDS.Quote), { kind: "quotes", field: "user", live: true }],
  [templateSuffix(TEMPLATE_IDS.BuyQuote), { kind: "quotes", field: "user", live: true }],
  [templateSuffix(TEMPLATE_IDS.SupplyQuote), { kind: "quotes", field: "provider", live: true }],
  [templateSuffix(TEMPLATE_IDS.WithdrawQuote), { kind: "quotes", field: "provider", live: true }],
  [templateSuffix(TICKET_TEMPLATE_IDS.RangeQuote), { kind: "quotes", field: "user", live: true }],
  [templateSuffix(TICKET_TEMPLATE_IDS.ParlayQuote), { kind: "quotes", field: "user", live: true }],
  [templateSuffix(TICKET_TEMPLATE_IDS.BoostQuote), { kind: "quotes", field: "user", live: true }],
  [templateSuffix(TICKET_TEMPLATE_IDS.BoostExitQuote), { kind: "quotes", field: "user", live: true }],
  [templateSuffix(TICKET_TEMPLATE_IDS.RangeRound), { kind: "tickets", field: "owner" }],
  [templateSuffix(TICKET_TEMPLATE_IDS.ParlayTicket), { kind: "tickets", field: "owner" }],
  [templateSuffix(TICKET_TEMPLATE_IDS.BoostPosition), { kind: "tickets", field: "owner" }],
  [templateSuffix(TEMPLATE_IDS.LpShare), { kind: "shares", field: "provider" }],
  [templateSuffix(GAMES_TEMPLATE_IDS.DuelOpen), { kind: "duels", field: ["creator", "challenger"] }],
  [templateSuffix(GAMES_TEMPLATE_IDS.DuelMatch), { kind: "duels", field: ["creator", "challenger"] }],
  [templateSuffix(TEMPLATE_IDS.AgentGrant), { kind: "agents", field: "owner" }],
  [templateSuffix(AGENT_TEMPLATE_IDS.Subscription), { kind: "agents", field: "subscriber" }],
  [templateSuffix(AGENT_TEMPLATE_IDS.DeskMandate), { kind: "agents", field: "owner" }],
  // A deactivated Strategy stays on the ledger (nothing archives it) but can no longer trade, change or take subscribers.
  [templateSuffix(AGENT_TEMPLATE_IDS.Strategy), { kind: "creator", field: "creator", when: (a) => a.active !== false }],
  [templateSuffix(AGENT_TEMPLATE_IDS.CreatorPayout), { kind: "creator", field: "creator" }],
]);

/** One query per package, so a package this participant never vetted reads as holding nothing of it. */
export const SEAT_HOLDING_QUERIES: ReadonlyArray<readonly string[]> = [
  [TEMPLATE_IDS.VenueCash, TEMPLATE_IDS.Leg, TEMPLATE_IDS.Quote, TEMPLATE_IDS.BuyQuote, TEMPLATE_IDS.SupplyQuote, TEMPLATE_IDS.WithdrawQuote, TEMPLATE_IDS.LpShare, TEMPLATE_IDS.AgentGrant],
  [TICKET_TEMPLATE_IDS.RangeQuote, TICKET_TEMPLATE_IDS.RangeRound, TICKET_TEMPLATE_IDS.ParlayQuote, TICKET_TEMPLATE_IDS.ParlayTicket, TICKET_TEMPLATE_IDS.BoostQuote, TICKET_TEMPLATE_IDS.BoostPosition, TICKET_TEMPLATE_IDS.BoostExitQuote],
  [GAMES_TEMPLATE_IDS.DuelOpen, GAMES_TEMPLATE_IDS.DuelMatch],
  [AGENT_TEMPLATE_IDS.Subscription, AGENT_TEMPLATE_IDS.DeskMandate, AGENT_TEMPLATE_IDS.Strategy, AGENT_TEMPLATE_IDS.CreatorPayout],
];

const CASH = templateSuffix(TEMPLATE_IDS.VenueCash);
const LP = templateSuffix(TEMPLATE_IDS.LpShare);

const emptyCounts = (): Record<HoldingKind, number> => ({ legs: 0, quotes: 0, tickets: 0, shares: 0, duels: 0, agents: 0, creator: 0 });

/** Pure over the seat's active contracts: what it holds at `nowMs`. Contracts naming another party are ignored. */
export function holdingsOf(party: Party, events: readonly CreatedEvent[], nowMs: number): SeatHoldings {
  const out: SeatHoldings = { party, counts: emptyCounts(), cash: [], lpShares: [] };
  for (const e of events) {
    const suffix = templateSuffix(e.templateId);
    const arg = (e.createArgument ?? {}) as Record<string, unknown>;
    if (suffix === CASH) {
      if (arg.owner === party) out.cash.push(e.contractId);
      continue;
    }
    const rule = RULES.get(suffix);
    if (!rule) continue;
    const fields = typeof rule.field === "string" ? [rule.field] : rule.field;
    if (!fields.some((f) => arg[f] === party)) continue;
    if (rule.when && !rule.when(arg)) continue;
    if (rule.live) {
      const until = Date.parse(String(arg.validUntil));
      // An offer whose time cannot be read counts as live: holding a seat a little longer is the safe mistake.
      if (Number.isFinite(until) && until <= nowMs) continue;
    }
    out.counts[rule.kind] += 1;
    if (suffix === LP) out.lpShares.push({ cid: e.contractId, reserveId: String(arg.reserveId), shares: BigInt(String(arg.shares ?? "0")) });
  }
  return out;
}

export const holdingsTotal = (h: SeatHoldings): number => Object.values(h.counts).reduce((s, n) => s + n, 0);
export const isSeatEmpty = (h: SeatHoldings): boolean => holdingsTotal(h) === 0;

/** "1 leg, 2 duels": what keeps a seat draining, for logs and `/status`. */
export function holdingsText(h: SeatHoldings): string {
  const names: Record<HoldingKind, [string, string]> = {
    legs: ["leg", "legs"], quotes: ["live quote", "live quotes"], tickets: ["ticket", "tickets"], shares: ["Earn share", "Earn shares"], duels: ["duel", "duels"], agents: ["agent grant", "agent grants"],
    creator: ["live strategy or fee payout", "live strategies or fee payouts"],
  };
  const parts = (Object.keys(names) as HoldingKind[]).filter((k) => h.counts[k] > 0).map((k) => `${h.counts[k]} ${names[k][h.counts[k] === 1 ? 0 : 1]}`);
  return parts.length ? parts.join(", ") : "nothing";
}

/** A package the participant does not know: nothing of it can exist, so it holds nothing. */
function isUnknownPackage(error: unknown): boolean {
  if (!(error instanceof LedgerError)) return false;
  const code = error.code ?? "";
  return /PACKAGE|TEMPLATES_OR_INTERFACES_NOT_FOUND|NAMES_NOT_FOUND/.test(code);
}

/** Reads the seat's holdings AS the seat, at the ledger end. Any other read failure throws: the seat stays draining. */
export async function readSeatHoldings(client: LedgerClient, party: Party, nowMs: number): Promise<SeatHoldings> {
  const events: CreatedEvent[] = [];
  for (const templateIds of SEAT_HOLDING_QUERIES) {
    try {
      const r = await client.activeContracts({ parties: [party], templateIds: [...templateIds] });
      for (const c of r.contracts) events.push(c.createdEvent);
    } catch (error) {
      if (!isUnknownPackage(error)) throw error;
    }
  }
  return holdingsOf(party, events, nowMs);
}
