/**
 * "The Leg and Who Sees It" and "Built On" (C10f, C-N34): the position as the Daml rules hold it, two-sided and fully
 * backed, and who receives it. Sources: `daml/abu-pm-main/daml/PM/Leg.daml` (the payout table in its header, the
 * `refundAfter` stale refund), `docs/business/gtm.md` "Economic flows", and the matrix in `features/privacy-matrix`.
 * Pure, so the phone's How It Works reads the same words.
 */
export const LEG = {
  lead: "A call is one contract, a Leg, with two signatories: your seat and the venue. Both sides of the bet are inside it, so every leg is fully backed before the Window closes, and nobody else's node ever receives it.",
  formulaLabel: "What the Leg holds",
  formula: ["you pay = contracts × p + the fee", "the venue locks = contracts × (1 − p)", "the winner gets = contracts × 1.00"],
  rows: [
    ["Firm quote", "the venue prices your exact size off its ladder and holds it for 20 s; it fills at that price or not at all"],
    ["Backing", "your stake and the venue's are both escrowed in the leg, so the pair always covers the payout"],
    ["Settle", "the venue pays in a batch after the resolver decides; you sign nothing"],
    ["Void", "missing or disagreeing prints void the Window, and each leg returns its stake and fee"],
    ["If the venue stalls", "after the leg's refund time your seat can take its stake and fee back by itself"],
  ] as const,
  whoTitle: "Who sees it",
  whoLead: "Each line is the ledger's answer to that party, not a setting in this app.",
  matrixLink: "Every contract, party by party →",
} as const;

export const BUILT_ON_LEAD =
  "The platforms under the venue, and what each one does for it today. Each mark is shown as its owner's brand kit supplies it.";
