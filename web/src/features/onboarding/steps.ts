import { networkLabel } from "@agari/markets/chain";

/**
 * The first-run walkthrough — ported from reference/yosuku/components/Tutorial.tsx (L19–41).
 *
 * Five screens, in the reference's own order and job: what this is, how a round
 * works, the account that signs, where the money sits, and one closing choice
 * that ends on connecting. The prose is rewritten because the reference's is
 * about a different chain and a capability set Masayume has not built yet:
 *
 *  - Sui/zkLogin/Google sign-in and sponsored gas → Somnia, and every order is a
 *    transaction the user approves themselves. There is no sponsorship today.
 *  - The reference's "Trading Balance" is its on-chain vault. Masayume's
 *    `EventVault` is Stage 4, so step 4 describes the pools that *do* exist:
 *    spendable, order escrow, venue payout credit (the same three the balance
 *    plate labels).
 *  - Fixed 1m/5m/1h cadences → whatever the venue is running, since lanes derive
 *    from live `intervalSec`.
 *
 * Copy lives here rather than in `lib/copy.ts` because it is a five-screen
 * narrative, not a label table — and copy.ts is near the 400-line cap.
 */

export interface TutorialStep {
  readonly title: string;
  readonly description: string;
  /** The closing screen: pick how markets read, then connect. Never auto-advances. */
  readonly choice?: true;
}

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  {
    title: "Welcome to Agari",
    // The configured network by name (C4f): a LocalNet build never says DevNet.
    get description() {
      return `A prediction market on stock and crypto prices, on Canton. Pick a side of a live Window, and a signed oracle price settles it at the close — the price decides, nobody else. This is ${networkLabel()}: demo credits only, no real money.`;
    },
  },
  {
    title: "How a Window works",
    description:
      "A Window opens at a print and settles on the oracle price at its close. Some run every few minutes, some once a day — whatever the venue is listing. Tap UP or DOWN. Each side is its own contract with its own live price from the venue's ladder, so the two sides do not add up to $1. The ticket shows the exact cost before you sign.",
  },
  {
    title: "Your seat",
    description:
      "Take a seat: this browser makes a signing key that cannot leave it, and the venue gives the seat a Canton party of its own. There is no extension to install and no network fee to pay. Your calls, cash and positions are contracts only your seat's party and the venue can see. Reset the seat and its key is gone for good. A desk can also hold a basket of PreStocks for you, inside your limits.",
  },
  {
    title: "Where your money sits",
    description:
      "One number is spendable: what you can bet right now. Every other pool is labelled beneath it and never added in — credits locked in resting orders until they fill or you cancel, and venue payout credit, which is spent first on your next buy in that same Window.",
  },
  {
    title: "How should markets read?",
    description: "Switch anytime with the Plain words toggle above the live Windows.",
    choice: true,
  },
];

export const TUTORIAL_UI = {
  close: "Close",
  skip: "Skip",
  next: "Next",
  done: "Get started",
  lastStep: "Last step",
  connectTitle: "Take a seat to start trading",
  get connectNote(): string {
    return `No wallet app needed. ${networkLabel()}, so these are demo credits — and every call is yours alone to place.`;
  },
  progress: (step: number, total: number) => `Step ${step} of ${total}`,
} as const;
