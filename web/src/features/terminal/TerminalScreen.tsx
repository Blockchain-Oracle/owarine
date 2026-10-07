"use client";

import { TICKERS } from "@owarine/core/market";
import { isOk } from "@owarine/core/schemas";
import type { MarketId, OpenPosition, Side } from "@owarine/core/types";
import { marketsProvider } from "@owarine/markets";
import { ladderSpotSymbol, useBalanceSheet, useOpeningPrice, usePositions, useStakeQuote, type LivePnlView } from "@owarine/markets/react";
import { ladderSnapshot } from "@owarine/markets/runtime";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { haptic, installHaptics, setHapticsEnabled } from "@/lib/haptics";
import { installTradeSounds, playAdverseStep, playCloseOutcome, playComboStep, playSlump, playSurge, setTradeMuted } from "@/lib/sound/trade";
import { useWalletSession } from "@/lib/wallet-session";
import { LiveChart, type ChartLevel, type ChartOverlay, type FrameInfo } from "./chart/LiveChart";
import { entryOf, useEntries } from "./entries";
import { ReactionEngine } from "./feedback/reactions";
import { money, multipleOf } from "./format";
import { breakEvenSpot, useCommittedSpot, useLiveBook } from "./live";
import { settlePaper, useModeState, type TradeMode } from "./mode";
import { stakeFor, useTradeSettings, useTradeSettingsState } from "./settings";
import { TradeToasts, toast } from "./toasts";
import { AssetChip, EquityPill, SettingsStack, ViewPositionPill, WindowChip } from "./ui/Chrome";
import { PositionsList, totalsOf, UnrealizedCard } from "./ui/PositionsPanel";
import { ReactionOverlay, type ReactionOverlayHandle } from "./ui/ReactionOverlay";
import { TerminalNav } from "./ui/TerminalNav";
import { TerminalSheets, type SheetName } from "./ui/TerminalSheets";
import { TradeButtons } from "./ui/TradeButtons";
import { ratchet, setTrail, trailEligible, trailHit, useTerminalTrade, type TerminalPosition } from "./useTerminalTrade";
import { lanesFor, useTerminalWindow } from "./useTerminalWindow";
import "./terminal.css";

// Tradash's one breakpoint, 1024 CSS px.
const DESKTOP_QUERY = "(min-width: 64em)";
const CREDIT_DECIMALS = 6;
const MIN_STAKE_CREDITS = 1;

function useIsDesktop(): boolean {
  return useSyncExternalStore(
    (l) => {
      const mq = window.matchMedia(DESKTOP_QUERY);
      mq.addEventListener("change", l);
      return () => mq.removeEventListener("change", l);
    },
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false,
  );
}

function useNowSec(): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

const toCredits = (base: bigint) => Number(base) / 10 ** CREDIT_DECIMALS;

/**
 * Owarine's trading screen, Tradash's interaction model end to end (context/13-revamp/TRADASH-FIDELITY.md): the live
 * chart is the workspace; one tap opens, live PnL breathes on the price line, Trail rides the move, one tap closes;
 * sounds, haptics and reactions answer every move. Demo is paper on the venue's live ladder; live is the seat on Canton.
 */
export function TerminalScreen({ symbol }: { symbol: string }) {
  const router = useRouter();
  const desktop = useIsDesktop();
  const nowSec = useNowSec();
  const settingsState = useTradeSettingsState();
  const settings = useTradeSettings();
  const modeState = useModeState();
  const session = useWalletSession();
  const address = session.address;
  const mode: TradeMode = modeState.mode ?? (address ? "live" : "demo");
  const [lane, setLane] = useState<number | null>(null);
  const [sheet, setSheet] = useState<SheetName | null>(null);
  const [sheetTarget, setSheetTarget] = useState<TerminalPosition | null>(null);
  const [closingAll, setClosingAll] = useState(false);
  const ticker = TICKERS[symbol as keyof typeof TICKERS];
  const name = ticker?.name ?? symbol;

  // Feedback engines: installed once; the settings switch them.
  useEffect(() => installTradeSounds(), []);
  useEffect(() => {
    installHaptics(settings.hapticsEnabled);
    setHapticsEnabled(settings.hapticsEnabled);
    setTradeMuted(!settings.soundEnabled);
  }, [settings.hapticsEnabled, settings.soundEnabled]);

  // First visit: the five-step tour (Tradash opens it once settings have loaded with tutorialSeen false).
  useEffect(() => {
    if (settingsState && !settingsState.tutorialSeen) setSheet("tutorial");
  }, [settingsState]);

  useEffect(() => {
    document.title = `${name} (${symbol}) | Owarine`;
  }, [name, symbol]);
  // The screen owns the viewport while it is mounted (terminal.css drops the legacy shell's padding and page scroll).
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.surface = "terminal";
    return () => {
      delete root.dataset.surface;
    };
  }, []);

  // The Window, and every symbol with one (the market picker).
  const win = useTerminalWindow(symbol, lane, nowSec);
  const pickerMarkets = useMemo(() => {
    const symbols = new Set<string>();
    for (const l of win.set?.lanes ?? []) for (const m of l.markets) if (m.kind !== "event") symbols.add(m.asset);
    return [...symbols].sort((a, b) => (a === "BTC" ? -1 : b === "BTC" ? 1 : a === "ETH" ? -1 : b === "ETH" ? 1 : a.localeCompare(b))).map((s) => ({ symbol: s, lanes: lanesFor(win.set, s) }));
  }, [win.set]);
  const market = win.market;
  const ladder = market ? (ladderSnapshot(market.marketId)?.ladder ?? null) : null;
  const spotSymbol = ladder ? (ladderSpotSymbol(ladder) ?? symbol) : symbol;
  const openPrint = useOpeningPrice(market?.marketId ?? null);
  const linePrice = ladder?.openPriceE8 ? Number(ladder.openPriceE8) / 1e8 : openPrint && isOk(openPrint) && openPrint.value !== null ? Number(openPrint.value) / 1e8 : null;
  const spot = useCommittedSpot(spotSymbol);
  const windowState: "trading" | "locked" | "next" | "none" = !market ? "none" : nowSec < market.tradingStartSec ? "next" : nowSec < (ladder?.quotingUntilSec ?? market.lockAtSec) ? "trading" : "locked";

  // Money.
  const sheetReading = useBalanceSheet(mode === "live" ? address : null);
  const cashBase = mode === "demo" ? BigInt(modeState.demoBalanceBase) : sheetReading && isOk(sheetReading) ? sheetReading.value.spendableBase + sheetReading.value.venueCreditBase : null;
  const stakeCredits = stakeFor(settings, cashBase === null ? null : toCredits(cashBase), MIN_STAKE_CREDITS);
  const stakeBase = BigInt(Math.round(stakeCredits * 10 ** CREDIT_DECIMALS));
  const target = market ? { marketId: market.marketId, poolAddress: market.poolAddress, decimals: market.decimals, intervalSec: market.intervalSec } : null;
  const upQuote = useStakeQuote({ target, side: "up", stakeBase, enabled: windowState === "trading" });
  const downQuote = useStakeQuote({ target, side: "down", stakeBase, enabled: windowState === "trading" });
  const quotes = { up: upQuote && isOk(upQuote) ? upQuote.value : null, down: downQuote && isOk(downQuote) ? downQuote.value : null };

  // Positions: paper in demo, the seat's legs in live; both valued by the same live exit math.
  const seatPositions = usePositions(mode === "live" ? address : null);
  const entries = useEntries();
  const positions: TerminalPosition[] = useMemo(() => {
    if (mode === "demo") {
      return modeState.positions.map((p) => ({
        id: p.id, mode: "demo" as const, marketId: p.marketId, asset: p.asset, spotSymbol: p.spotSymbol, intervalSec: p.intervalSec, side: p.side,
        balanceUpRaw: p.side === "up" ? BigInt(p.contractsRaw) : 0n, balanceDownRaw: p.side === "down" ? BigInt(p.contractsRaw) : 0n, costBasisBase: BigInt(p.costBase),
        decimals: CREDIT_DECIMALS, entrySpot: p.entrySpot || null, linePrice: p.linePrice, openedAtMs: p.openedAtMs, expirySec: p.expirySec, trailStop: p.trail?.stop ?? null, paper: p,
      }));
    }
    const rows: OpenPosition[] = seatPositions && isOk(seatPositions) ? seatPositions.value : [];
    return rows
      .filter((r) => r.balanceUpRaw > 0n || r.balanceDownRaw > 0n)
      .map((r) => {
        const side: Side = r.balanceUpRaw >= r.balanceDownRaw ? "up" : "down";
        const e = entryOf(entries, r.marketId, side);
        const isActive = r.marketId === market?.marketId;
        return {
          id: `s:${r.marketId}`, mode: "live" as const, marketId: r.marketId, asset: r.asset, spotSymbol: r.asset, intervalSec: r.intervalSec, side, balanceUpRaw: r.balanceUpRaw,
          balanceDownRaw: r.balanceDownRaw, costBasisBase: r.costBasisBase, decimals: r.decimals, entrySpot: e?.spot || null, linePrice: isActive ? linePrice : null,
          openedAtMs: e?.atMs ?? 0, expirySec: r.expirySec, trailStop: e?.trailStop ?? null, paper: null,
        };
      });
  }, [mode, modeState.positions, seatPositions, entries, market?.marketId, linePrice]);
  const book = useLiveBook(positions);
  const active = positions.find((p) => p.marketId === market?.marketId) ?? null;
  const activeLive = active ? (book.get(active.id) ?? null) : null;
  const totals = totalsOf(positions, book);
  const equity = cashBase === null ? null : mode === "demo" ? toCredits(cashBase) + totals.pnl : toCredits(cashBase) + positions.reduce((s, p) => s + toCredits(book.get(p.id)?.exitBase ?? 0n), 0);

  const trade = useTerminalTrade({
    mode, market, spot, stakeBase, availableBase: cashBase, quotes, slippageBps: settings.slippageBps, linePrice,
    onNeedSeat: () => session.connect(),
  });

  // Break-even (Trail's reference and the B/E line) for the position on screen.
  const breakEven = active && spot !== null ? breakEvenSpot(active, active.side, spot, nowSec) : null;
  const trailRef = breakEven ?? active?.entrySpot ?? null;
  const canTrail = active ? trailEligible(active.side, spot, trailRef, settings.trailPct) : false;

  // Trail: ratchet on every committed price, close when hit.
  const closeRef = useRef(trade.close);
  closeRef.current = trade.close;
  useEffect(() => {
    if (spot === null) return;
    for (const p of positions) {
      if (p.trailStop === null || p.spotSymbol !== spotSymbol) continue;
      if (trailHit(p.side, p.trailStop, spot)) {
        void closeRef.current(p, book.get(p.id) ?? null, "trail");
        continue;
      }
      const next = ratchet(p.side, p.trailStop, spot, settings.trailPct);
      if (next !== p.trailStop) setTrail(p, next);
    }
    // Runs on committed prices only (5 Hz), as the reference's trail effect does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spot]);

  // Demo positions still open at their Window's close settle on the real resolution.
  useEffect(() => {
    if (mode !== "demo") return;
    const due = modeState.positions.filter((p) => nowSec > p.expirySec + 5);
    for (const p of due) {
      void marketsProvider.getResolution(p.marketId as MarketId).then((r) => {
        if (!isOk(r)) return;
        const res = r.value;
        let payout: bigint | null = null;
        if (res.voided) payout = BigInt(p.costBase);
        else if (res.openingRaw !== null && res.closingRaw !== null) {
          const upWins = res.closingRaw >= res.openingRaw;
          payout = (p.side === "up") === upWins ? BigInt(p.contractsRaw) : 0n;
        }
        if (payout === null) return;
        const pnl = payout - BigInt(p.costBase);
        settlePaper(p.id, { kind: "settle", asset: p.asset, side: p.side, intervalSec: p.intervalSec, costBase: p.costBase, pnlBase: pnl.toString(), entrySpot: p.entrySpot, exitSpot: res.closingRaw === null ? null : Number(res.closingRaw) / 1e8, openedAtMs: p.openedAtMs, closedAtMs: Date.now() });
        playCloseOutcome(Number(pnl));
        toast({ kind: pnl >= 0n ? "success" : "info", title: `${p.asset} ${cadenceWord(p.intervalSec)} settled`, description: res.voided ? "Voided — stake returned" : `Realized ${money(pnl, CREDIT_DECIMALS, true)}`, confetti: pnl > 0n });
      });
    }
    // Checked once a second while demo positions are due.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, nowSec % 5 === 0]);

  // The chart overlay: written to a ref, read every frame.
  const overlay = useRef<ChartOverlay | null>(null);
  overlay.current = active
    ? {
        pnl: activeLive && activeLive.fillableLots > 0n ? toCredits(activeLive.pnlBase) : 0,
        pnlText: activeLive && activeLive.fillableLots > 0n ? money(activeLive.pnlBase, active.decimals, true) : "locked",
        entry: active.entrySpot,
        levels: [
          ...(active.entrySpot ? [{ kind: "entry", price: active.entrySpot, label: "Entry" } satisfies ChartLevel] : []),
          ...(linePrice !== null ? [{ kind: "line", price: linePrice, label: "Line" } satisfies ChartLevel] : []),
          ...(breakEven !== null ? [{ kind: "breakeven", price: breakEven, label: "B/E" } satisfies ChartLevel] : []),
          ...(active.trailStop !== null ? [{ kind: "trail", price: active.trailStop, label: "Trail" } satisfies ChartLevel] : []),
        ],
      }
    : null;

  // Reactions at the commit rate, for the position on screen.
  const reactions = useRef(new ReactionEngine());
  const overlayHandle = useRef<ReactionOverlayHandle>(null);
  const onFrame = useRef<((info: FrameInfo | null) => void) | null>(null);
  onFrame.current = (info) => overlayHandle.current?.frame(info);
  useEffect(() => reactions.current.reset(), [spotSymbol]);
  useEffect(() => {
    if (spot === null) return;
    const out = reactions.current.feed({
      t: performance.now(), price: spot,
      position: active && activeLive ? { key: active.id, side: active.side === "up" ? 1 : -1, pnl: toCredits(activeLive.pnlBase), margin: toCredits(active.costBasisBase), entry: active.entrySpot ?? spot, line: linePrice } : null,
    });
    for (const r of out) {
      if (r.kind === "step") {
        if (r.favorable) (playComboStep(r.count), haptic("move"));
        else if (r.count >= 2) playAdverseStep();
      } else if (r.kind === "surge") {
        if (r.favorable) (playSurge(r.mega), haptic(r.mega ? "mega" : "surge"));
        else (playSlump(), haptic("slump"));
        if (settings.reactionsEnabled) overlayHandle.current?.flash(r.favorable, r.mega);
      } else {
        if (r.tone === "warn") haptic("warn");
        if (settings.reactionsEnabled) overlayHandle.current?.callout(r.tone, r.emoji, r.text);
      }
    }
    // Fed once per committed price.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spot]);

  const closeAll = useCallback(async () => {
    setClosingAll(true);
    try {
      for (const p of positions) await trade.close(p, book.get(p.id) ?? null);
    } finally {
      setClosingAll(false);
    }
  }, [positions, book, trade]);

  const openSheet = (name: SheetName, p: TerminalPosition | null = null) => {
    setSheetTarget(p);
    setSheet(name);
  };
  const upTicks = quotes.up ? quotes.up.avgPriceBps / 10 : 0;
  const downTicks = quotes.down ? quotes.down.avgPriceBps / 10 : 0;
  const feesCredits = mode === "demo" ? null : quotes.up ? (stakeCredits * quotes.up.feeBps) / 10_000 : null;
  const lockedText = active && (activeLive?.locked || windowState === "locked") ? `Locked — pays at ${new Date((active.expirySec) * 1000).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}` : null;

  const buttons = active ? (
    <TradeButtons
      mode="open"
      trailActive={active.trailStop !== null}
      trailEligible={canTrail}
      trailPct={settings.trailPct}
      onTrail={() => trade.toggleTrail(active, trailRef, settings.trailPct)}
      onClose={() => void trade.close(active, activeLive)}
      busy={trade.busy === "close" || trade.busy === "trail" ? trade.busy : null}
      lockedText={lockedText}
    />
  ) : (
    <TradeButtons
      mode="flat"
      onUp={() => void trade.open("up")}
      onDown={() => void trade.open("down")}
      busy={trade.busy === "up" || trade.busy === "down" ? trade.busy : null}
      disabled={windowState !== "trading"}
      upSub={upTicks ? `pays ${multipleOf(upTicks)}` : undefined}
      downSub={downTicks ? `pays ${multipleOf(downTicks)}` : undefined}
    />
  );

  const chart = (
    <>
      <LiveChart symbol={spotSymbol} overlay={overlay} onFrame={onFrame} label={`${name} live price`} />
      <ReactionOverlay handle={overlayHandle} />
    </>
  );
  const stack = (
    <SettingsStack asset={symbol} size={stakeCredits} pays={upTicks && downTicks ? `${multipleOf(upTicks)}·${multipleOf(downTicks)}` : "—"} fees={feesCredits} trailPct={settings.trailPct} onOpen={() => openSheet("settings")} />
  );
  const windowChip = (
    <WindowChip lanes={win.lanes} intervalSec={win.intervalSec} onPick={setLane} closeSec={market?.expirySec ?? null} lockSec={ladder?.quotingUntilSec ?? market?.lockAtSec ?? null} nowSec={nowSec} state={windowState} />
  );
  const sheets = (
    <TerminalSheets
      open={sheet}
      onClose={() => setSheet(null)}
      onOpen={openSheet}
      target={sheetTarget}
      symbol={symbol}
      mode={mode}
      cashBase={cashBase}
      equity={equity}
      stakeCredits={stakeCredits}
      minCredits={MIN_STAKE_CREDITS}
      quotes={quotes}
      linePrice={linePrice}
      closeSec={market?.expirySec ?? null}
      poolAddress={market?.poolAddress ?? null}
      activeMarketId={market?.marketId ?? null}
      positions={positions}
      book={book}
      markets={pickerMarkets}
      nowSec={nowSec}
      totalsPnl={totals.pnl}
      closingAll={closingAll}
      onCloseAll={() => void closeAll()}
      onPickSymbol={(s) => router.push(`/trade/${s}`)}
      onAdd={(p, add) => void trade.open(p.side, add)}
      onReduce={(p, contracts) => void trade.close(p, book.get(p.id) ?? null, "close", contracts)}
      onTakeSeat={() => session.connect()}
    />
  );

  if (desktop) {
    return (
      <div className="grid h-dvh grid-cols-[13.75rem_minmax(0,1fr)_20rem] overflow-hidden bg-ow-canvas text-ow-ink">
        <TerminalNav onMarkets={() => openSheet("markets")} onHistory={() => openSheet("history")} onAccountSettings={() => openSheet("account-settings")} />
        <section className="relative min-w-0 overflow-hidden">
          {chart}
          <div className="absolute top-4 left-4 z-20 flex flex-col items-start gap-2">
            <AssetChip asset={symbol} name={name} price={spot} onOpen={() => openSheet("markets")} />
            {windowChip}
          </div>
          <div className="absolute top-1/2 left-0 z-30 -translate-y-1/2">{stack}</div>
        </section>
        <aside className="flex min-h-0 flex-col gap-3 border-l border-ow-hairline p-4">
          <div className="flex justify-end">
            <EquityPill equity={mode === "live" && !address ? null : equity} demo={mode === "demo"} onOpen={() => openSheet("account")} />
          </div>
          <UnrealizedCard totals={totals} count={positions.length} onCloseAll={() => void closeAll()} closingAll={closingAll} />
          <PositionsList positions={positions} book={book} nowSec={nowSec} onShare={(p) => openSheet("share", p)} onAdd={(p) => openSheet("add", p)} onReduce={(p) => openSheet("reduce", p)} />
          {buttons}
        </aside>
        <TradeToasts />
        {sheets}
      </div>
    );
  }

  return (
    <main className="relative flex h-dvh w-full flex-col overflow-hidden bg-ow-canvas text-ow-ink">
      <div className="absolute inset-0 z-10">{chart}</div>
      <div className="absolute top-1/2 left-0 z-30 -translate-y-1/2">{stack}</div>
      <header className="relative z-20 flex flex-col gap-2 px-3 pt-[calc(env(safe-area-inset-top,0rem)+1rem)]">
        <div className="flex items-center justify-between gap-2">
          <AssetChip asset={symbol} name={name} price={spot} onOpen={() => openSheet("markets")} />
          <EquityPill equity={mode === "live" && !address ? null : equity} demo={mode === "demo"} onOpen={() => openSheet("account")} />
        </div>
        {windowChip}
      </header>
      <div className="flex-1" />
      <footer className="relative z-20 flex flex-col gap-3 px-4 pb-[calc(env(safe-area-inset-bottom,0rem)+1rem)]">
        {positions.length > 0 ? <ViewPositionPill count={positions.length} roiPct={totals.cost > 0 ? (totals.pnl / totals.cost) * 100 : 0} onOpen={() => openSheet("positions")} /> : null}
        {buttons}
      </footer>
      <TradeToasts />
      {sheets}
    </main>
  );
}

const cadenceWord = (sec: number) => (sec % 3600 === 0 ? `${sec / 3600}h` : `${Math.round(sec / 60)}m`);

export type { LivePnlView };
