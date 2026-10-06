import {
  ClockIcon,
  CoinsIcon,
  EyeOffIcon,
  LockIcon,
  ShieldIcon,
  TargetIcon,
  TrendingUpIcon,
  TrophyIcon,
  ZapIcon,
  type LucideIcon,
} from "lucide-react";

/**
 * The page's content, as data — the reference keeps `steps`, `mechanics` and `faqs` as
 * arrays inside the component; they live here so each fact can carry its source.
 *
 * Sources (asserted, not assumed): `anchor/programs/agari-events/src/instructions/resolve_rules.rs`
 * (the settle and void decisions, PD-3's tie rule), `docs/plan/specs/prints.md` §2-§6 and
 * `services/ops/config/price-sources.json` (which signed source, and its thresholds),
 * `packages/core/src/claims/payout.ts` (payout rule), `packages/core/src/lifecycle/headroom.ts`
 * and `constants/timing.ts` (no-entry buffer), `packages/core/src/copy/question.ts` (what UP
 * means), `packages/markets/src/submitter/steps/send.ts` (IOC takers), `packages/markets/src/
 * provider/fees.ts` (the fee is read from chain), `packages/core/src/constants/faucet.ts`.
 * The lane, session, halt and void facts live next door in `sessions.ts`.
 */

export type Tone = "mint" | "blue";

export interface Step {
  number: number;
  title: string;
  description: string;
  icon: LucideIcon;
  tone: Tone;
}

export const STEPS: readonly Step[] = [
  {
    number: 1,
    title: "Take a Seat",
    description:
      "Take a seat: this browser makes a signing key that cannot leave it, and the venue leases the seat a Canton party of its own with demo credits in it. No wallet app to install, and no network fee.",
    icon: CoinsIcon,
    tone: "mint",
  },
  {
    number: 2,
    title: "Pick a Window",
    description:
      "Each Window is a stock — TSLA, NVDA, AAPL and six more — on a cadence lane the venue lists: 5m, 15m and 1h through the session, the overnight Gap, and the 24/7 token lane. A basket, a small group of pre-IPO companies bet on together, runs on that 24/7 lane too, scored as an index in points rather than a price. The line is the opening print, the signed price recorded at the open of the round.",
    icon: TargetIcon,
    tone: "blue",
  },
  {
    number: 3,
    title: "Trade UP or DOWN",
    description:
      "Go UP if the Window closes at or above its opening print, DOWN if below — a close exactly on the line pays UP. Stake in credits and see the exact quote for your size before you sign.",
    icon: ZapIcon,
    tone: "mint",
  },
  {
    number: 4,
    title: "Collect Payout",
    description:
      "When the Window closes, three oracle parties sign the price for that second and the resolver decides the Window. Winning contracts pay 1 credit each; losing contracts pay 0; a void returns what you paid, stake and fee. The venue settles every leg in a batch, so a win lands in your credits without you signing anything; Portfolio shows each payout.",
    icon: TrophyIcon,
    tone: "blue",
  },
];

export interface Mechanic {
  title: string;
  description: string;
  icon: LucideIcon;
}

export const MECHANICS: readonly Mechanic[] = [
  {
    title: "Firm-Quote Pricing",
    description:
      "The venue publishes a price ladder and gives your seat a firm quote for your exact size. The quote holds while you take it, and the venue is the other side of every call.",
    icon: CoinsIcon,
  },
  {
    title: "Live Price",
    description:
      "The chart plots the same feed the Window settles on, so the distance to the line is the distance that matters. A tick that has stopped is shown frozen with its age, never as live.",
    icon: TrendingUpIcon,
  },
  {
    title: "Fast Rounds",
    description:
      "Windows run back to back on fixed cadences while their lane is awake. Entries close inside a no-entry buffer before expiry — 40% of the round, never under 30 s or over 5 min — so a call cannot be made after the answer is in.",
    icon: ClockIcon,
  },
  {
    title: "Ledger Settlement",
    description:
      "Each position is a Daml contract on the Canton ledger that only your seat's party and the venue can see. Every print and settlement opens on the proof page.",
    icon: ShieldIcon,
  },
];

/** The real quote fields — `Quote` in `packages/core/src/types/trading.ts`. */
export const QUOTE_FIELDS: readonly [string, string][] = [
  ["stake", "what you put in"],
  ["contracts", "how many the quote fills for that stake"],
  ["avg price", "the average fill across the ladder's levels"],
  ["max cost", "the firm quote you confirm — a fill can never cost more"],
  ["payout if right", "contracts × 1.00, the whole amount"],
  ["fee", "charged with the fill and held in your leg; kept by the venue only when the Window settles, returned on a void"],
  ["odds", "the price of UP in cents — the venue's quoted probability"],
];

export interface FeeItem {
  title: string;
  body: string;
}

export const FEES: readonly FeeItem[] = [
  {
    title: "The Fee",
    body: "Charged once, with the fill, and held in your leg rather than paid out: the venue keeps it only when the Window settles, and a void returns it with your stake. It is ⌈contracts × rate × p × (1 − p)⌉ at price p, so it is largest at even odds and falls to zero at the ends; the default rate of 100 bps is about 0.25% of the payout at 50¢. The quote shows it before you confirm, and the receipt prints it.",
  },
  {
    title: "Network Fees",
    body: "There is no network fee on Canton and nothing to sign for gas. The venue runs every settlement itself.",
  },
  {
    title: "Total Cost",
    body: "Cost = contracts × the quoted price, plus the fee. A winning contract pays the full 1.00, so a call bought under 1.00 profits if it is right by more than its fee.",
  },
];

export interface SettlementStep {
  step: string;
  label: string;
  desc: string;
}

export const SETTLEMENT_STEPS: readonly SettlementStep[] = [
  { step: "1", label: "Window Closes", desc: "The round reaches its scheduled expiry — the second its settlement price is asked about." },
  { step: "2", label: "The Print Is Recorded", desc: "Three oracle parties each post a signed print for that boundary: a 1-minute candle close from Coinbase, Kraken and Bitstamp for BTC and ETH, and the lane's own source (RedStone, Alpaca, Jupiter Price v3 or PreStocks) for the rest. The Window needs at least 2 of the 3 to agree; a price with no quorum is never used." },
  { step: "3", label: "Settlement", desc: "The resolver party compares the closing print with the opening one, once: a Window resolves or voids exactly once. Close at or above the open pays UP, and a close exactly on the line pays UP; anything below pays DOWN. Prints that disagree by more than the policy allows void the Window instead." },
  { step: "4", label: "Payout", desc: "Winning contracts pay 1 credit each, and the venue keeps the fee held in each leg. The venue settles every leg itself, in a batch, so you are paid without signing anything; if it ever failed to, after the refund time your seat could take its stake and fee back on its own. Portfolio shows each payout." },
];

export interface ArchitectureCard {
  title: string;
  body: string;
  icon: LucideIcon;
}

export const ARCHITECTURE: readonly ArchitectureCard[] = [
  {
    title: "Private Positions",
    body: "Your side and size are a Daml contract only your seat's party and the venue can see — not other players, not an outsider. The \"Who can see this\" chip says so on every position.",
    icon: EyeOffIcon,
  },
  {
    title: "One Ledger, No Fee",
    body: "A call is final when the Canton ledger commits it, with no network fee, and settlement lands as soon as the resolver has the closing quorum.",
    icon: LockIcon,
  },
  {
    title: "Rules in Daml",
    body: "Daml choices hold the stake, resolve the Window from the oracle quorum and pay the winner. The venue cannot resolve a Window itself, and cannot take a seat's cash.",
    icon: ShieldIcon,
  },
];

export interface Faq {
  question: string;
  answer: string;
}

export const FAQS: readonly Faq[] = [
  {
    question: "What currency does Agari use?",
    answer: "Credits, the demo collateral the venue issues on the Canton test network. Taking a seat credits it with demo cash; there is no fee token to find.",
  },
  {
    question: "When can I trade?",
    answer: "Regular Windows run while US markets are open, 09:30 to 16:00 ET on a trading day. The Gap Window covers the weekend, from Friday's close to Monday's open. The token lane, on tokenised stock, never closes. The session chip says which of those the hour is, and counts down to the next boundary.",
  },
  {
    question: "Can I make a call while the market is closed?",
    answer: "Yes. The venue lists the next session's first Windows at the close, and a call on one rests at your price. Nothing fills before the open boundary; if the venue's quote reaches your price in the first minute after the bell, it fills at your price, and if it doesn't the stake returns as venue credit. You can also choose to let it rest until the Window locks.",
  },
  {
    question: "How is the outcome decided?",
    answer: "When the Window closes, a signed price for that second is recorded on it. Close at or above the opening print and UP wins — a tie pays UP too; below it and DOWN wins. The resolver does the comparison under the Daml rules, and the receipt links both prints with the oracle parties that signed them.",
  },
  {
    question: "How much do I win?",
    answer: "Each winning contract pays 1 credit; a losing contract pays 0; a void returns what you paid, stake and fee. Your cost is the quoted price you paid plus the fee, so profit is payout minus cost.",
  },
  {
    question: "Do I need a wallet?",
    answer: "No. Take a seat: the key is made in your browser and cannot leave it, and the venue leases the seat a Canton party. Agari never holds your key.",
  },
  {
    question: "Is this real money?",
    answer: "No. Agari runs on the Canton test network with demo credits the venue issues. Nothing here is worth anything anywhere else, and there is no way to move it off.",
  },
  {
    question: "How does Agari ensure fair pricing?",
    answer: "The venue quotes from a published price ladder, and your seat gets a firm quote for your exact size. The quote holds while you take it, so a fill can never cost more than the quote you confirmed.",
  },
  {
    question: "Can I sell a position before settlement?",
    answer: "Yes, until the Window locks. Cash out on an open bet sells it back to the venue at its quoted bid, never below the floor it shows. If there is no bid it says there is no exit liquidity and nothing is sold. Once the Window locks a position can't be sold; it pays at settlement.",
  },
];

/**
 * Baskets (S19, D-124) and the desk (S21, D-126). Sources: `packages/core/src/market/baskets.ts` (the index in points,
 * base 1,000 at frozen bases, one read of every member), `docs/plan/specs/desk.md` §0 (the promise), §4.5 (the
 * program's checks in order), §8 (needs, the pre-gate, timing, the grade), `packages/core/src/desk/{needs,pregate,
 * timing,gate,record}.ts`, `services/ops/src/actors/desk-runner/` (the wake and its order). These tables run under the
 * desk's banned-word test (`features/desk/copy.test.ts`): no promise, "cover" never "hedge", "mark" for the premium.
 */

export const BASKETS = {
  body: "A basket is a small group of pre-IPO companies followed together: AI Labs (OpenAI, Anthropic), Frontier AI, Prediction Markets, Defense & Space, and All PreStocks. Each is scored as one equal-weight index in points, base 1,000 at prices frozen when the basket was listed, computed from one PreStocks read of every member. A basket Window is an ordinary one-hour Window on the 24/7 lane: UP if the index closes at or above its opening print, DOWN below. If any member is missing from the read, the Window voids rather than settle on a mixture.",
  uses: [
    ["Predict", "an Up/Down Window on the index, with demo credits"],
    ["Cover", "hold two or more members and one Down bet covers the basket, sized at 10% of what you hold"],
    ["Hold", "a desk keeps the basket for you inside limits you set: practice today, live desks planned"],
  ] as const satisfies readonly [string, string][],
} as const;

export type DeskStepKind = "arithmetic" | "ai" | "program";

export interface DeskStep {
  step: string;
  label: string;
  desc: string;
  /** Which kind of work the step is: plain arithmetic, the one model call, or the program on Solana. */
  kind: DeskStepKind;
}

/** The order the desk works in on every wake; nine of the ten steps are arithmetic, and one is a question. */
export const DESK_STEPS: readonly DeskStep[] = [
  { step: "1", label: "It wakes", kind: "arithmetic", desc: "Every hour on the hour, around the clock, and also when money arrives, when a held company moves 3% within an hour, or when you press Check now. Every wake ends in a written decision, even when nothing was done." },
  { step: "2", label: "It reconciles", kind: "arithmetic", desc: "It compares the ledger's sequence number and sealed head with its own record before trusting either. Money that arrived from outside re-bases the loss limit; a holding PreStocks has paused or frozen stops the desk." },
  { step: "3", label: "It values the desk", kind: "arithmetic", desc: "Cash plus every priced holding, at the half-hour average of the venue's own attested prices. A holding with no price is listed, never valued at zero, and never traded." },
  { step: "4", label: "It checks your loss limit", kind: "arithmetic", desc: "If the desk is worth more than your limit below its baseline, it stops everything and tells you. Nothing else runs that hour." },
  { step: "5", label: "It finds what drifted", kind: "arithmetic", desc: "Which holdings sit further from their target than you allow, and at least 5.5% because a trade costs about 1.1% each way. Sales first, then buys, largest drift first; a buy never takes cash below your cash target." },
  { step: "6", label: "It runs the pre-gate", kind: "arithmetic", desc: "Eleven rules that can stop a candidate before any question is asked: the desk is not active, the name is not allowed, the venue's price is missing or stale, the name is above your premium ceiling, there is no quote at your size, the quote is more than 8% from the venue's price, the price is moving fast, transfers are paused, the account is frozen, the route is too large, or it did the same thing minutes ago." },
  { step: "7", label: "It asks one question", kind: "ai", desc: "Timing, and only timing: given the evidence, do the whole action now, part of it (25, 50 or 75%), wait, or decline? The answer must fit a strict shape; a promise, a forbidden word or a malformed answer is thrown away and the desk does nothing that hour. The model never chooses what to hold, and never more than the candidate it was shown." },
  { step: "8", label: "It runs the limits check", kind: "arithmetic", desc: "Plain arithmetic that mirrors the ledger's rules, rounding included: your caps, the floor on what must come back, the premium ceiling, a gap of at most 3% from the price's own average and a cost of at most 2.5%. What the ledger would refuse is never sent." },
  { step: "9", label: "It writes first, then acts", kind: "program", desc: "The record is written and fingerprinted before anything moves. A practice desk moves its paper ledger at the quote net of PreStocks' 1% fee. A live desk (planned) will post the venue's attested price, then send the buy or sell; the Daml rules check their own list in order and seal the fingerprint in the same command, or refuse the whole thing." },
  { step: "10", label: "It grades itself a day later", kind: "arithmetic", desc: "The timing it chose against acting at once, from the hourly prices since. Under 0.25% is “no real difference”. Neutral both ways, never a win stamp." },
];

/** What the `agari-desk` program checks on chain, whatever the desk decided (`desk.md` §0, §4.5). */
export const DESK_PROGRAM_ENFORCES: readonly [string, string][] = [
  ["Your money", "only you can withdraw, and only to your own seat"],
  ["Caps", "a cap per action and a cap per fixed 24-hour window, counted on the ledger"],
  ["Names", "only the companies you allowed can be bought; a disallowed one can still be sold"],
  ["The reference", "a venue-attested price no older than 15 minutes, or nothing trades"],
  ["The premium", "a buy may not pay more than your ceiling above the reference the oracle parties attest"],
  ["The band", "at least 92% of the fair amount must come back, or the command fails"],
  ["Exact spend", "the desk's balance must change by exactly the amount sent, and a desk account slipped into the route fails the trade"],
  ["The record", "every action, the did-nothing checkpoint included, advances a sealed hash chain in the same command"],
];

/** The promise's other half: what no instruction, mode or model answer can make the desk do. */
export const DESK_NEVER: readonly [string, string][] = [
  ["Withdraw", "it has no instruction that pays anyone but you"],
  ["Choose what you hold", "the basket, the weights and the cash sleeve are yours; it decides only when"],
  ["Trade past a limit", "the ledger refuses it before any money moves, whatever the desk decided"],
  ["Act on a stale price", "no fresh attested reference, no trade"],
  ["Spend in practice", "a practice desk moves a paper ledger and never sends a transaction"],
  ["Promise a return", "its words are checked against a banned list before they reach you"],
  ["Hide a quiet check", "every “nothing to do” is written down; those are the proof it was awake"],
];
