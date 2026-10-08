"use client";

import { CheckCircle2, Lock } from "lucide-react";
import Link from "next/link";
import { FluentArt, InfiniteSlider, Odometer } from "@/components/kit";
import { AssetDisc } from "@/features/markets/hero/asset-mark";
import { formatPrice } from "@/features/terminal/chart/engine";
import { multipleOf } from "@/features/terminal/format";
import { TradeButtons } from "@/features/terminal/ui/TradeButtons";
import { cn } from "@/lib/utils";
import "@/features/terminal/terminal.css";
import { useHeroEngine } from "./hero/engine";
import { useLandingBoard } from "./useLandingBoard";
import { WORDS } from "./words";

const cadence = (sec: number) => (sec % 3600 === 0 ? `${sec / 3600}h` : `${Math.round(sec / 60)}m`);

/** A black band of every market the venue lists, its live price and its shortest Window, sliding past. */
export function LandingTape() {
  const { rows } = useLandingBoard();
  if (rows.length === 0) return <div className="h-14 bg-ow-black" aria-hidden />;
  const items = rows.map((r) => (
    <Link key={r.symbol} href={`/trade/${r.symbol}`} className="flex shrink-0 items-center gap-2.5 px-5 text-ow-white hover:text-ow-lime">
      <AssetDisc asset={r.symbol} className="asset-disc-32" />
      <span className="text-ow-label font-bold">{r.symbol}</span>
      <span className="ow-num text-ow-label text-ow-white/80">{r.spot === null ? "—" : `$${formatPrice(r.spot)}`}</span>
      <span className="rounded-full bg-ow-white/15 px-2 py-0.5 text-ow-micro font-semibold">{cadence(r.cadenceSec)}</span>
    </Link>
  ));
  return (
    <section aria-label={WORDS.tape.label} className="bg-ow-black py-3.5">
      <InfiniteSlider gapRem={0} duration={Math.max(30, rows.length * 4)} durationOnHover={Math.max(90, rows.length * 12)} className="mask-[linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
        {items}
      </InfiniteSlider>
    </section>
  );
}

function Step({ n, title, body, art, children, className }: { n: string; title: string; body: string; art: Parameters<typeof FluentArt>[0]["name"]; children: React.ReactNode; className?: string }) {
  return (
    <article className={cn("relative flex flex-col gap-5 overflow-hidden rounded-[2.875rem] bg-ow-card p-7 sm:p-8", className)}>
      <FluentArt name={art} size={84} className="absolute -top-2 -right-2 rotate-12" />
      <span className="ow-display text-ow-hero text-ow-pink">{n}</span>
      <div className="flex flex-col gap-2">
        <h3 className="ow-display text-ow-display">{title}</h3>
        <p className="text-ow-body text-ow-muted">{body}</p>
      </div>
      <div className="mt-auto">{children}</div>
    </article>
  );
}

/** "Tap. Watch. Bank it." — Tradash's three steps, each card reading the trade the hero phone is playing right now. */
export function LandingLoop() {
  const { loop } = WORDS;
  const { symbol, market, ladder, nowSec, ghost, banked } = useHeroEngine();
  const upTicks = ladder?.up[0]?.[0] ?? 0;
  const downTicks = ladder?.down[0]?.[0] ?? 0;
  const riding = ghost.phase === "ride";
  const [call, watch, bank] = loop.steps;
  return (
    <section className="mx-auto w-full max-w-[80rem] px-4 py-24 sm:px-8">
      <div className="mb-10 flex flex-col gap-3">
        <span className="text-ow-caption font-bold tracking-[0.14em] text-ow-pink-ink uppercase">{loop.kicker}</span>
        <h2 className="ow-display ow-display-lg">{loop.title}</h2>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Step n={call.n} title={call.title} body={call.body} art="bell">
          <div className="flex flex-col gap-3 rounded-3xl bg-ow-canvas p-3">
            <span className="flex items-center gap-2 px-1 text-ow-caption font-semibold">
              <AssetDisc asset={symbol} className="asset-disc-32" /> {symbol} · {market ? `${cadence(market.intervalSec)} Window · closes in ${Math.max(0, market.expirySec - nowSec)}s` : "between Windows"}
            </span>
            <div inert className="[&_button]:h-14 [&_button]:text-ow-label">
              <TradeButtons mode="flat" onUp={() => undefined} onDown={() => undefined} busy={null} upSub={upTicks ? `pays ${multipleOf(upTicks)}` : undefined} downSub={downTicks ? `pays ${multipleOf(downTicks)}` : undefined} />
            </div>
          </div>
        </Step>
        <Step n={watch.n} title={watch.title} body={watch.body} art="chartIncreasing">
          <div className="flex items-center justify-between gap-3 rounded-3xl bg-ow-canvas p-4" data-dir={(riding ? ghost.pnl : (banked?.pnl ?? 0)) >= 0 ? "up" : "down"}>
            <span className="flex flex-col">
              <span className="text-ow-micro font-semibold text-ow-muted">{riding ? `${ghost.side === "up" ? "UP" : "DOWN"} ${symbol} · 10.00 staked` : "Unrealized PnL"}</span>
              {riding ? (
                <Odometer kind="plain" signed tone zeroIsUp value={ghost.pnl} decimals={4} className="text-ow-figure font-bold" />
              ) : (
                <span className="ow-num text-ow-figure font-bold text-ow-muted">+0.0000</span>
              )}
            </span>
            <span className={cn("size-3 rounded-full", riding ? "animate-pulse bg-(--ow-dir-line)" : "bg-ow-hairline")} aria-hidden />
          </div>
        </Step>
        <Step n={bank.n} title={bank.title} body={bank.body} art="moneyBag">
          <div className="flex flex-col gap-2 rounded-3xl bg-ow-cream p-4 text-ow-black">
            <span className="flex items-center justify-between text-ow-caption font-bold">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-4" /> {banked ? "Closed in one tap" : "Waiting for the first ride"}
              </span>
              <span className={cn("ow-num", banked && banked.pnl < 0 ? "text-ow-down" : "text-ow-up")}>{banked?.pnlText ?? "—"}</span>
            </span>
            <span className="flex items-center gap-1.5 text-ow-micro font-semibold opacity-75">
              <Lock className="size-3.5" /> Or hold: the close is signed by 3 oracle parties
            </span>
          </div>
        </Step>
      </div>
    </section>
  );
}
