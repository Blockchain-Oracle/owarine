"use client";

import type { Quote } from "@owarine/core/types";
import type { LivePnlView } from "@owarine/markets/react";
import { useModeState, type TradeMode } from "../mode";
import { setTradeSettings } from "../settings";
import type { TerminalPosition } from "../useTerminalTrade";
import type { TerminalLane } from "../useTerminalWindow";
import { AccountSheet, type AccountView } from "./sheets/AccountSheet";
import { MarketsSheet, type PickerMarket } from "./sheets/MarketsSheet";
import { AdjustSheet, PositionsSheet, ShareSheet, subjectOfPosition, type ShareSubject } from "./sheets/PositionSheets";
import { ReplaySheet } from "./sheets/ReplaySheet";
import { LeaderboardSheet } from "./sheets/LeaderboardSheet";
import { InstallSheet } from "./sheets/InstallSheet";
import type { Episode } from "../replay";
import type { ParlayMark } from "../parlay/ParlayRow";
import type { ScreenParlay } from "../parlay/useParlays";
import { useState } from "react";
import { Sheet } from "@/components/kit";
import { SettingsSheet } from "./sheets/SettingsSheet";
import { ExitSheet } from "./sheets/ExitSheet";
import { Tutorial } from "./sheets/Tutorial";

export type SheetName = "markets" | "settings" | "account" | "history" | "account-settings" | "positions" | "add" | "reduce" | "share" | "replay" | "leaderboard" | "install" | "tutorial" | "parlay" | "exits";

const DAY_MS = 86_400_000;

/** Every sheet over the chart (Tradash: every secondary page is a sheet), one open at a time. */
export function TerminalSheets(props: {
  open: SheetName | null;
  onClose: () => void;
  onOpen: (name: SheetName, p?: TerminalPosition | null) => void;
  target: TerminalPosition | null;
  symbol: string;
  mode: TradeMode;
  cashBase: bigint | null;
  equity: number | null;
  stakeCredits: number;
  minCredits: number;
  quotes: { up: Quote | null; down: Quote | null };
  linePrice: number | null;
  closeSec: number | null;
  poolAddress: string | null;
  activeMarketId: string | null;
  positions: readonly TerminalPosition[];
  book: ReadonlyMap<string, LivePnlView>;
  markets: readonly PickerMarket[];
  nowSec: number;
  spot: number | null;
  totalsPnl: number;
  closingAll: boolean;
  onCloseAll: () => void;
  onPickSymbol: (symbol: string) => void;
  onAdd: (p: TerminalPosition, add: { stakeBase: bigint; quote: Quote | null }) => void;
  onReduce: (p: TerminalPosition, contractsRaw: bigint) => void;
  onTakeSeat: () => void;
  /** R2: the seat's resting exits are on the ledger (TP / SL offered on a live position). */
  ledgerExits: boolean;
  onExitsChanged: () => void;
  parlays?: readonly ScreenParlay[];
  marks?: ReadonlyMap<string, ParlayMark>;
}) {
  const { open, onClose, onOpen, target, mode } = props;
  const modeState = useModeState();
  const availableCredits = props.cashBase === null ? null : Number(props.cashBase) / 1e6;
  const since = Date.now() - DAY_MS;
  const todayRealized = mode === "demo" ? modeState.history.filter((t) => t.closedAtMs >= since).reduce((s, t) => s + Number(t.pnlBase) / 1e6, 0) : 0;
  const accountView: AccountView = open === "history" ? "history" : open === "account-settings" ? "settings" : "menu";
  const fresh = target ? (props.positions.find((p) => p.id === target.id) ?? null) : null;
  const [replay, setReplay] = useState<{ episode: Episode; finalPnl: number; subject: ShareSubject } | null>(null);
  const [tradeShare, setTradeShare] = useState<ShareSubject | null>(null);
  // A sheet mounts the first time it opens and stays mounted (so it can animate closed): the terminal re-renders on
  // every price tick, and twelve closed sheets running their hooks each time was most of that cost.
  const [seen, setSeen] = useState<ReadonlySet<SheetName>>(() => new Set(open ? [open] : []));
  if (open && !seen.has(open)) setSeen(new Set([...seen, open]));
  const was = (...names: SheetName[]) => names.some((n) => seen.has(n));
  const shareSubject = fresh ? subjectOfPosition(fresh, props.book.get(fresh.id) ?? null, props.spot) : tradeShare;
  return (
    <>
      {open === "share" && fresh && !shareSubject ? <Sheet open onOpenChange={(o) => !o && onClose()} title="Share position"><p className="py-4 text-ow-body text-ow-muted">Live return unavailable. You can share the result once this position has a quote or settles.</p></Sheet> : null}
      {was("markets") ? (
        <MarketsSheet open={open === "markets"} onClose={onClose} markets={props.markets} current={props.symbol} onPick={props.onPickSymbol} />
      ) : null}
      {was("settings") ? (
        <SettingsSheet
          open={open === "settings"}
          onClose={onClose}
          symbol={props.symbol}
          availableCredits={availableCredits}
          stakeCredits={props.stakeCredits}
          minCredits={props.minCredits}
          quotes={props.quotes}
          linePrice={props.linePrice}
          closeSec={props.closeSec}
          demo={mode === "demo"}
        />
      ) : null}
      {was("account", "history", "account-settings") ? (
        <AccountSheet
          open={open === "account" || open === "history" || open === "account-settings"}
          onClose={onClose}
          initialView={accountView}
          mode={mode}
          equity={props.equity}
          todayPnl={todayRealized + props.totalsPnl}
          onTour={() => onOpen("tutorial")}
          onTakeSeat={() => (onClose(), props.onTakeSeat())}
          onLeaderboard={() => onOpen("leaderboard")}
          onInstall={() => onOpen("install")}
          onReplay={(row, episode) => {
            const exit = episode.samples.at(-1)?.[1] ?? null;
            setReplay({ episode, finalPnl: row.pnl, subject: { asset: row.asset, side: row.side, intervalSec: row.intervalSec, pnl: row.pnl, cost: row.cost, entry: episode.entrySpot, exit, closed: true } });
            onOpen("replay");
          }}
        />
      ) : null}
      {was("leaderboard") ? (
        <LeaderboardSheet open={open === "leaderboard"} onClose={onClose} />
      ) : null}
      {was("install") ? (
        <InstallSheet open={open === "install"} onClose={onClose} />
      ) : null}
      {was("replay") ? (
        <ReplaySheet
          open={open === "replay"}
          onClose={onClose}
          episode={replay?.episode ?? null}
          finalPnl={replay?.finalPnl ?? null}
          onShare={() => {
            setTradeShare(replay?.subject ?? null);
            onOpen("share", null);
          }}
        />
      ) : null}
      {was("positions") ? (
        <PositionsSheet
          open={open === "positions"}
          onClose={onClose}
          positions={props.positions}
          book={props.book}
          nowSec={props.nowSec}
          onShare={(p) => onOpen("share", p)}
          onAdd={(p) => onOpen("add", p)}
          onReduce={(p) => onOpen("reduce", p)}
          onExits={props.ledgerExits && mode === "live" ? (p) => onOpen("exits", p) : undefined}
          onCloseAll={props.onCloseAll}
          closingAll={props.closingAll}
          parlays={props.parlays}
          marks={props.marks}
        />
      ) : null}
      {was("add", "reduce") ? (
        <AdjustSheet
          open={open === "add" || open === "reduce"}
          onClose={onClose}
          kind={open === "reduce" ? "reduce" : "add"}
          position={fresh}
          live={fresh ? (props.book.get(fresh.id) ?? null) : null}
          availableCredits={availableCredits}
          demo={mode === "demo"}
          poolAddress={fresh && fresh.marketId === props.activeMarketId ? props.poolAddress : null}
          onAdd={props.onAdd}
          onReduce={props.onReduce}
        />
      ) : null}
      {was("exits") ? (
        <ExitSheet open={open === "exits"} onClose={onClose} position={fresh} spot={props.spot} onChanged={props.onExitsChanged} />
      ) : null}
      {was("share") ? (
        <ShareSheet open={open === "share"} onClose={onClose} subject={shareSubject} />
      ) : null}
      {was("tutorial") ? (
        <Tutorial
          open={open === "tutorial"}
          onDone={(choice) => {
            setTradeSettings({ tutorialSeen: true });
            // Taking a seat is the only switch: a seat trades on Canton, no seat is the guest demo.
            if (choice === "live") props.onTakeSeat();
            onClose();
          }}
        />
      ) : null}
    </>
  );
}

export type { TerminalLane };
