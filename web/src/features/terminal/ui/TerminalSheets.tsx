"use client";

import type { Quote } from "@owarine/core/types";
import type { LivePnlView } from "@owarine/markets/react";
import { setMode, useModeState, type TradeMode } from "../mode";
import { setTradeSettings } from "../settings";
import type { TerminalPosition } from "../useTerminalTrade";
import type { TerminalLane } from "../useTerminalWindow";
import { AccountSheet, type AccountView } from "./sheets/AccountSheet";
import { MarketsSheet, type PickerMarket } from "./sheets/MarketsSheet";
import { AdjustSheet, PositionsSheet, ShareSheet } from "./sheets/PositionSheets";
import { SettingsSheet } from "./sheets/SettingsSheet";
import { Tutorial } from "./sheets/Tutorial";

export type SheetName = "markets" | "settings" | "account" | "history" | "account-settings" | "positions" | "add" | "reduce" | "share" | "tutorial";

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
  totalsPnl: number;
  closingAll: boolean;
  onCloseAll: () => void;
  onPickSymbol: (symbol: string) => void;
  onAdd: (p: TerminalPosition, add: { stakeBase: bigint; quote: Quote | null }) => void;
  onReduce: (p: TerminalPosition, contractsRaw: bigint) => void;
  onTakeSeat: () => void;
}) {
  const { open, onClose, onOpen, target, mode } = props;
  const modeState = useModeState();
  const availableCredits = props.cashBase === null ? null : Number(props.cashBase) / 1e6;
  const since = Date.now() - DAY_MS;
  const todayRealized = mode === "demo" ? modeState.history.filter((t) => t.closedAtMs >= since).reduce((s, t) => s + Number(t.pnlBase) / 1e6, 0) : 0;
  const accountView: AccountView = open === "history" ? "history" : open === "account-settings" ? "settings" : "menu";
  const fresh = target ? (props.positions.find((p) => p.id === target.id) ?? null) : null;
  return (
    <>
      <MarketsSheet open={open === "markets"} onClose={onClose} markets={props.markets} current={props.symbol} onPick={props.onPickSymbol} />
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
      <AccountSheet
        open={open === "account" || open === "history" || open === "account-settings"}
        onClose={onClose}
        initialView={accountView}
        mode={mode}
        equity={props.equity}
        todayPnl={todayRealized + props.totalsPnl}
        onTour={() => onOpen("tutorial")}
        onTakeSeat={props.onTakeSeat}
      />
      <PositionsSheet
        open={open === "positions"}
        onClose={onClose}
        positions={props.positions}
        book={props.book}
        nowSec={props.nowSec}
        onShare={(p) => onOpen("share", p)}
        onAdd={(p) => onOpen("add", p)}
        onReduce={(p) => onOpen("reduce", p)}
        onCloseAll={props.onCloseAll}
        closingAll={props.closingAll}
      />
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
      <ShareSheet open={open === "share"} onClose={onClose} position={fresh} live={fresh ? (props.book.get(fresh.id) ?? null) : null} />
      <Tutorial
        open={open === "tutorial"}
        onDone={(choice) => {
          setTradeSettings({ tutorialSeen: true });
          if (choice === "demo") setMode("demo");
          if (choice === "live") {
            setMode("live");
            props.onTakeSeat();
          }
          onClose();
        }}
      />
    </>
  );
}

export type { TerminalLane };
