/** Contract-level strings from EXPERIENCE.md. Surfaces import these; they never inline them. */

export const BRAND = {
  name: "Owarine",
  kanji: "終値",
  romaji: "owarine",
  tagline: "call the close",
} as const;

export const RECEIPT_FOOTER = "Only you can cash out.";
export const RECEIPT_TITLE = "Settlement receipt";
export const PROOF_CAPTION = "Don't trust it. Click it.";
export const PROOF_DEGRADED = "print proof unreachable — raw tx link only";
export const KILL_LINE = "No such function.";
export const WALK_LINE = "Your stake is your max loss — always.";
export const BLIND_STATE = "Model is blind right now — the price feed is stale. No Read until it wakes.";
export const BRAKE_TALKDOWN = "You're chasing. Model says no edge here. Sit this window out.";
export const BACKED_TERMINAL = "call stood, money never matched";
export const COMPOSER_PERMANENCE = "Takes are public and effectively permanent.";
export const DAILY_STOP_HIT = "Daily Stop hit. Betting reopens at midnight.";
export const OUT_OF_GAS = "Canton charges no network fee, so there is nothing to top up. Renew your seat and try again.";
export const SETTLING = "Settling…";
export const PLACING = "Placing…";
export const SUBMITTED_UNKNOWN =
  "Submitted — waiting for the ledger to answer. Your order is either in or it never left; we'll show you which.";

/** The route error boundary's words — `reference/yosuku/app/error.tsx` verbatim; the disclosure label is ours. */
export const ERROR_BOUNDARY = {
  headline: "A quiet moment on the floor.",
  body: "Something interrupted this view. Your funds and positions are safe on the ledger. This is only the screen. Try again, or head back to the markets.",
  retry: "Try again",
  back: "Go to markets",
  technical: "Technical details",
} as const;

export const EMPTY = {
  positions: { why: "No positions yet.", nextAction: "Your first Window is one tap away." },
  history: { why: "Nothing settled yet.", nextAction: "History fills in as your Windows close." },
  claims: { why: "Nothing to claim.", nextAction: "Wins land here the moment a Window settles." },
} as const;

export const STALE_REASON_LABEL = {
  "refresh-failed": "retrying",
  aged: "aging",
  offline: "offline",
} as const;

export function staleLine(timeText: string, reasonLabel: string): string {
  return `as of ${timeText} — ${reasonLabel}`;
}

/**
 * What to do about a "wrong network" on Canton, said once. The reference told a Solana wallet how to switch to devnet;
 * a seat is a party the venue leases on its own network, so the only honest step is a fresh seat. The name is kept.
 */
export const DEVNET_WALLET_STEP = "A seat is always on the venue's network, so there is nothing to switch: reset the seat, then take a new one.";
