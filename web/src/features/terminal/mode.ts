"use client";

import { useSyncExternalStore } from "react";
import { useWalletSession } from "@/lib/wallet-session";
import { persistSoon } from "./persist";

/**
 * Demo and live (Tradash's `tradingMode` + demo state; TRADASH-FIDELITY.md §Demo mode). Live is the seat: real legs on
 * Canton. Demo is paper: 10,000 credits, fills at the venue's live ladder price with no fee, exits at what Close would
 * pay, and a position still open at its Window's close settles on the real resolution. Unlike the reference, open paper
 * positions survive a reload (theirs vanish silently). Amounts are base units (6 decimals), as on the ledger.
 */
export type TradeMode = "demo" | "live";

export interface PaperPosition {
  id: string;
  marketId: string;
  /** The registry ticker (BTC) and the symbol whose spot prices the Window (a token lane's xStock). */
  asset: string;
  spotSymbol: string;
  intervalSec: number;
  side: "up" | "down";
  contractsRaw: string;
  costBase: string;
  entrySpot: number;
  openedAtMs: number;
  quotingUntilSec: number;
  expirySec: number;
  /** The Window's open print (the line), as a price. */
  linePrice: number | null;
  trail: { stop: number } | null;
}

/** One leg of a paper parlay: a Window and a side, the price it was bought at, and how it settled. */
export interface PaperParlayLeg {
  marketId: string;
  asset: string;
  intervalSec: number;
  side: "up" | "down";
  expirySec: number;
  /** The leg's priced chance at open, per whole unit (1e6), as the reserve records `priceRaw`. */
  priceRaw: string;
  status: "pending" | "won" | "lost" | "void";
}

/** A paper parlay (plan 2c): priced by the reserve's own kernel on the live ladders, settled leg by leg on the real resolutions. */
export interface PaperParlay {
  id: string;
  legs: PaperParlayLeg[];
  stakeBase: string;
  maxPayoutBase: string;
  openedAtMs: number;
}

export interface PaperTrade {
  id: string;
  kind: "close" | "trail" | "settle" | "reduce" | "add" | "parlay";
  asset: string;
  side: "up" | "down";
  intervalSec: number;
  costBase: string;
  pnlBase: string;
  entrySpot: number;
  exitSpot: number | null;
  openedAtMs: number;
  closedAtMs: number;
}

interface ModeState {
  demoBalanceBase: string;
  positions: PaperPosition[];
  parlays: PaperParlay[];
  history: PaperTrade[];
}

export const DEMO_START_BASE = 10_000_000_000n;
const KEY = "owarine.trade.mode.v1";
const HISTORY_CAP = 500;
const INITIAL: ModeState = { demoBalanceBase: DEMO_START_BASE.toString(), positions: [], parlays: [], history: [] };

const listeners = new Set<() => void>();
let state: ModeState = INITIAL;
let hydrated = false;

function hydrate(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return;
    const p = JSON.parse(raw) as Partial<ModeState>;
    state = {
      demoBalanceBase: typeof p.demoBalanceBase === "string" && /^-?\d+$/.test(p.demoBalanceBase) ? p.demoBalanceBase : INITIAL.demoBalanceBase,
      positions: Array.isArray(p.positions) ? p.positions.filter(isPaperPosition) : [],
      parlays: Array.isArray(p.parlays) ? p.parlays.filter(isPaperParlay) : [],
      history: Array.isArray(p.history) ? p.history.filter((t): t is PaperTrade => typeof t?.id === "string").slice(0, HISTORY_CAP) : [],
    };
  } catch {
    state = INITIAL;
  }
}

function isPaperPosition(p: unknown): p is PaperPosition {
  const x = p as PaperPosition;
  return typeof x?.id === "string" && typeof x.marketId === "string" && (x.side === "up" || x.side === "down") && /^\d+$/.test(x.contractsRaw ?? "") && /^\d+$/.test(x.costBase ?? "");
}

function isPaperParlay(p: unknown): p is PaperParlay {
  const x = p as PaperParlay;
  return typeof x?.id === "string" && Array.isArray(x.legs) && x.legs.length >= 2 && /^\d+$/.test(x.stakeBase ?? "") && /^\d+$/.test(x.maxPayoutBase ?? "");
}

function commit(next: ModeState): void {
  state = next;
  // Saved within a second and on page hide (a trail moves the paper position on each favourable tick).
  persistSoon(KEY, () => state);
  listeners.forEach((l) => l());
}

export function modeState(): ModeState {
  hydrate();
  return state;
}

export function useModeState(): ModeState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => (hydrate(), state),
    () => INITIAL,
  );
}

/**
 * The account context, from the connection alone (Abu, 8 Oct: no Paper / Demo / Live picker). No seat: the guest demo
 * on paper credits. A seat: the same screens on its Canton party, with DevNet test funds. A stored pick from before
 * this rule is ignored.
 */
export function useTradeMode(): TradeMode {
  const { address } = useWalletSession();
  return address ? "live" : "demo";
}

/** "Reset demo balance": 10,000 again, every paper position gone. */
export function resetDemo(): void {
  hydrate();
  commit({ ...state, demoBalanceBase: DEMO_START_BASE.toString(), positions: [], parlays: [] });
}

/** Opens a paper position, or adds to the one already open on that Window side (entry spot weighted by stake). */
export function openPaper(p: PaperPosition): void {
  hydrate();
  const existing = state.positions.find((x) => x.marketId === p.marketId && x.side === p.side);
  if (!existing) return commit({ ...state, positions: [...state.positions, p] });
  const costA = Number(existing.costBase);
  const costB = Number(p.costBase);
  const merged: PaperPosition = {
    ...existing,
    contractsRaw: (BigInt(existing.contractsRaw) + BigInt(p.contractsRaw)).toString(),
    costBase: (BigInt(existing.costBase) + BigInt(p.costBase)).toString(),
    entrySpot: costA + costB > 0 ? (existing.entrySpot * costA + p.entrySpot * costB) / (costA + costB) : p.entrySpot,
  };
  commit({ ...state, positions: state.positions.map((x) => (x.id === existing.id ? merged : x)) });
}

export function updatePaper(id: string, patch: Partial<PaperPosition>): void {
  hydrate();
  commit({ ...state, positions: state.positions.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
}

/**
 * Settles a paper position (or part of it): the balance moves by realized PnL only — margin is never taken at open,
 * exactly as the reference's demo — and the trade is recorded. `keep` leaves the remainder open (Reduce).
 */
export function settlePaper(id: string, trade: Omit<PaperTrade, "id">, keep?: { contractsRaw: bigint; costBase: bigint }): void {
  hydrate();
  const balance = BigInt(state.demoBalanceBase) + BigInt(trade.pnlBase);
  const positions = keep && keep.contractsRaw > 0n
    ? state.positions.map((p) => (p.id === id ? { ...p, contractsRaw: keep.contractsRaw.toString(), costBase: keep.costBase.toString() } : p))
    : state.positions.filter((p) => p.id !== id);
  commit({ ...state, demoBalanceBase: balance.toString(), positions, history: [{ ...trade, id: `${id}:${trade.closedAtMs}` }, ...state.history].slice(0, HISTORY_CAP) });
}

export function recordPaper(trade: Omit<PaperTrade, "id">): void {
  hydrate();
  commit({ ...state, history: [{ ...trade, id: `t:${trade.closedAtMs}:${state.history.length}` }, ...state.history].slice(0, HISTORY_CAP) });
}

/** Opens a paper parlay. As with a paper position, nothing leaves the balance until it settles. */
export function openPaperParlay(p: PaperParlay): void {
  hydrate();
  commit({ ...state, parlays: [...state.parlays, p] });
}

export function updatePaperParlay(id: string, legs: PaperParlayLeg[]): void {
  hydrate();
  commit({ ...state, parlays: state.parlays.map((p) => (p.id === id ? { ...p, legs } : p)) });
}

/** Settles a paper parlay: the balance moves by its realized PnL and the ticket goes to history. */
export function settlePaperParlay(id: string, trade: Omit<PaperTrade, "id">): void {
  hydrate();
  const balance = BigInt(state.demoBalanceBase) + BigInt(trade.pnlBase);
  commit({ ...state, demoBalanceBase: balance.toString(), parlays: state.parlays.filter((p) => p.id !== id), history: [{ ...trade, id: `${id}:${trade.closedAtMs}` }, ...state.history].slice(0, HISTORY_CAP) });
}
