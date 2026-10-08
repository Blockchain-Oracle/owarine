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
import { Rise, SectionHead, Sparkles } from "./candy";
import { useHeroEngine } from "./hero/engine";
import { useLandingBoard } from "./useLandingBoard";
import { WORDS } from "./words";

const cadence = (sec: number) => (sec % 3600 === 0 ? `${sec / 3600}h` : `${Math.round(sec / 60)}m`);

/** Every market the venue lists, its live price and its shortest Window, as white pebbles sliding past on Cloud Gray. */
export function LandingTape() {
  const { rows } = useLandingBoard();
  if (rows.length === 0) return <div className="lp-cloud h-[4.5rem]" aria-hidden />;
  const items = rows.map((r) => (
    <Link key={r.symbol} href={`/trade/${r.symbol}`} className="lp-pill mx-1.5 flex shrink-0 items-center gap-2.5 py-1.5 pr-4 pl-1.5 transition-transform hover:-translate-y-0.5">
      <AssetDisc asset={r.symbol} className="asset-disc-32" />
      <span className="text-ow-label font-extrabold">{r.symbol}</span>
      <span className="lp-num text-ow-label font-semibold lp-muted">{r.spot === null ? "—" : `$${formatPrice(r.spot)}`}</span>
      <span className="rounded-full lp-fill-cloud px-2 py-0.5 text-ow-micro font-extrabold">{cadence(r.cadenceSec)}</span>
    </Link>
  ));
  return (
    <section aria-label={WORDS.tape.label} className="lp-cloud py-4">
      <InfiniteSlider gapRem={0} duration={Math.max(30, rows.length * 4)} durationOnHover={Math.max(90, rows.length * 12)} className="mask-[linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]">
        {items}
      </InfiniteSlider>
    </section>
  );
}

/** One step as a coloured pillow: its number, a 3D object, a line, and a live widget on a white inner card. */
function Step({ n, title, body, art, fill, children, index }: { n: string; title: string; body: string; art: Parameters<typeof FluentArt>[0]["name"]; fill: string; children: React.ReactNode; index: number }) {
  return (
    <Rise index={index} className="h-full">
      <article className={cn("lp-lift relative flex h-full flex-col gap-5 overflow-hidden rounded-[2rem] p-7 sm:p-8", fill)}>
        <FluentArt name={art} size={96} className="lp-float absolute -top-3 -right-3" />
        <span className="lp-display text-[3.5rem] opacity-90">{n}</span>
        <div className="flex flex-col gap-2 pr-16">
          <h3 className="lp-display lp-h3">{title}</h3>
          <p className="lp-body opacity-85">{body}</p>
        </div>
        <div className="mt-auto rounded-[1.5rem] bg-ow-white p-3 text-ow-ink">{children}</div>
      </article>
    </Rise>
  );
}

/** "Tap. Watch. Bank it." on the cotton sky: three pillows, each reading the trade the hero phone is playing right now. */
export function LandingLoop() {
  const { loop } = WORDS;
  const { symbol, market, ladder, nowSec, ghost, banked } = useHeroEngine();
  const upTicks = ladder?.up[0]?.[0] ?? 0;
  const downTicks = ladder?.down[0]?.[0] ?? 0;
  const riding = ghost.phase === "ride";
  const [call, watch, bank] = loop.steps;
  return (
    <section className="lp-cotton relative overflow-hidden py-24">
      <Sparkles spots={[{ x: 8, y: 14, size: 28, delay: 0.3 }, { x: 90, y: 10, size: 22, delay: 1.4, tone: "pink" }, { x: 80, y: 88, size: 26, delay: 2 }]} />
      <div className="relative mx-auto w-full max-w-[75rem] px-4 sm:px-8">
        <SectionHead kicker={loop.kicker} lines={loop.title} className="mb-12" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Step index={0} n={call.n} title={call.title} body={call.body} art="bell" fill="lp-fill-tangerine">
            <span className="flex items-center gap-2 px-1 pb-2 text-ow-caption font-bold">
              <AssetDisc asset={symbol} className="asset-disc-32" /> {symbol} · {market ? `${cadence(market.intervalSec)} · closes in ${Math.max(0, market.expirySec - nowSec)}s` : "between Windows"}
            </span>
            <div inert className="[&_button]:h-14 [&_button]:text-ow-label">
              <TradeButtons mode="flat" onUp={() => undefined} onDown={() => undefined} busy={null} upSub={upTicks ? `pays ${multipleOf(upTicks)}` : undefined} downSub={downTicks ? `pays ${multipleOf(downTicks)}` : undefined} />
            </div>
          </Step>
          <Step index={1} n={watch.n} title={watch.title} body={watch.body} art="chartIncreasing" fill="lp-fill-ink">
            <div className="flex items-center justify-between gap-3 p-2" data-dir={(riding ? ghost.pnl : (banked?.pnl ?? 0)) >= 0 ? "up" : "down"}>
              <span className="flex flex-col">
                <span className="text-ow-micro font-bold lp-muted">{riding ? `${ghost.side === "up" ? "UP" : "DOWN"} ${symbol} · 10.00 staked` : "Unrealized PnL"}</span>
                {riding ? (
                  <Odometer kind="plain" signed tone zeroIsUp value={ghost.pnl} decimals={4} className="text-ow-figure font-black" />
                ) : (
                  <span className="lp-num text-ow-figure font-black lp-muted">+0.0000</span>
                )}
              </span>
              <span className={cn("size-3 rounded-full", riding ? "animate-pulse bg-(--ow-dir-line)" : "bg-ow-hairline")} aria-hidden />
            </div>
          </Step>
          <Step index={2} n={bank.n} title={bank.title} body={bank.body} art="moneyBag" fill="lp-fill-pink">
            <div className="flex flex-col gap-2 p-2">
              <span className="flex items-center justify-between text-ow-caption font-extrabold">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-4" /> {banked ? "Closed in one tap" : "Waiting for the first ride"}
                </span>
                <span className={cn("lp-num", banked && banked.pnl < 0 ? "lp-down" : "lp-up")}>{banked?.pnlText ?? "—"}</span>
              </span>
              <span className="flex items-center gap-1.5 text-ow-micro font-semibold lp-muted">
                <Lock className="size-3.5" /> Or hold: 3 oracle parties sign the close
              </span>
            </div>
          </Step>
        </div>
      </div>
    </section>
  );
}
