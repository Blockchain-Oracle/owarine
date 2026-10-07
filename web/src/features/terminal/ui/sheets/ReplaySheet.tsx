"use client";

import { Pause, Play, RotateCcw, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Odometer, Sheet } from "@/components/kit";
import { haptic } from "@/lib/haptics";
import { playTrade } from "@/lib/sound/trade";
import { clockText, moneyDecimals } from "../../format";
import { coverage, type Episode } from "../../replay";

const tap = () => (playTrade("tap"), haptic("tap"));
/** A replay plays in at most this long, whatever the trade lasted. */
const PLAY_MS = 12_000;

function duration(ms: number): string {
  const s = Math.max(0, ms / 1000);
  if (s < 60) return `${Math.round(s)}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  return `${(s / 3600).toFixed(1)}h`;
}

/** The PnL at time `t`: the last recorded one at or before it (back-filled samples carry none). */
function pnlAt(samples: Episode["samples"], t: number): number {
  let out = 0;
  for (const [ts, , pnl] of samples) {
    if (ts > t) break;
    if (pnl !== null) out = pnl;
  }
  return out;
}

function draw(canvas: HTMLCanvasElement, e: Episode, upTo: number): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cs = getComputedStyle(canvas);
  const v = (n: string) => cs.getPropertyValue(n).trim();
  const s = e.samples;
  const t0 = s[0]![0];
  const t1 = s.at(-1)![0];
  const prices = [...s.map((x) => x[1]), ...(e.entrySpot ? [e.entrySpot] : []), ...(e.line ? [e.line] : [])];
  let lo = Math.min(...prices);
  let hi = Math.max(...prices);
  const pad = Math.max((hi - lo) * 0.15, hi * 0.0001);
  lo -= pad;
  hi += pad;
  const w = rect.width;
  const h = rect.height;
  const x = (t: number) => ((t - t0) / Math.max(1, t1 - t0)) * (w - 8) + 4;
  const y = (p: number) => h - 8 - ((p - lo) / (hi - lo)) * (h - 16);
  ctx.clearRect(0, 0, w, h);
  const level = (price: number | null, colour: string, dash: number[]) => {
    if (!price) return;
    ctx.save();
    ctx.strokeStyle = colour;
    ctx.globalAlpha = 0.6;
    ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(0, Math.round(y(price)) + 0.5);
    ctx.lineTo(w, Math.round(y(price)) + 0.5);
    ctx.stroke();
    ctx.restore();
  };
  level(e.entrySpot, v("--ow-ink"), [4, 4]);
  level(e.line, v("--ow-down-line"), [2, 3]);
  const tone = pnlAt(s, upTo) >= 0 ? v("--ow-up-line") : v("--ow-down-line");
  ctx.strokeStyle = tone;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.beginPath();
  let last: [number, number] | null = null;
  for (const [t, p] of s) {
    if (t > upTo) break;
    if (!last) ctx.moveTo(x(t), y(p));
    else ctx.lineTo(x(t), y(p));
    last = [x(t), y(p)];
  }
  ctx.stroke();
  if (last) {
    ctx.fillStyle = tone;
    ctx.beginPath();
    ctx.arc(last[0], last[1], 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Tradash's replay `lo`: the recorded path played back with its PnL, a scrubber, the recording's coverage, and Share. */
export function ReplaySheet({ open, onClose, episode, finalPnl, onShare }: { open: boolean; onClose: () => void; episode: Episode | null; finalPnl: number | null; onShare: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [progress, setProgress] = useState(1);
  const [playing, setPlaying] = useState(false);
  const raf = useRef(0);

  useEffect(() => {
    if (open) {
      setProgress(0);
      setPlaying(true);
    }
  }, [open, episode?.positionId]);

  const s = episode?.samples ?? [];
  const t0 = s[0]?.[0] ?? 0;
  const t1 = s.at(-1)?.[0] ?? 0;
  const upTo = t0 + (t1 - t0) * progress;

  useEffect(() => {
    if (!playing || !episode) return;
    const span = Math.min(PLAY_MS, t1 - t0);
    let last = performance.now();
    const step = (now: number) => {
      const dt = now - last;
      last = now;
      setProgress((p) => {
        const next = Math.min(1, p + dt / Math.max(1, span));
        if (next >= 1) setPlaying(false);
        return next;
      });
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, episode, t0, t1]);

  useEffect(() => {
    if (canvas.current && episode && s.length > 1) draw(canvas.current, episode, upTo);
  }, [episode, upTo, s.length]);

  if (!episode) return null;
  const realized = progress >= 1 && finalPnl !== null;
  const pnl = realized ? finalPnl : pnlAt(s, upTo);
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title={`${episode.side === "up" ? "Up" : "Down"} ${episode.asset}`}>
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-ow-caption text-ow-muted">{realized ? "Realized" : "Unrealized"}</p>
          <Odometer kind="plain" signed tone zeroIsUp value={pnl} decimals={realized ? 2 : moneyDecimals(pnl)} className="text-ow-title font-bold" />
        </div>
        <canvas ref={canvas} className="h-60 w-full rounded-ow-card bg-ow-recessed/50" aria-label="Replay of the trade's price path" />
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label={playing ? "Pause" : progress >= 1 ? "Replay" : "Play"}
            onClick={() => {
              tap();
              if (progress >= 1) setProgress(0);
              setPlaying((p) => !p || progress >= 1);
            }}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-ow-ink text-ow-inverse"
          >
            {playing ? <Pause className="size-5" /> : progress >= 1 ? <RotateCcw className="size-5" /> : <Play className="size-5" />}
          </button>
          <input type="range" min={0} max={1000} value={Math.round(progress * 1000)} onChange={(e) => (setPlaying(false), setProgress(Number(e.target.value) / 1000))} className="w-full accent-[var(--ow-pink)]" aria-label="Scrub the replay" />
        </div>
        <div className="flex flex-wrap justify-between gap-2 text-ow-caption text-ow-muted">
          <span>{duration(t1 - t0)}</span>
          <span>{Math.round(coverage(episode) * 100)}% recorded</span>
          {episode.closedAtMs ? <span>Closed {clockText(Math.floor(episode.closedAtMs / 1000))}</span> : null}
        </div>
        <button type="button" onClick={() => (tap(), onShare())} className="flex h-12 items-center justify-center gap-2 rounded-full bg-ow-recessed font-bold">
          <Share2 className="size-4" /> Share
        </button>
      </div>
    </Sheet>
  );
}
