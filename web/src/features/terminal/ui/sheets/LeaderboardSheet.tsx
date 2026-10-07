"use client";

import { isOk } from "@owarine/core/schemas";
import type { Address } from "@owarine/core/types";
import { partyLead, shortHex } from "@owarine/core/units";
import { usePublishedHistory, useWalletHistory } from "@owarine/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Sheet } from "@/components/kit";
import { glyphFromAddress, LEADERBOARD_KEY, useLeaderboard, type BoardPeriod, type BoardRanking, type RankBy } from "@/features/leaderboard";
import { haptic } from "@/lib/haptics";
import { playTrade } from "@/lib/sound/trade";
import { cn } from "@/lib/utils";
import { useWalletSession } from "@/lib/wallet-session";
import { fixedText } from "../../format";

const tap = () => (playTrade("tap"), haptic("tap"));

/** Tradash's period tabs on Owarine's rolling boards. */
const PERIODS: Array<[BoardPeriod, string]> = [["24h", "Daily"], ["7d", "Weekly"], ["30d", "Monthly"], ["all", "All time"]];
const RANKS: Array<[RankBy, string]> = [["roi", "ROI"], ["pnl", "PnL"]];
const MEDAL = ["bg-ow-medal-gold", "bg-ow-medal-silver", "bg-ow-medal-bronze"] as const;
const RECENT = 5;

/** A Canton party keeps its readable hint before the fingerprint; anything else is a short hex. */
const nameOf = (owner: string) => (owner.includes("::") ? shortHex(owner, partyLead(owner), 4) : shortHex(owner));
/** A party's own initial (its readable hint); a bare address gets the board's decorative glyph. */
const initialOf = (owner: string) => (owner.includes("::") ? owner.charAt(0).toUpperCase() : glyphFromAddress(owner));
const signed = (n: number, dp: number, unit = "") => `${n >= 0 ? "+" : "−"}${fixedText(n, dp)}${unit}`;
const tone = (n: number) => (n >= 0 ? "text-ow-up" : "text-ow-down");

function Chips<T extends string>({ items, value, onPick, label }: { items: Array<[T, string]>; value: T; onPick: (v: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex gap-1 rounded-full bg-ow-recessed/60 p-1">
      {items.map(([v, text]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => (tap(), onPick(v))}
          className={cn("h-8 flex-1 rounded-full px-3 text-ow-caption font-bold", value === v ? "bg-ow-ink text-ow-inverse" : "text-ow-muted")}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

function Disc({ owner, size = "size-9", medal }: { owner: string; size?: string; medal?: number }) {
  return (
    <span className={cn("relative grid shrink-0 place-items-center rounded-full bg-ow-recessed font-bold", size)}>
      {initialOf(owner)}
      {medal !== undefined ? (
        <span className={cn("absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full text-ow-micro font-bold text-ow-black ring-2 ring-ow-card", MEDAL[medal])}>{medal + 1}</span>
      ) : null}
    </span>
  );
}

interface Figures {
  pnl: number;
  roi: number | null;
}
const figuresOf = (r: BoardRanking, d: number): Figures => ({ pnl: Number(r.pnlBase) / 10 ** d, roi: r.roiBps === null ? null : r.roiBps / 100 });

function Headline({ f, rankBy, className }: { f: Figures; rankBy: RankBy; className?: string }) {
  const main = rankBy === "roi" && f.roi !== null ? signed(f.roi, 1, "%") : signed(f.pnl, 2);
  return <span className={cn("ow-num font-bold", tone(rankBy === "roi" && f.roi !== null ? f.roi : f.pnl), className)}>{main}</span>;
}

function Podium({ top, decimals, rankBy, you, onPick }: { top: BoardRanking[]; decimals: number; rankBy: RankBy; you: string | null; onPick: (i: number) => void }) {
  const order = top.length === 3 ? [1, 0, 2] : top.map((_, i) => i);
  return (
    <div className="grid grid-cols-3 items-end gap-2">
      {order.map((i) => {
        const r = top[i]!;
        return (
          <button
            key={r.owner}
            type="button"
            onClick={() => (tap(), onPick(i))}
            className={cn("flex flex-col items-center gap-1.5 rounded-ow-card bg-ow-recessed/60 px-2 pb-3", i === 0 ? "pt-5" : "pt-3", r.owner === you && "ring-2 ring-ow-pink")}
          >
            <Disc owner={r.owner} size={i === 0 ? "size-14 text-ow-title" : "size-11"} medal={i} />
            <span className="w-full truncate text-ow-caption font-semibold">{nameOf(r.owner)}</span>
            <Headline f={figuresOf(r, decimals)} rankBy={rankBy} className="text-ow-body" />
          </button>
        );
      })}
    </div>
  );
}

/** One trader: rank, the board's figures, and their published trades. */
function Profile({ ranking, rank, decimals, own }: { ranking: BoardRanking; rank: number | null; decimals: number; own: boolean }) {
  const [more, setMore] = useState(false);
  const mine = useWalletHistory(own ? ranking.owner : null, own);
  const published = usePublishedHistory(own ? null : ranking.owner, !own);
  const history = own ? mine : published;
  const f = figuresOf(ranking, decimals);
  const rounds = history && isOk(history) ? [...history.value.rounds].sort((a, b) => (b.settledAtMs ?? 0) - (a.settledAtMs ?? 0)) : [];
  const decided = rounds.filter((r) => r.outcome === "win" || r.outcome === "loss");
  const wins = decided.length ? decided.filter((r) => r.outcome === "win").length : Math.round((ranking.winRatePct / 100) * ranking.settledTrades);
  const losses = decided.length ? decided.length - wins : ranking.settledTrades - wins;
  const stats: Array<[string, ReactNode]> = [
    ["PnL", <span key="p" className={tone(f.pnl)}>{signed(f.pnl, 2)}</span>],
    ["ROI", f.roi === null ? "—" : <span key="r" className={tone(f.roi)}>{signed(f.roi, 1, "%")}</span>],
    ["Trades", String(ranking.tradeCount)],
    ["Win rate", `${ranking.winRatePct}%`],
    ["Wins", String(wins)],
    ["Losses", String(losses)],
    ["Avg size", ranking.tradeCount ? fixedText(Number(ranking.volumeBase) / 10 ** decimals / ranking.tradeCount, 2) : "—"],
  ];
  const shown = more ? rounds : rounds.slice(0, RECENT);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Disc owner={ranking.owner} size="size-14 text-ow-title" medal={rank !== null && rank <= 3 ? rank - 1 : undefined} />
        <div className="min-w-0">
          <p className="truncate text-ow-body font-bold">{nameOf(ranking.owner)}</p>
          <p className="text-ow-caption text-ow-muted">{rank === null ? "Unranked" : `Rank #${rank}`}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {stats.map(([k, v]) => (
          <div key={k} className="rounded-ow-card bg-ow-recessed/60 p-3">
            <p className="text-ow-micro text-ow-muted">{k}</p>
            <p className="ow-num text-ow-body font-bold">{v}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="px-1 text-ow-micro font-bold tracking-[0.1em] text-ow-muted">RECENT TRADES</p>
        {history === null ? (
          <p className="py-6 text-center text-ow-caption text-ow-muted">Loading…</p>
        ) : !isOk(history) ? (
          <p className="py-6 text-center text-ow-caption text-ow-muted">Couldn&rsquo;t load this profile.</p>
        ) : rounds.length === 0 ? (
          <p className="py-6 text-center text-ow-caption text-ow-muted">No published trades.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {shown.map((r) => {
              const up = r.sidesTraded[0] !== 1;
              const Dir = up ? ArrowUpRight : ArrowDownRight;
              const pnl = Number(r.pnlBase) / 10 ** r.decimals;
              const stake = Number(r.stakeBase) / 10 ** r.decimals;
              return (
                <li key={`${r.marketId}:${r.openedAtMs}`} className="flex items-center gap-3 rounded-ow-card bg-ow-recessed/40 px-3 py-2.5">
                  <span className={cn("grid size-8 place-items-center rounded-full", up ? "ow-up-soft" : "ow-down-soft")}>
                    <Dir className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1 text-ow-body font-semibold">{r.asset}</span>
                  <span className="flex flex-col items-end">
                    <span className={cn("ow-num text-ow-body font-bold", tone(pnl))}>{signed(pnl, 2)}</span>
                    <span className="ow-num text-ow-micro text-ow-muted">{stake > 0 ? signed((pnl / stake) * 100, 1, "%") : "—"}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {!more && rounds.length > RECENT ? (
          <button type="button" onClick={() => (tap(), setMore(true))} className="h-10 rounded-full bg-ow-recessed text-ow-caption font-bold">
            Show more ({rounds.length - RECENT})
          </button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Tradash's leaderboard (`aR`): rank by ROI or PnL over Daily / Weekly / Monthly / All time, a podium with gold, silver and
 * bronze, the field below, and a trader's profile on tap. Owarine ranks published trades only — a position on Canton
 * is private until its owner publishes it.
 */
export function LeaderboardSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [period, setPeriod] = useState<BoardPeriod>("24h");
  const [rankBy, setRankBy] = useState<RankBy>("roi");
  const [picked, setPicked] = useState<BoardRanking | null>(null);
  const { address } = useWalletSession();
  const reading = useLeaderboard({ period, ticker: null, rankBy });
  const queryClient = useQueryClient();
  const data = reading && isOk(reading) ? reading.value : null;
  const decimals = data?.meta.decimals ?? 6;
  const rankings = data?.rankings ?? [];
  const pick = (r: BoardRanking) => setPicked(r);
  const close = () => (setPicked(null), onClose());

  if (picked) {
    const at = rankings.findIndex((r) => r.owner === picked.owner);
    return (
      <Sheet open={open} onOpenChange={(o) => !o && close()} title="Trader" onBack={() => setPicked(null)}>
        <Profile ranking={picked} rank={at < 0 ? null : at + 1} decimals={decimals} own={picked.owner === address} />
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && close()} title="Leaderboard">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <span className="text-ow-caption text-ow-muted">Rank by</span>
            <div className="flex-1">
              <Chips items={RANKS} value={rankBy} onPick={setRankBy} label="Rank by" />
            </div>
          </div>
          <Chips items={PERIODS} value={period} onPick={setPeriod} label="Period" />
        </div>
        {reading === null ? (
          <p className="py-10 text-center text-ow-caption text-ow-muted">Loading…</p>
        ) : !data ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <p className="text-ow-caption text-ow-muted">Couldn&rsquo;t load the leaderboard.</p>
            <button type="button" onClick={() => (tap(), void queryClient.invalidateQueries({ queryKey: LEADERBOARD_KEY }))} className="h-10 rounded-full bg-ow-ink px-5 text-ow-caption font-bold text-ow-inverse">
              Try again
            </button>
          </div>
        ) : rankings.length === 0 ? (
          <p className="py-10 text-center text-ow-caption text-ow-muted">{period === "all" ? "No ranked traders yet. Publish a call from your open positions, and it counts here once it settles." : "No published trades in this period."}</p>
        ) : (
          <>
            <Podium top={rankings.slice(0, 3)} decimals={decimals} rankBy={rankBy} you={address} onPick={(i) => pick(rankings[i]!)} />
            <ul className="flex flex-col gap-1.5">
              {rankings.slice(3).map((r, i) => (
                <li key={r.owner}>
                  <button
                    type="button"
                    onClick={() => (tap(), pick(r))}
                    className={cn("flex w-full items-center gap-3 rounded-ow-card bg-ow-recessed/40 px-3 py-2.5 text-left hover:bg-ow-recessed", r.owner === address && "ring-2 ring-ow-pink")}
                  >
                    <span className="ow-num w-6 text-center text-ow-caption font-bold text-ow-muted">{i + 4}</span>
                    <Disc owner={r.owner} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-ow-body font-semibold">{r.owner === address ? "You" : nameOf(r.owner as Address)}</span>
                      <span className="text-ow-micro text-ow-muted">
                        {r.tradeCount} trades · {r.winRatePct}% wins
                      </span>
                    </span>
                    <Headline f={figuresOf(r, decimals)} rankBy={rankBy} className="text-ow-body" />
                    <ChevronRight className="size-4 text-ow-muted" />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        {data && !data.meta.complete ? <p className="text-center text-ow-micro text-ow-muted">Partial: the scan hit its page cap for this period, so some published trades are missing.</p> : null}
      </div>
    </Sheet>
  );
}
