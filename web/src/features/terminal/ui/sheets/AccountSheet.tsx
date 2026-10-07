"use client";

import { useWalletHistory } from "@owarine/markets/react";
import { ArrowDownRight, ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, ArrowUpRight, ChevronRight, CircleHelp, Download, History, Play, Settings, Trophy } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Odometer, Seal, Sheet } from "@/components/kit";
import { AddFunds } from "@/features/funding";
import { haptic } from "@/lib/haptics";
import { playTrade, setTradeMuted } from "@/lib/sound/trade";
import { cn } from "@/lib/utils";
import { useWalletSession } from "@/lib/wallet-session";
import { moneyDecimals } from "../../format";
import { resetDemo, setMode, useModeState, type TradeMode } from "../../mode";
import { MUSIC_TRACKS, setTradeSettings, SLIPPAGE_CHOICES_BPS, useTradeSettings } from "../../settings";
import { episodeFor, replayable, useEpisodes, type Episode } from "../../replay";
import { toast } from "../../toasts";

export type AccountView = "menu" | "settings" | "history";
const tap = () => (playTrade("tap"), haptic("tap"));

export interface HistoryRow {
  id: string;
  /** The Window, where the row knows it (seat rows); paper rows match their replay by id. */
  marketId?: string;
  asset: string;
  side: "up" | "down";
  intervalSec: number;
  pnl: number;
  cost: number;
  openedAtMs: number;
  closedAtMs: number;
  tag: string | null;
}

function useHistoryRows(mode: TradeMode): { rows: HistoryRow[]; loading: boolean } {
  const modeState = useModeState();
  const { address } = useWalletSession();
  const seat = useWalletHistory(mode === "live" ? address : null);
  if (mode === "demo") {
    return {
      loading: false,
      rows: modeState.history
        .filter((t) => t.kind !== "add")
        .map((t) => ({ id: t.id, asset: t.asset, side: t.side, intervalSec: t.intervalSec, pnl: Number(t.pnlBase) / 1e6, cost: Number(t.costBase) / 1e6, openedAtMs: t.openedAtMs, closedAtMs: t.closedAtMs, tag: t.kind === "reduce" ? "REDUCE" : t.kind === "trail" ? "TRAIL" : t.kind === "settle" ? "SETTLED" : null })),
    };
  }
  if (!seat || !seat.ok) return { rows: [], loading: seat === null };
  const d = 10 ** seat.value.decimals;
  return {
    loading: false,
    rows: seat.value.rounds.map((r) => ({
      id: `${r.marketId}:${r.openedAtMs}`, marketId: r.marketId, asset: r.asset, side: r.sidesTraded[0] === 1 ? "down" : "up", intervalSec: r.intervalSec, pnl: Number(r.pnlBase) / d, cost: Number(r.stakeBase) / d,
      openedAtMs: r.openedAtMs, closedAtMs: r.settledAtMs ?? r.expirySec * 1000, tag: r.outcome === "closed" ? null : "SETTLED",
    })),
  };
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="px-1 text-ow-micro font-bold tracking-[0.1em] text-ow-muted">{title}</span>
      <div className="overflow-hidden rounded-ow-card bg-ow-recessed/60">{children}</div>
    </div>
  );
}

function Item({ icon: Icon, label, detail, onClick, href }: { icon: typeof History; label: string; detail?: string; onClick?: () => void; href?: string }) {
  const body = (
    <>
      <Icon className="size-5 text-ow-muted" />
      <span className="flex-1 text-left text-ow-body">{label}</span>
      {detail ? <span className="text-ow-caption text-ow-muted">{detail}</span> : null}
      <ChevronRight className="size-4 text-ow-muted" />
    </>
  );
  const cls = "flex h-12 w-full items-center gap-3 border-b border-ow-hairline px-4 last:border-b-0 hover:bg-ow-recessed";
  return href ? (
    <Link href={href} className={cls} onClick={tap}>
      {body}
    </Link>
  ) : (
    <button type="button" className={cls} onClick={() => (tap(), onClick?.())}>
      {body}
    </button>
  );
}

function Toggle({ label, sub, on, onChange }: { label: string; sub?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => (tap(), onChange(!on))} className="flex w-full items-center gap-3 border-b border-ow-hairline px-4 py-3 text-left last:border-b-0">
      <span className="flex-1">
        <span className="block text-ow-body">{label}</span>
        {sub ? <span className="block text-ow-caption text-ow-muted">{sub}</span> : null}
      </span>
      <span className={cn("relative h-7 w-12 rounded-full transition-colors", on ? "bg-ow-up-line" : "bg-ow-hairline")}>
        <span className={cn("absolute top-1 size-5 rounded-full bg-ow-white transition-[left]", on ? "left-6" : "left-1")} />
      </span>
    </button>
  );
}

/**
 * Tradash's Account sheet `ae`, for a seat: profile, the balance with today's P&L, the money actions, Trading and App
 * groups, and the demo reset; its Settings (mode, feedback, music, Close tolerance) and Trade history (stats + list).
 */
export function AccountSheet({ open, onClose, initialView, mode, equity, todayPnl, onTour, onTakeSeat, onReplay, onLeaderboard }: {
  open: boolean;
  onClose: () => void;
  initialView: AccountView;
  mode: TradeMode;
  equity: number | null;
  todayPnl: number;
  onTour: () => void;
  onTakeSeat: () => void;
  onReplay: (row: HistoryRow, episode: Episode) => void;
  onLeaderboard: () => void;
}) {
  const [view, setView] = useState<AccountView>(initialView);
  const [viewFor, setViewFor] = useState(initialView);
  if (viewFor !== initialView) {
    setViewFor(initialView);
    setView(initialView);
  }
  const [funds, setFunds] = useState(false);
  const session = useWalletSession();
  const settings = useTradeSettings();
  const history = useHistoryRows(mode);
  const title = view === "settings" ? "Settings" : view === "history" ? "Trade history" : "Account";

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => (o ? undefined : (onClose(), setView("menu")))} title={title} onBack={view !== "menu" ? () => setView("menu") : undefined}>
        {view === "menu" ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col items-center gap-3 pt-2">
              <span className="grid size-24 place-items-center rounded-full bg-ow-pink">
                <Seal size={58} tone="white" />
              </span>
              <span className="text-ow-lead font-bold">{session.address ? "Your seat" : "Guest"}</span>
              {!session.address ? (
                <button type="button" onClick={() => (tap(), onTakeSeat())} className="h-12 w-full rounded-full bg-ow-pink text-ow-lead font-bold text-ow-on-pink">
                  Take a seat
                </button>
              ) : null}
            </div>
            <div className="rounded-ow-card bg-ow-recessed/60 p-4">
              <p className="ow-num text-ow-display font-bold">{equity === null ? "—" : <Odometer kind="plain" value={equity} decimals={2} />}</p>
              <p className="text-ow-caption text-ow-muted">
                Today&rsquo;s P&amp;L <Odometer kind="plain" signed tone value={todayPnl} decimals={moneyDecimals(todayPnl)} className="font-semibold" />
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-ow-card bg-ow-card p-3">
                  <p className="text-ow-micro text-ow-muted">{mode === "demo" ? "Demo" : "Seat"}</p>
                  <p className="ow-num text-ow-body font-semibold">{equity === null ? "—" : equity.toFixed(2)}</p>
                </div>
                <div className="rounded-ow-card bg-ow-card p-3">
                  <p className="text-ow-micro text-ow-muted">Trading Balance</p>
                  <p className="text-ow-body font-semibold">{mode === "demo" ? "—" : <Link href="/portfolio" className="text-ow-pink-ink">Open</Link>}</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {(
                [
                  [ArrowDownToLine, "Add funds", () => (mode === "demo" ? toast({ kind: "info", title: "Demo uses a simulated balance", description: "Reset it anytime from this sheet." }) : setFunds(true))],
                  [ArrowUpFromLine, "Withdraw", () => toast({ kind: "info", title: "Withdrawals come with the Canton Coin rail", description: "Seats hold demo credits on DevNet today." })],
                  [ArrowLeftRight, "Transfer", () => (window.location.href = "/portfolio")],
                  [History, "History", () => setView("history")],
                ] as const
              ).map(([Icon, label, act]) => (
                <button key={label} type="button" onClick={() => (tap(), act())} className="flex flex-col items-center gap-1.5">
                  <span className="grid size-12 place-items-center rounded-full border border-ow-hairline">
                    <Icon className="size-5" />
                  </span>
                  <span className="text-ow-micro text-ow-muted">{label}</span>
                </button>
              ))}
            </div>
            <Group title="TRADING">
              <Item icon={History} label="Trade history" onClick={() => setView("history")} />
              <Item icon={Trophy} label="Leaderboard" onClick={onLeaderboard} />
              <Item icon={Settings} label="Settings" onClick={() => setView("settings")} />
            </Group>
            <Group title="APP">
              <Item icon={CircleHelp} label="How it works" onClick={onTour} />
              <Item icon={Download} label="Install app" href="/download" />
            </Group>
            {mode === "demo" ? (
              <button type="button" onClick={() => (tap(), resetDemo(), toast({ kind: "info", title: "Demo balance reset", description: "10,000 credits, no open positions." }))} className="h-12 rounded-ow-card bg-ow-recessed/60 text-ow-body">
                Reset demo balance
              </button>
            ) : session.address ? (
              <button type="button" onClick={() => (tap(), window.confirm("Reset your seat? You'll take a new one; positions stay on the ledger.") && void session.disconnect())} className="h-12 rounded-ow-card bg-ow-recessed/60 text-ow-body text-ow-down">
                Reset seat
              </button>
            ) : null}
          </div>
        ) : view === "settings" ? (
          <div className="flex flex-col gap-4">
            <Group title="MODE">
              <Toggle label="Demo mode" sub={mode === "demo" ? "Practising with simulated credits" : "Trading live on Canton"} on={mode === "demo"} onChange={(v) => setMode(v ? "demo" : "live")} />
            </Group>
            <Group title="FEEDBACK">
              <Toggle label="Sound effects" on={settings.soundEnabled} onChange={(v) => (setTradeSettings({ soundEnabled: v }), setTradeMuted(!v))} />
              <Toggle label="Haptics" on={settings.hapticsEnabled} onChange={(v) => setTradeSettings({ hapticsEnabled: v })} />
              <Toggle label="Trade reactions" sub="Emoji callouts on the chart as your trade moves" on={settings.reactionsEnabled} onChange={(v) => setTradeSettings({ reactionsEnabled: v })} />
            </Group>
            <Group title="MUSIC">
              <Toggle label="Music" on={settings.musicEnabled} onChange={(v) => setTradeSettings({ musicEnabled: v })} />
              <div className="flex gap-2 p-3">
                {MUSIC_TRACKS.map((t) => (
                  <button key={t} type="button" onClick={() => (tap(), setTradeSettings({ musicTrack: t }))} className={cn("h-9 flex-1 rounded-full text-ow-caption font-bold capitalize", settings.musicTrack === t ? "ow-up-solid" : "bg-ow-card")}>
                    {t}
                  </button>
                ))}
              </div>
            </Group>
            <Group title="CLOSE TOLERANCE">
              <p className="px-4 pt-3 text-ow-caption text-ow-muted">A one-tap Close takes the venue&rsquo;s firm price when it is at most this far under the price on screen.</p>
              <div className="flex gap-2 p-3">
                {SLIPPAGE_CHOICES_BPS.map((bps) => (
                  <button key={bps} type="button" onClick={() => (tap(), setTradeSettings({ slippageBps: bps }))} className={cn("h-9 flex-1 rounded-full text-ow-caption font-bold", settings.slippageBps === bps ? "ow-up-solid" : "bg-ow-card")}>
                    {bps / 100}%
                  </button>
                ))}
              </div>
            </Group>
          </div>
        ) : (
          <TradeHistory rows={history.rows} loading={history.loading} onReplay={onReplay} />
        )}
      </Sheet>
      <AddFunds open={funds} onClose={() => setFunds(false)} />
    </>
  );
}

function TradeHistory({ rows, loading, onReplay }: { rows: HistoryRow[]; loading: boolean; onReplay: (row: HistoryRow, episode: Episode) => void }) {
  const episodes = useEpisodes();
  const closed = rows;
  const wins = closed.filter((r) => r.pnl > 0).length;
  let streak = 0;
  let best = 0;
  let run = 0;
  for (const r of [...closed].reverse()) {
    run = r.pnl > 0 ? run + 1 : 0;
    best = Math.max(best, run);
  }
  for (const r of closed) {
    if (r.pnl > 0) streak += 1;
    else break;
  }
  const lifetime = closed.reduce((s, r) => s + r.pnl, 0);
  const volume = closed.reduce((s, r) => s + r.cost, 0);
  const stats: Array<[string, ReactNode]> = [
    ["Lifetime PnL", <span key="l" className={lifetime >= 0 ? "text-ow-up" : "text-ow-down"}>{`${lifetime >= 0 ? "+" : "−"}${Math.abs(lifetime).toFixed(2)}`}</span>],
    ["Win rate", closed.length ? `${Math.round((wins / closed.length) * 100)}%` : "—"],
    ["Trades", String(closed.length)],
    ["Win streak", String(streak)],
    ["Best streak", String(best)],
    ["Volume", volume.toFixed(2)],
  ];
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2">
        {stats.map(([k, v]) => (
          <div key={k} className="rounded-ow-card bg-ow-recessed/60 p-3">
            <p className="text-ow-micro text-ow-muted">{k}</p>
            <p className="ow-num text-ow-body font-bold">{v}</p>
          </div>
        ))}
      </div>
      {loading ? (
        <div className="flex flex-col gap-2">{Array.from({ length: 5 }, (_, i) => <div key={i} className="h-14 animate-pulse rounded-ow-card bg-ow-recessed/60" />)}</div>
      ) : closed.length === 0 ? (
        <p className="py-8 text-center text-ow-body text-ow-muted">No trades yet. Tap UP or DOWN to start.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {closed.map((r) => {
            const Dir = r.side === "up" ? ArrowUpRight : ArrowDownRight;
            const roi = r.cost > 0 ? (r.pnl / r.cost) * 100 : 0;
            const ep = episodeFor(episodes, r);
            const canReplay = ep !== null && replayable(ep);
            return (
              <li
                key={r.id}
                onClick={canReplay ? () => (tap(), onReplay(r, ep!)) : undefined}
                className={cn("flex items-center gap-3 rounded-ow-card bg-ow-recessed/40 px-3 py-2.5", canReplay && "cursor-pointer hover:bg-ow-recessed")}
              >
                <span className={cn("grid size-9 place-items-center rounded-full", r.side === "up" ? "ow-up-soft" : "ow-down-soft")}>
                  <Dir className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-ow-body font-semibold">
                    {r.asset}
                    {canReplay ? <Play aria-label="Replayable" className="size-3.5 text-ow-pink-ink" /> : null}
                    {r.tag ? <span className="rounded bg-ow-card px-1 text-ow-micro font-bold text-ow-muted">{r.tag}</span> : null}
                  </span>
                  <span className="text-ow-micro text-ow-muted">
                    {cadence(r.intervalSec)} · {duration(r.closedAtMs - r.openedAtMs)}
                  </span>
                </span>
                <span className="flex flex-col items-end">
                  <span className={cn("ow-num text-ow-body font-bold", r.pnl >= 0 ? "text-ow-up" : "text-ow-down")}>{`${r.pnl >= 0 ? "+" : "−"}${Math.abs(r.pnl).toFixed(2)}`}</span>
                  <span className="ow-num text-ow-micro text-ow-muted">{`${roi >= 0 ? "+" : "−"}${Math.abs(roi).toFixed(1)}%`}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const cadence = (sec: number) => (sec % 3600 === 0 ? `${sec / 3600}h` : `${Math.round(sec / 60)}m`);
function duration(ms: number): string {
  const s = Math.max(0, ms / 1000);
  if (s < 60) return `${Math.round(s)}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86_400) return `${(s / 3600).toFixed(1)}h`;
  return `${(s / 86_400).toFixed(1)}d`;
}
