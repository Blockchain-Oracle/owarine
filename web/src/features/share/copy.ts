/** The share cards' words — ported from the reference's two card renderers and `BetPlacedCard.tsx`. */
import { VOID_SHARE_WORD } from "@agari/core/market";
import { networkLabel } from "@agari/markets/chain";
import type { VoidReason } from "@agari/core/types";

/** The signed source and void reason as the settled card prints them (proof-analytics.md §2.8): core's one stamp per reason. */
const VOID_WORD: Readonly<Record<VoidReason, string>> = VOID_SHARE_WORD;

/**
 * The brand as the owner gave it (2026-09-02): the public home and the X handle. The handle is the one
 * account people tag to bet from X, so it follows the deployment (`NEXT_PUBLIC_X_HANDLE`, inlined at
 * build) — the owner's account is not yet the name the placeholder assumed (2026-09-04).
 */
/** This deployment's own origin (`NEXT_PUBLIC_SITE_URL`, else `NEXT_PUBLIC_APP_ORIGIN`, else the local default): never another product's domain. */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.NEXT_PUBLIC_APP_ORIGIN?.trim() || "http://localhost:3000";

const BRAND = {
  brand: "AGARI",
  site: SITE_URL.replace(/^https?:\/\//, ""),
  siteUrl: SITE_URL,
  /** The venue's X account, only when the deployment names one: the reference's account is not this product's. */
  handle: process.env.NEXT_PUBLIC_X_HANDLE?.trim() || "the venue's X account",
} as const;

const signOff = process.env.NEXT_PUBLIC_X_HANDLE?.trim() ? `${BRAND.site} via ${BRAND.handle}` : BRAND.site;

export const SHARE = {
  ...BRAND,
  /** The configured network (C4f): on LocalNet the cards never say DevNet. */
  get network(): string {
    return networkLabel().toUpperCase();
  },
  verifyOn: "VERIFY ON THE PROOF PAGE",
  scan: "SCAN TO MAKE YOUR CALL",
  shareCall: "Share this call",
  shareCard: "Share card",
  rendering: "Rendering…",
  savedAttach: "Card saved. Attach it to your post on X",
  renderFailed: "Could not render the share card",
  call: {
    get recordType(): string {
      return `THE CALL · ${networkLabel().toUpperCase()}`;
    },
    up: "▲ CALLING UP",
    down: "▼ CALLING DOWN",
    placed: "Call placed",
    over: (asset: string, line: string) => `${asset} OVER ${line}`,
    under: (asset: string, line: string) => `${asset} UNDER ${line}`,
    noLine: (asset: string) => `${asset} VS THE OPENING PRINT`,
    winsIf: (asset: string, side: "up" | "down") => `Wins if ${asset} closes ${side === "up" ? "at or above" : "below"} the line.`,
    /** C6e: a committee event's call. */
    yes: "▲ CALLING YES",
    no: "▼ CALLING NO",
    winsIfEvent: (side: "up" | "down") => `Wins if the committee attests ${side === "up" ? "YES" : "NO"}.`,
    youStake: "You stake",
    winIfLands: "Win if it lands",
    /** Canton charges the fee with the stake at the fill, so a win is paid in full. */
    afterFee: "paid in full · fee included in the stake",
    /** The reference's caveat on a boosted call (`BetPlacedCard.tsx` L123–127) and its PNG line (`openBetShareCard.ts` L360). */
    leverageNote: (x: number) => `✦ ${x}× leverage. It can knock out before close.`,
    leverageLine: (x: number) => `${x}× LEVERAGE · CAN KNOCK OUT BEFORE THE CLOSE`,
    settlesIn: "Settles in",
    settling: "Settling…",
    verify: "verify on the proof page ↗",
    portfolio: "Portfolio",
    another: "Place another",
    stakeLine: "STAKE  →  RETURN IF IT LANDS",
    settlesLine: (utc: string) => `SETTLES ${utc} · ORACLE-SETTLED AT THE CLOSE`,
    footerKind: "AGARI · LIVE CALL",
    tx: (short: string) => `TX ${short}`,
    /** The pre-filled post: real staked numbers only, framed as a live call. */
    /** The reference's text carries the multiple — `My call: ${band} (2×)` (`openBetShareCard.ts` L97–99). */
    tweet: (band: string, cadence: string, stake: string, win: string, symbol: string, utc: string, multiple = 1) =>
      `My call: ${band} (${cadence} Window${multiple > 1 ? `, ${multiple}×` : ""}). Staked ${stake} to win ${win} ${symbol}, oracle-settles ${utc} on ${networkLabel()}. Will it land? ${signOff}`,
  },
  trade: {
    settlement: "SETTLEMENT RECORD",
    voidRecord: "VOID RECORD",
    closeOut: "CLOSE-OUT RECORD",
    realized: (symbol: string) => `REALIZED P&L · ${symbol}`,
    paidOut: (symbol: string) => `PAID OUT · ${symbol}`,
    oracleSettled: (print: string, utc: string) => `ORACLE-SETTLED ${print} AT ${utc}`,
    /** Every settled card names the signed source of its closing print (PD-1, D-003); boundaries fall on whole minutes. */
    /** `source` is the print's name on every surface (`printSourceName`): "RedStone", "Alpaca IEX", "PreStocks". */
    printAt: (source: string, print: string, etClock: string) => `${source.toUpperCase()} PRINT ${print} AT ${etClock}:00 ET`,
    signers: (n: number) => ` · ${n} SIGNER${n === 1 ? "" : "S"}`,
    singleSource: " · SINGLE SOURCE",
    settledAt: (utc: string) => `SETTLED · ${utc}`,
    /** `PM.Leg.legPayout` (K-290): a void returns each leg's backing plus the fee paid with it, never half a contract. */
    voided: (utc: string, reason: VoidReason | null) => `${reason ? VOID_WORD[reason] : "VOIDED"} · STAKE AND FEE RETURNED · ${utc}`,
    closedEarly: (utc: string) => `CLOSED AT THE VENUE'S PRICE BEFORE EXPIRY · ${utc}`,
    kind: { settled: "ORACLE-SETTLED", voided: "VOIDED", closed: "CLOSED EARLY" },
    entry: (short: string) => `ENTRY ${short}`,
    settlementTx: (short: string) => `SETTLEMENT ${short}`,
    noTx: "PROOF ON THE RECEIPT",
    tweet: (pnl: string, symbol: string, asset: string, band: string, how: string, stake: string, payout: string) =>
      `${pnl} ${symbol} on ${asset} ${band}: ${how}. ${stake} → ${payout} ${symbol} (${networkLabel()}). ${signOff}`,
  },
} as const;
