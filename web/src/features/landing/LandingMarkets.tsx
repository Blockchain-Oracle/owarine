"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { FluentArt, type CollageObject } from "@/components/kit";
import { AssetDisc } from "@/features/markets/hero/asset-mark";
import { formatPrice } from "@/features/terminal/chart/engine";
import { setParlayOn } from "@/features/terminal/parlay/slip";
import { cn } from "@/lib/utils";
import { Rise, SectionHead } from "./candy";
import { useLandingBoard, type BoardKind, type BoardRow } from "./useLandingBoard";
import { WORDS } from "./words";

type Art = CollageObject["name"];

/** A mini screen inside a card: up to three real logos fanned out, each with its live price. */
function Screen({ rows, fallback, art }: { rows: readonly BoardRow[]; fallback: readonly string[]; art?: Art }) {
  const shown = rows.length > 0 ? rows.slice(0, 3).map((r) => ({ symbol: r.symbol, spot: r.spot })) : fallback.map((symbol) => ({ symbol, spot: null as number | null }));
  return (
    <div className="flex flex-col gap-2 rounded-[1.5rem] bg-ow-white p-3 text-ow-ink">
      <div className="lp-fan flex items-center justify-center -space-x-3 py-3">
        {art ? (
          <FluentArt name={art} size={72} />
        ) : (
          shown.map((s) => (
            <span key={s.symbol} className="rounded-full ring-4 ring-ow-white">
              <AssetDisc asset={s.symbol} className="asset-disc-48" />
            </span>
          ))
        )}
      </div>
      {art ? null : (
        <ul className="flex flex-col gap-1">
          {shown.map((s) => (
            <li key={s.symbol} className="flex items-center justify-between rounded-xl lp-fill-cloud px-2.5 py-1.5 text-ow-micro font-extrabold">
              <span>{s.symbol}</span>
              <span className="lp-num font-semibold lp-muted">{s.spot === null ? "live" : `$${formatPrice(s.spot)}`}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MarketCard({ href, onClick, title, body, fill, foot, children, index }: { href: string; onClick?: () => void; title: string; body: string; fill: string; foot?: React.ReactNode; children: React.ReactNode; index: number }) {
  return (
    <Rise index={index} className="h-full">
      <Link href={href} onClick={onClick} className={cn("lp-lift group flex h-full min-h-[25rem] flex-col gap-4 rounded-[2rem] p-5", fill)}>
        {children}
        <span className="mt-auto flex items-start justify-between gap-2 px-1">
          <span className="flex flex-col gap-1">
            <h3 className="lp-display text-[1.75rem] leading-none">{title}</h3>
            <span className="lp-body opacity-85">{body}</span>
          </span>
          <ArrowUpRight className="size-6 shrink-0 opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
        </span>
        {foot ? <span className="px-1 text-ow-caption font-extrabold opacity-90">{foot}</span> : null}
      </Link>
    </Rise>
  );
}

const open = (rows: readonly BoardRow[]) => rows.reduce((s, r) => s + r.open, 0);

/**
 * "Crypto, stocks, pre-IPO. Same two buttons." — Rainbow's row of solid-colour feature cards, each a market family with
 * its real logos and live prices on a white mini screen. On a phone the row scrolls sideways, card by card.
 */
export function LandingMarkets() {
  const m = WORDS.markets;
  const { rows } = useLandingBoard();
  const of = (k: BoardKind) => rows.filter((r) => r.kind === k);
  const first = (k: BoardKind, fallback: string) => of(k)[0]?.symbol ?? fallback;
  const count = (k: BoardKind) => (of(k).length ? m.open(open(of(k))) : undefined);
  const crypto = of("crypto").filter((r) => r.symbol !== "CC");
  const cc = of("crypto").filter((r) => r.symbol === "CC");
  return (
    <section className="relative bg-ow-white py-24">
      <div className="mx-auto w-full max-w-[75rem] px-4 sm:px-8">
        <SectionHead kicker={m.kicker} lines={m.title} className="mb-12" />
        <div className="lp-rail pb-2 lg:grid-flow-row lg:grid-cols-5 lg:overflow-visible">
          <MarketCard index={0} href={`/trade/${crypto[0]?.symbol ?? "BTC"}`} title={m.cards.crypto.title} body={m.cards.crypto.body} fill="lp-fill-cloud" foot={count("crypto")}>
            <Screen rows={crypto} fallback={["BTC", "ETH"]} />
          </MarketCard>
          <MarketCard index={1} href="/markets" title={m.cards.stocks.title} body={m.cards.stocks.body} fill="lp-fill-stone" foot={count("stock")}>
            <Screen rows={of("stock")} fallback={["NVDA", "TSLA", "AAPL"]} />
          </MarketCard>
          <MarketCard index={2} href={`/trade/${first("preipo", "OPENAI")}`} title={m.cards.preipo.title} body={m.cards.preipo.body} fill="lp-fill-tangerine" foot={count("preipo")}>
            <Screen rows={of("preipo")} fallback={["OPENAI", "SPACEX", "ANTHROPIC"]} />
          </MarketCard>
          <MarketCard index={3} href="/trade" onClick={() => setParlayOn(true)} title={m.cards.parlay.title} body={m.cards.parlay.body} fill="lp-fill-ink">
            <Screen rows={[]} fallback={[]} art="admissionTickets" />
          </MarketCard>
          <MarketCard index={4} href="/trade/CC" title={m.cards.cc.title} body={m.cards.cc.body} fill="lp-fill-pink">
            <Screen rows={cc} fallback={["CC"]} />
          </MarketCard>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <span className="lp-kicker lp-muted">{WORDS.more.kicker}</span>
          {[
            { ...WORDS.more.cards.games, art: "joystick" as Art },
            { ...WORDS.more.cards.automate, art: "ninja" as Art },
            { ...WORDS.more.cards.earn, art: "gemStone" as Art },
            { title: m.cards.cover.title, body: m.cards.cover.body, href: "/markets", art: "shield" as Art },
          ].map((c) => (
            <Link key={c.title} href={c.href} title={c.body} className="lp-pill lp-lift flex items-center gap-2 py-1.5 pr-4 pl-1.5 text-ow-label font-extrabold">
              <span className="grid size-9 place-items-center rounded-full lp-fill-cloud">
                <FluentArt name={c.art} size={26} />
              </span>
              {c.title}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
