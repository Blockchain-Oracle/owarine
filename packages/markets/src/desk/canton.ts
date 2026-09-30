/**
 * The desk on Canton, as pure arithmetic (C8f, K-090/K-091). The reference's `agari-desk` bought PreStocks tokens
 * through Jupiter on Solana mainnet; on Canton the desk is a `DeskMandate` (abu-pm-agents 0.2.0) on an embedded
 * `AgentGrant`, and its live leg trades this venue's own markets with venue cash:
 *
 *   a name        a PreIpoSymbol ↔ its 60-minute pre-IPO series `laneKey(symbol, "token", 3600)` (the bootstrap's key);
 *                 the mandate's `allowList` holds those series keys
 *   buy a name    Up lots on that name's current trading Window: the owner's firm quote, bought by the operator
 *                 through `Mandate_Trade` (the grant's caps and the premium ceiling over an attested reference)
 *   sell a name   the venue's buy-back quote on one of the owner's legs, sold by the operator through
 *                 `Mandate_Sell` (only lots the desk bought; >= 92 % of the attested value; counted = max)
 *   hold a name   `DeskMandate.holdings`: lots per Window, open until the Window's refundAfter. A settled Window pays
 *                 the owner's seat, not the desk: the desk records it as money leaving the desk.
 *   reference     `DeskMark`s posted by the oracle parties (quorum 2 of 3) at the Window's fair Up ticks
 *
 * One lot is the pipeline's "token", so core's gate and valuation run unchanged:
 *
 *   raw = lots × 10^9        tokenPriceE8 = ticks × cashUnit × 100        multiplierE12 = 10^12
 *   value_E6 = raw × 10^12 × tokenPriceE8 / 10^23 = lots × ticks × cashUnit
 *
 * The record's hash chain is the mandate's own: head(n) = sha256(head(n−1) ":" n ":" decisionHash(n)) over lowercase
 * hex without `0x`, from 64 zeros (`PM.Agents.Desk.nextHead`); the app writes heads as `0x…` Hash32.
 */
import type { DeskMode } from "@agari/core/desk";
import { laneKey, PRE_IPO_SYMBOLS, type PreIpoSymbol } from "@agari/core/market";
import type { Address, Hash32 } from "@agari/core/types";
import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";
import type { DeskActionC, DeskDecisionC, DeskMandateC, DeskMarkC, DeskModeC } from "../ops/agents/decode";
import { deskAddressOf } from "../ops/agents/ids";
import type { DeskAllowedToken, DeskEvent, DeskRefState, DeskState, SealedAction } from "./types";

/** One lot as raw "tokens" (9 dp) in the desk pipeline. */
export const DESK_LOT_RAW = 1_000_000_000n;
/** A lot has no mint multiplier: 1 lot = 1 token. */
export const DESK_LOT_MULTIPLIER_E12 = 1_000_000_000_000n;
/** The bootstrap's cash unit (base units per lot per tick): 1000 ticks × 1000 = one credit. */
export const DEFAULT_CASH_UNIT = 1000n;
/** Contracts' raw units per lot (collateral decimals: one lot is one contract). */
export const CONTRACT_RAW_PER_LOT = 1_000_000n;
/** The desk's reference: `DeskMark`s from this many distinct oracle parties (the Daml `refQuorum`). */
export const DESK_REF_QUORUM = 2;
/** A mark older than this cannot be used (the Daml `referenceMaxAgeSec`). */
export const DESK_MARK_MAX_AGE_SEC = 900;
/** How far into the future a live desk's embedded grant runs: the reference desk does not expire. */
export const DESK_GRANT_DAYS = 365;
/** Open positions the embedded grant counts (a position is a Window's side until its refundAfter). */
export const DESK_MAX_OPEN_POSITIONS = 24;

export const GENESIS_HEAD_HEX = "0".repeat(64);

export const lotsToRaw = (lots: bigint): bigint => lots * DESK_LOT_RAW;
export const rawToLots = (raw: bigint): bigint => raw / DESK_LOT_RAW;
/** A lot's price at `ticks` in the pipeline's E8 terms. */
export const lotPriceE8 = (ticks: number, cashUnit: bigint = DEFAULT_CASH_UNIT): bigint => BigInt(ticks) * cashUnit * 100n;
/** A lot price back to ticks (floored, integer division; a tick count is at most 1000 so it is a safe `number`). */
export function ticksOfLotPriceE8(priceE8: bigint, cashUnit: bigint = DEFAULT_CASH_UNIT): number {
  if (priceE8 < 0n) throw new RangeError("ticksOfLotPriceE8: negative price");
  const ticks = priceE8 / (cashUnit * 100n);
  if (ticks > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError("ticksOfLotPriceE8: ticks out of range");
  return Number(ticks);
}
/** What `lots` are worth at `ticks` in base units (the Daml `userStakeOf`). */
export const lotValue = (lots: bigint, ticks: number, cashUnit: bigint = DEFAULT_CASH_UNIT): bigint => lots * BigInt(ticks) * cashUnit;

/** The name's 60-minute series key, as the bootstrap lists it. */
export const seriesOfSymbol = (symbol: PreIpoSymbol): string => laneKey(symbol, "token", 3_600);

const SYMBOL_OF_SERIES = new Map<string, PreIpoSymbol>(PRE_IPO_SYMBOLS.map((s) => [seriesOfSymbol(s), s]));
export const symbolOfSeries = (seriesKey: string): PreIpoSymbol | null => SYMBOL_OF_SERIES.get(seriesKey) ?? null;

/** The series of a Daml market id (`<seriesKey>:<index>`), as the mandate's `seriesOf` reads it. */
export function seriesOfMarket(damlMarketId: string): string {
  const i = damlMarketId.lastIndexOf(":");
  return i < 0 ? "" : damlMarketId.slice(0, i);
}
export const symbolOfMarket = (damlMarketId: string): PreIpoSymbol | null => symbolOfSeries(seriesOfMarket(damlMarketId));

// ---- the hash chain -----------------------------------------------------------------------------------

export const hexOfHash = (h: string): string => h.replace(/^0x/, "").toLowerCase();
export const hash32Of = (hex: string): Hash32 => `0x${hexOfHash(hex)}` as Hash32;

/** The mandate's next head (`PM.Agents.Desk.nextHead`), both ends in the app's `0x` Hash32 form. */
export function cantonChainHead(prevHead: Hash32 | string, seq: bigint | number, decisionHash: Hash32 | string): Hash32 {
  return hash32Of(bytesToHex(sha256(utf8ToBytes(`${hexOfHash(prevHead)}:${seq.toString()}:${hexOfHash(decisionHash)}`))));
}

// ---- the sale's floor and count (Daml `sellFloorOk`, `max proceeds value`) ----------------------------------

export const sellFloorOk = (proceeds: bigint, value: bigint): boolean => proceeds * 100n >= value * 92n;
export const sellCounted = (proceeds: bigint, value: bigint): bigint => (proceeds > value ? proceeds : value);

// ---- modes -------------------------------------------------------------------------------------------------

/** The ledger mode as the app's: shadow is practice-like; live is "on its own" unless the index says "ask first". */
export const deskModeOf = (mode: DeskModeC, indexMode?: DeskMode | null): DeskMode =>
  mode === "DeskShadow" ? "practice" : indexMode === "ask_first" ? "ask_first" : "on_its_own";
export const damlModeOf = (mode: DeskMode): DeskModeC => (mode === "practice" ? "DeskShadow" : "DeskLive");

// ---- DeskMandate → the reference's DeskState ----------------------------------------------------------------

/** The PreStocks mint the reference keyed each name by: kept as the name's id on the wire. */
export type MintOf = (symbol: PreIpoSymbol) => Address;

export interface DeskStateInput {
  mandate: DeskMandateC;
  /** The ledger offset the mandate was read at: the reference's slot. */
  offset: number;
  nowSec: number;
  mintOf: MintOf;
  /** Live marks, the newest per name (the reference's on-chain `DeskRef`s). */
  marks?: readonly DeskMarkC[];
  cashUnit?: bigint;
  indexMode?: DeskMode | null;
}

/** Today's spend on the embedded grant: its own day from `dayZero`, reset once the clock passes the day. */
export function spentToday(m: DeskMandateC, nowSec: number): { spent: bigint; windowStartSec: number } {
  const today = Math.floor((nowSec - m.grant.dayZeroSec) / 86_400);
  const spent = today > m.grant.day ? 0n : m.grant.spentToday;
  return { spent, windowStartSec: m.grant.dayZeroSec + Math.max(today, m.grant.day) * 86_400 };
}

/** Lots held per name at `nowSec` (Windows past refundAfter are the owner's settled positions, not the desk's). */
export function heldLotsBySymbol(m: DeskMandateC, nowSec: number): Map<PreIpoSymbol, bigint> {
  const out = new Map<PreIpoSymbol, bigint>();
  for (const h of m.holdings) {
    if (h.refundAfterSec <= nowSec || h.side !== "SideUp") continue;
    const symbol = symbolOfMarket(h.marketId);
    if (symbol) out.set(symbol, (out.get(symbol) ?? 0n) + h.lots);
  }
  return out;
}

export function deskStateOf(i: DeskStateInput): DeskState {
  const m = i.mandate;
  const address = deskAddressOf(m);
  const { spent, windowStartSec } = spentToday(m, i.nowSec);
  const daily = m.grant.caps.maxDailySpend;
  const held = heldLotsBySymbol(m, i.nowSec);
  const allowed = new Set(m.allowList.map(symbolOfSeries).filter((s): s is PreIpoSymbol => s !== null));
  const symbols = PRE_IPO_SYMBOLS.filter((s) => allowed.has(s) || (held.get(s) ?? 0n) > 0n);
  const tokens: DeskAllowedToken[] = symbols.map((symbol) => ({
    address, exists: true, raw: lotsToRaw(held.get(symbol) ?? 0n), frozen: false, mint: i.mintOf(symbol), symbol, enabled: allowed.has(symbol),
  }));
  const refs: Record<string, DeskRefState> = {};
  for (const mark of i.marks ?? []) {
    const symbol = symbolOfMarket(mark.marketId);
    if (!symbol || mark.side !== "SideUp") continue;
    const mint = i.mintOf(symbol) as string;
    const had = refs[mint];
    if (had && had.fetchedAtSec >= mark.fetchedAtSec) continue;
    const priceE8 = lotPriceE8(mark.refTicks, i.cashUnit);
    refs[mint] = { mint: mint as Address, tokenPriceE8: priceE8, markPriceE8: priceE8, multiplierE12: DESK_LOT_MULTIPLIER_E12, fetchedAtSec: mark.fetchedAtSec, postedBy: mark.attestor as Address, pythFeedId: null };
  }
  const mints = Object.fromEntries(symbols.map((s) => [i.mintOf(s) as string, { mint: i.mintOf(s), decimals: 9, multiplierE12: DESK_LOT_MULTIPLIER_E12, paused: false }]));
  return {
    address,
    owner: m.owner as Address,
    operator: (m.operator ?? null) as Address | null,
    seq: BigInt(m.seq),
    head: hash32Of(m.head),
    perActionCapE6: m.grant.caps.maxStakePerTrade,
    dailyCapE6: daily,
    spentInWindowE6: spent,
    windowStartSec,
    remainingDailyCapE6: daily > spent ? daily - spent : 0n,
    maxPremiumBps: m.maxPremiumBps,
    mode: deskModeOf(m.mode, i.indexMode),
    paused: m.paused,
    requirePythIndex: false,
    usdc: { address, exists: true, raw: m.grant.budget, frozen: false },
    tokens,
    refs,
    mints,
    slot: BigInt(i.offset),
  };
}

// ---- DeskDecision → the reference's events and seals ------------------------------------------------------

const hexBytes = (hex: string): Uint8Array => Uint8Array.from((hexOfHash(hex).match(/../g) ?? []).map((b) => parseInt(b, 16)));

export function deskEventOf(d: DeskDecisionC): DeskEvent {
  const sealed = { seq: BigInt(d.seq), head: hexBytes(d.head), decisionHash: hexBytes(d.decisionHash) };
  const a: DeskActionC = d.action;
  if (a.kind === "trade") return { name: "Bought", data: { ...sealed, usdcIn: a.charge, tokenOut: lotsToRaw(a.lots) } };
  if (a.kind === "sell") return { name: "Sold", data: { ...sealed, tokenIn: lotsToRaw(a.lots), usdcOut: a.proceeds, countedUsdc: a.counted } };
  return { name: "Checkpoint", data: sealed };
}

export const sealedOf = (d: DeskDecisionC): SealedAction => ({
  kind: d.action.kind === "trade" ? "Bought" : d.action.kind === "sell" ? "Sold" : "Checkpoint",
  seq: BigInt(d.seq),
  head: hash32Of(d.head),
  decisionHash: hash32Of(d.decisionHash),
});

/** The operator's command id for a sealed decision: deterministic, so a lost answer is found again by it. */
export const deskCommandId = (deskAddress: string, decisionHash: string, step = "seal"): string => `desk:${deskAddress}:${step}:${hexOfHash(decisionHash)}`;
