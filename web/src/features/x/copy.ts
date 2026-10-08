/**
 * The X rail's words — ported from `reference/yosuku/app/trade-from-x/page.tsx`,
 * `components/XWalletCard.tsx` and `app/claim/page.tsx`, with the brand substituted and the
 * mechanics named as ours: an EXECUTOR grant on the EventVault instead of a tweet vault, a
 * signed wallet link instead of a tweeted code, and no leverage.
 */
import { SHARE } from "@/features/share/copy";

export const X_HANDLE = SHARE.handle;

export const X_LINK_STATUS = {
  checking: "Checking your X connection…",
  unavailable: "X sign-in is not available on this deployment yet.",
  /** C9e (D-015): the gate named in words (the reference never shows a variable name to a visitor). */
  waitsOn: "X sign-in is not switched on here: it waits on the server's X app keys, which this deployment has not set.",
  /** A failed status read is not an unconfigured rail. */
  unreadable: "Your X connection couldn't be read just now. It is checked again every 15 seconds.",
} as const;

/** The line a screen shows while X sign-in cannot be used: unread, or waiting on named keys (C9e). */
export function xGateLine(status: { configured: boolean; missing: readonly string[] } | null): string {
  if (status === null) return X_LINK_STATUS.unreadable;
  return status.missing.length > 0 ? X_LINK_STATUS.waitsOn : X_LINK_STATUS.unavailable;
}

export const X_ERRORS = {
  notConfigured: X_LINK_STATUS.unavailable,
  storeUnavailable: "The social store is not connected on this deployment.",
  signInFirst: "sign in with X first",
  invalidWallet: "invalid seat",
  signatureRequired: "seat signature required",
  signatureMismatch: "seat signature did not match",
  staleSignature: "that signature is too old — sign again",
  alreadyLinkedOther: "already_linked_other",
  notLinked: "this X account is not linked to that seat",
  badRequest: "bad request",
  linkFailed: "Could not link this seat. Please try again.",
  unlinkFailed: "Could not disconnect X.",
} as const;

/** The reference's OAuth bounce messages (`XWalletCard.tsx` L400–412). */
export const X_OAUTH_MESSAGES: Record<string, string> = {
  denied: "X authorization was cancelled. Please try again.",
  state: "Your X sign-in session expired. Please try again.",
  token: "X could not complete the connection. Please try again.",
  profile: "X connected, but your profile could not be read. Please try again.",
  config: "X connection is temporarily unavailable.",
  server: "X connection is temporarily unavailable. Please try again.",
};
export const X_OAUTH_FALLBACK = "X authorization did not finish. Please try again.";
export const X_OAUTH_EXPIRED = "Your X approval expired before it could finish. Please connect again.";
export const xOauthRejected = (code: string) => `X rejected the connection (${code.replaceAll("_", " ")}). Please try again.`;

export const TRADE_FROM_X = {
  title: "Trade from X",
  /** The phone app's own strip (mobile IslandStrip) still uses these two; web's shell names the page itself now. */
  crumb: "/ X-trade",
  openApp: "open the app",
  eyebrow: "X-trade",
  headline: "Trade by tweeting.",
  payoff: "Un⁠-⁠drainably.",
  lede: (handle: string) => [`Tweet your calls at `, handle, `. A bounded agent trades `, `your own`, ` funds, and can’t take them.`] as const,
  yourKeys: "your keys, your funds",
  venue: "Canton test network · Owarine venue quotes",
  setup: "set it up · three steps",
  steps: { connect: "Take a seat", fund: "Fund + authorize the agent", link: "Link your X account" },
  connected: "connected",
  funded: "X trading enabled · funded balance is your spending boundary",
  linkLede: "Sign in with X, then sign once with your seat to prove the handle is yours.",
  signIn: "Sign in with X",
  linkAs: (handle: string) => `Link @${handle} to this seat`,
  linking: "Linking…",
  linked: (handle: string) => `@${handle} routes to this seat`,
  errTail: "",
  then: "then · you’re live",
  justTweet: "Just tweet your calls.",
  opensFrom: "opens from your Trading Balance · settles back to you.",
  noWithdraw: "no withdraw path exists for the agent · verify:",
  proofs: {
    /** C9e: the Canton proof (`daml/pm-tests` `Test.Grant`), not the Solana program's test. */
    contract: "the grant buys only for its owner — Test.Grant.testGrantAuthority",
    caps: "every X order spends only from its allocated balance",
  },
  testnetNote: "demo credits · you can lose a call · the agent just can’t take your funds.",
  receipt: {
    lede: (amount: string, symbol: string) => [`Fund `, `${amount} ${symbol}`, `. Grant `, `one`, ` power: open a position you own.`] as const,
    amountAria: "Amount to fund",
    can: "can",
    canText: (amount: string, open: number) => [`trade from your funded balance: `, amount, ` total. No separate per-trade or daily spending limit. Up to `, `${open}`, ` open Windows.`] as const,
    cannot: "cannot",
    cannotStruck: "withdraw · transfer · drain",
    cannotTail: ". No such path for the agent.",
    line: (amount: string, symbol: string) => [`fund `, `${amount} ${symbol}`, ` · open-position only · revocable · 30 days`] as const,
    cta: "Fund and enable X trading",
    ctaApprove: "Fund and enable X trading",
    busy: "Your seat is signing…",
    notDeployed: "The Trading Balance contract is not deployed on this network yet.",
  },
  receipts: { title: "your receipts", empty: "No mentions executed yet.", none: "Receipts arrive once the relay is running." },
} as const;

export const X_CARD = {
  title: "X-Predict seat",
  wrongWallet: (handle: string) => `Wrong seat for @${handle}.`,
  itBetsFrom: "It bets from",
  connectedAs: ", and you are connected as",
  strandedNote: ". Funding this one would leave the money where no reply can spend it.",
  copyAddress: (short: string) => `Copy ${short}`,
  copied: "Address copied.",
  notInBrowser: "That seat is not connected in this browser. Open the browser that holds that seat. Unlinking has to be signed by that seat too, so it cannot be done from here.",
  switchQuestion: (from: string, to: string) => `Switch @${from} to @${to}?`,
  oneMoreStep: (handle: string) => `One more step to bet from @${handle}.`,
  switchNote: "Your balance stays here. Only which X account can bet changes.",
  useHandle: (handle: string) => `Use @${handle}`,
  linkHandle: (handle: string) => `Link @${handle} to this seat`,
  linking: "Linking…",
  xConnected: "X connected",
  switchAccount: "Switch X account",
  disconnect: "Disconnect X",
  disconnecting: "Disconnecting…",
  verifyToDisconnect: "Verify to disconnect",
  linkToBet: "Link your X account to bet with this.",
  connectFirst: "Connect X first, then fund.",
  connectX: "Connect X",
  connectWallet: "Take a seat to fund your X betting balance.",
  balanceLabel: "Your X betting balance",
  cashOut: "Cash out",
  cashingOut: "Cashing out",
  fund: "Fund",
  funding: "Funding",
  amountAria: "Amount to fund",
  checking: "Checking…",
  howTo: (handle: string) => `Mention ${handle} with an asset, a side, a stake and a Window.`,
  funded: (amount: string, handle: string) => `Funded ${amount}. Mention ${handle} to bet it.`,
  cashedOut: (amount: string) => `Cashed out ${amount} to your Trading Balance.`,
  linkedOk: "Linked. Your mentions now bet from this balance.",
  unlinkedOk: (amount: string) => `X disconnected. Your ${amount} remains in this seat's Trading Balance.`,
  nothingToCashOut: "Nothing to cash out yet.",
  enterAmount: "Enter an amount to fund.",
  notEnough: "Not enough demo credits in your seat. Take a seat on Markets to get some first.",
  wrongWalletFund: "This X account bets from a different seat. Take that seat before funding.",
  notDeployed: "The Trading Balance contract is not deployed on this network yet.",
  noExecutor: "Trading from X is temporarily unavailable. Please try again shortly.",
  budgetPolicy: "X trading can spend the balance you allocate here. No separate per-trade or daily spending limit. Only you can add funds or cash out.",
  balanceUnavailable: "Your X balance could not be verified. Refresh before making changes.",
  finishUpdate: "Update your existing X trading permission below before adding funds.",
  updateUnreadable: "Your saved X update could not be read. Check seat activity before starting another update.",
  updated: "X trading updated. Your allocated balance is now the spending boundary.",
  availableShort: "There is not enough available in your Trading Balance for this amount.",
  depositReturned: "The deposit was confirmed. Check the top-up transaction before retrying; any unallocated funds remain in your Trading Balance.",
} as const;

export const CLAIM = {
  title: "Claim your account",
  eyebrow: "YOUR TRADING BALANCE",
  headlineKnown: "waiting",
  headline: ["Claim your", "winnings."] as const,
  ledeKnown: (handle: string | null) => (handle ? `It’s yours, @${handle}. Take the seat it routes to and it’s in your hands.` : "It’s yours. Take the seat it routes to and it’s in your hands."),
  lede: "You bet from a mention, so your calls landed in the Trading Balance of the seat your X account routes to. Prove it’s you and we’ll show you which one.",
  steps: { prove: "Prove it’s you", where: "Which seat is yours?" },
  signedInAs: (handle: string | null) => `signed in${handle ? ` as @${handle}` : ""}`,
  signIn: "Sign in with X",
  connected: (short: string) => `${short} connected`,
  linking: "· linking…",
  routesTo: (short: string) => `@your account routes to ${short}`,
  thisWallet: "This is the seat. Your Trading Balance is on Portfolio.",
  otherWallet: (short: string) => `Your account routes to ${short}, not to this seat. Take that seat to use its balance, or re-link below to route future mentions here.`,
  relink: (handle: string) => `Route @${handle} to this seat instead`,
  noRoute: "Nothing routes to this X account yet. Set it up on Trade from X.",
  openPortfolio: "Open Portfolio",
  setUp: "Trade from X",
  card: {
    brand: "owarine",
    claimed: "CLAIMED",
    settled: "TRADING BALANCE",
    waiting: "WAITING",
    eyebrow: "YOUR TRADING BALANCE",
    masked: "• •",
    sent: "yours",
    waitingWord: "waiting",
    paid: "in the seat your account routes to",
    waitingFor: (handle: string) => `waiting for @${handle}`,
    reveal: "sign in with X to reveal",
    footer: "Only you can cash out.",
    network: "Canton test network",
  },
  footnote: "Your calls sit in a vault that pays only the seat that funded it. Not even us. Signing in with X just proves it’s the same you that placed them.",
} as const;

/** `/native-auth` (C13a, K-145): the X sign-in handoff into the app, when it is opened without the app's nonce. */
export const NATIVE_AUTH = {
  title: "Sign in with X · app",
  why: "This page signs you in with X for the Owarine app. Open the app, go to Trade from X and tap Sign in with X; it brings you here and straight back.",
  web: "Sign in on the web instead",
  consentTitle: "Continue in the Owarine app?",
  consentWhy: (handle: string | null) =>
    `The Owarine app asked to sign in with your X account${handle ? ` @${handle}` : ""}. Continue only if you started this from the Owarine app on this phone.`,
  consentCta: (handle: string | null) => (handle ? `Continue in the app as @${handle}` : "Continue in the app"),
} as const;
