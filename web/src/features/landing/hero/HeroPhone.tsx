"use client";

import { TICKERS } from "@owarine/core/market";
import { CheckCircle2 } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { Odometer } from "@/components/kit";
import { AssetDisc } from "@/features/markets/hero/asset-mark";
import { formatPrice } from "@/features/terminal/chart/engine";
import { LiveChart } from "@/features/terminal/chart/LiveChart";
import { TradeButtons } from "@/features/terminal/ui/TradeButtons";
import { cn } from "@/lib/utils";
import "@/features/terminal/terminal.css";
import { WORDS } from "../words";
import { useHeroEngine } from "./engine";

const cadence = (sec: number) => (sec % 3600 === 0 ? `${sec / 3600}h` : `${Math.round(sec / 60)}m`);
const clock = (s: number) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;

/** A phone, drawn in CSS: a black body, a rounded screen and the island. Children fill the screen. */
export function PhoneFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("relative rounded-[3.25rem] bg-ow-black p-[0.6rem]", className)}>
      <div className="relative aspect-[9/19.2] overflow-hidden rounded-[2.7rem] bg-ow-canvas">
        <span aria-hidden className="absolute top-[0.6rem] left-1/2 z-40 h-[1.6rem] w-[5.6rem] -translate-x-1/2 rounded-full bg-ow-black" />
        {children}
      </div>
    </div>
  );
}

/**
 * The hero's phone: the trading screen in miniature, on the venue's live price, playing a paper trade by itself — look,
 * tap, ride it with the PnL on the line, bank it. A tap on the phone opens the real screen on the same market.
 */
export function HeroPhone({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  const { nowSec, symbol, market, spotSymbol, spot, overlay, ghost } = useHeroEngine();
  const name = TICKERS[symbol as keyof typeof TICKERS]?.name ?? symbol;
  const left = market ? market.expirySec - nowSec : 0;
  const up = ghost.side === "up";

  return (
    <div className={cn("group relative", className)}>
      <PhoneFrame className="transition-transform duration-300 ease-ow-spring group-hover:-translate-y-1 group-hover:-rotate-1">
        <div inert className="absolute inset-0 z-10">
          <LiveChart symbol={spotSymbol} overlay={overlay} label={`${name} live price`} />
        </div>
        <div inert className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col gap-2 px-3.5 pt-[2.8rem]">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 rounded-full bg-ow-card py-1 pr-3 pl-1">
              <AssetDisc asset={symbol} className="asset-disc-32" />
              <span className="flex flex-col leading-tight">
                <span className="ow-num text-ow-label font-bold">{spot === null ? "—" : `$${formatPrice(spot)}`}</span>
                <span className="text-ow-micro text-ow-muted">{symbol}</span>
              </span>
            </span>
            <span className="flex items-center gap-1.5 rounded-full bg-ow-card px-2.5 py-1.5 text-ow-micro font-bold">
              <span className="rounded-full bg-ow-recessed px-1.5 text-ow-muted">{WORDS.phone.demo}</span>
              10,000
            </span>
          </div>
          {market ? (
            <span className="self-start rounded-full bg-ow-card px-2.5 py-1 text-ow-micro font-semibold">
              <span className="mr-1.5 rounded-full bg-ow-ink px-1.5 py-0.5 text-ow-inverse">{cadence(market.intervalSec)}</span>
              closes {clock(left)}
            </span>
          ) : null}
          <AnimatePresence>
            {ghost.phase === "bank" ? (
              <motion.span
                key="bank"
                initial={reduce ? false : { opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="flex items-center gap-2 self-center rounded-2xl bg-ow-card px-3 py-2 text-ow-caption font-bold"
              >
                <CheckCircle2 className={cn("size-4", ghost.pnl >= 0 ? "text-ow-up" : "text-ow-down")} />
                {WORDS.phone.closed} <span className={ghost.pnl >= 0 ? "text-ow-up" : "text-ow-down"}>{ghost.pnlText}</span>
              </motion.span>
            ) : null}
          </AnimatePresence>
        </div>
        <div inert className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-col gap-2 px-3 pb-6">
          {ghost.phase === "ride" ? (
            <div className="flex items-center justify-center gap-2 text-ow-caption font-bold" data-dir={ghost.pnl >= 0 ? "up" : "down"}>
              <span className="text-ow-muted">{up ? "UP" : "DOWN"} · 10.00</span>
              <Odometer kind="plain" signed tone zeroIsUp value={ghost.pnl} decimals={4} />
            </div>
          ) : null}
          <div className="relative [&_button]:h-12 [&_button]:text-ow-label [&_.text-ow-micro]:hidden">
            {ghost.phase === "ride" ? (
              <TradeButtons mode="open" trailActive={false} trailEligible={false} trailPct={0.02} onTrail={() => undefined} onClose={() => undefined} busy={null} />
            ) : (
              <TradeButtons mode="flat" onUp={() => undefined} onDown={() => undefined} busy={null} disabled={ghost.phase === "idle"} />
            )}
            {ghost.phase === "look" && !reduce ? (
              <span aria-hidden className={cn("absolute top-1/2 size-9 -translate-y-1/2 rounded-full border-4 border-ow-pink ow-tap", up ? "left-[22%]" : "left-[72%]")} />
            ) : null}
          </div>
          {ghost.phase === "idle" ? <span className="text-center text-ow-micro text-ow-muted">{WORDS.phone.waiting}</span> : null}
        </div>
      </PhoneFrame>
      <Link href={`/trade/${symbol}`} aria-label={`${WORDS.phone.open}: ${name}`} className="absolute inset-0 z-50 rounded-[3.25rem] outline-offset-4" />
    </div>
  );
}
