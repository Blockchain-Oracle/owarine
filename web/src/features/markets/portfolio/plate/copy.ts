/** The plate's words, the reference's own where they are still true (`BalancePlate.tsx`, `PoolRows.tsx`, `useMoney.ts`). */
export const PLATE = {
  eyebrow: "Ready to bet",
  /** The one number (C7a): credits, open positions at the venue's mid, and what is waiting to be collected. */
  balanceEyebrow: "Your balance",
  readyToBet: "ready to bet",
  legs: {
    credits: "Test credits",
    positions: "Open positions · at the venue mid",
    collect: "To collect",
  },
  /** Named, never summed into the figure (FR-5). */
  notSummed: "not in this figure",
  yours: "yours",
  elsewhere: "elsewhere",
  addMoney: "Add money",
  /** A seat trades Canton DevNet test funds (Abu, 8 Oct: never "demo" once connected, never "live" money). */
  getTest: "Get test credits",
  inWallet: "In your seat",
  /** The reference's betting account is the Trading Balance here, and every other surface calls it that. */
  inAccount: "In your Trading Balance",
  open: "open",
  settled: "settled",
  poolsEyebrow: "Elsewhere · not spendable here",
  vaultDisclosure: "Trading Balance · deposit and withdraw",
  pools: {
    x: {
      label: "X replies",
      note: "Your X replies bet from this. Only you can cash it out.",
      manage: "Manage",
      update: "Update X trading",
      updateNote: "Your existing permission needs an update. Open this row to use your funded X balance.",
      mismatch: (wallet: string) => `This X account bets from ${wallet}. Take that seat to use this balance.`,
      unlinked: "Link your X account and you can bet by replying to a card.",
    },
    private: {
      label: "Private",
      /** The desk's balance plus the vault's private bucket; the reference summed its tickets and the vault the same way (`portfolio/page.tsx` L195). */
      note: "Private bets spend from this. Only you can withdraw it.",
      manage: "Manage",
    },
  },
  /** The 8 Oct redesign: the hero's actions and the pockets row. */
  trade: "Trade",
  pocketsTitle: "Pockets",
  manage: "Manage",
  vault: { label: "Trading Balance", note: "Part of your credits. Move money in and out here." },
  connect: {
    title: "Take a Seat",
    newHere: "New here? Test credits are free →",
  },
} as const;
