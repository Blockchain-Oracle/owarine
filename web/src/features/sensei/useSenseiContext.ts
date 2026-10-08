"use client";

import { formatCadence } from "@owarine/core/market";
import { roundSettledAtMs, type SettledRound } from "@owarine/core/projection";
import type { OpenPosition } from "@owarine/core/types";
import { usePositions, useWalletHistory } from "@owarine/markets/react";
import { useMemo } from "react";
import { useWalletSession } from "@/lib/wallet-session";
import { useDeskView } from "@/features/desk/useDesk";
import { deskView } from "@/features/desk/view";
import { useMarketSession } from "../markets/session/useMarketSession";
import type { SenseiDesk, SenseiPosition, SenseiRecord, SenseiSession } from "./protocol";
import { baseToCents } from "./units";

/** The request's ceiling (`protocol.ts`); the soonest to close are the ones a read is about. */
const MAX_POSITIONS = 8;
/** Minutes to close are what the positions carry, so they are rebuilt once a minute, like the snapshot's figures. */
const TICK_MS = 60_000;
/** USD e6 → cents, rounded half up, integer only. */
const USD_E6_PER_CENT = 10_000n;

/** What Sensei's request adds about the reader (S13 spec §1.1). A field left undefined is unknown, never "none". */
export interface SenseiContext {
  session: SenseiSession | null;
  positions?: SenseiPosition[];
  record?: SenseiRecord;
  desk?: SenseiDesk;
}

function sideOf(position: OpenPosition): SenseiPosition["side"] {
  if (position.balanceUpRaw > 0n && position.balanceDownRaw > 0n) return "both";
  return position.balanceUpRaw > 0n ? "up" : "down";
}

function toPositions(positions: readonly OpenPosition[], nowMs: number): SenseiPosition[] {
  return positions
    .filter((position) => position.expirySec * 1000 > nowMs)
    .sort((a, b) => a.expirySec - b.expirySec)
    .slice(0, MAX_POSITIONS)
    .map((position) => ({
      asset: position.asset,
      cadence: formatCadence(position.intervalSec),
      side: sideOf(position),
      stakeCents: Math.max(0, baseToCents(position.costBasisBase, position.decimals)),
      markCents: Math.max(0, baseToCents(position.markValueBase, position.decimals)),
      minsToClose: Math.max(0, Math.round((position.expirySec * 1000 - nowMs) / 60_000)),
    }));
}


/** The wallet's desk for Sensei (S21): mode, worth, the last decision's line and its age, anything waiting. Nothing names the wallet. */
export function toDesk(view: ReturnType<typeof deskView>, nowMs: number): SenseiDesk {
  const latest = view.wire.latest;
  const waiting = view.approvals.open[0] ?? null;
  return {
    mode: view.mode,
    state: view.stateText,
    valueCents: view.plate.totalE6 === null ? null : Number((view.plate.totalE6 + USD_E6_PER_CENT / 2n) / USD_E6_PER_CENT),
    lastDecision: latest ? latest.summary.slice(0, 300) : null,
    lastDecisionAgoMin: latest ? Math.max(0, Math.round((nowMs / 1000 - latest.decidedAtSec) / 60)) : null,
    waiting: waiting ? waiting.summary.slice(0, 300) : null,
    practiceChecks: view.practice.done,
  };
}

/** Wins and losses as the Trader Edge counts them; the streak is the current run over decided rounds, signed. */
export function toRecord(rounds: readonly SettledRound[]): SenseiRecord {
  const decided = rounds
    .filter((round) => round.outcome === "win" || round.outcome === "loss")
    .sort((a, b) => roundSettledAtMs(b) - roundSettledAtMs(a));
  const wins = decided.filter((round) => round.outcome === "win").length;
  const newest = decided[0]?.outcome;
  let run = 0;
  while (run < decided.length && decided[run]!.outcome === newest) run += 1;
  return { settled: rounds.length, wins, losses: decided.length - wins, streak: newest === "loss" ? -run : run };
}

/**
 * The session, the reader's open positions and settled record, for Sensei's per-turn context.
 *
 * The session is the chip's own poll. Positions and history are the shared `keys.positions` / `keys.history`
 * entries (15 s / 300 s), enabled only while the drawer is open and a wallet is connected, so a closed drawer
 * costs nothing. No wallet address leaves the browser in the request.
 */
export function useSenseiContext(open: boolean, nowMs: number): SenseiContext {
  const { address } = useWalletSession();
  const market = useMarketSession();
  const positions = usePositions(open ? address : null);
  const history = useWalletHistory(address, open);
  // The desk's own page read (one TanStack key), only while the drawer is open with a wallet connected.
  const desk = useDeskView(open ? address : null, address, open && address !== null);
  const tick = Math.floor(nowMs / TICK_MS);

  const state = market?.status.state ?? null;
  const label = market?.label ?? null;
  const session = useMemo<SenseiSession | null>(() => (state === null || label === null ? null : { state, label }), [state, label]);

  const positionRows = open && address !== null && positions?.ok ? positions.value : null;
  const rounds = open && address !== null && history?.ok ? history.value.rounds : null;
  const deskWire = open && address !== null && desk?.ok && desk.value.desk !== null ? desk.value : null;

  return useMemo<SenseiContext>(
    () => ({
      session,
      ...(positionRows ? { positions: toPositions(positionRows, tick * TICK_MS) } : {}),
      ...(rounds ? { record: toRecord(rounds) } : {}),
      ...(deskWire ? { desk: toDesk(deskView(deskWire), tick * TICK_MS) } : {}),
    }),
    [session, positionRows, rounds, deskWire, tick],
  );
}
