"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { FluentArt, type CollageObject } from "@/components/kit";
import { AssetDisc } from "@/features/markets/hero/asset-mark";
import { formatPrice } from "@/features/terminal/chart/engine";
import { setParlayOn } from "@/features/terminal/parlay/slip";
import { cn } from "@/lib/utils";
import { useLandingBoard, type BoardKind, type BoardRow } from "./useLandingBoard";
import { WORDS } from "./words";

type Art = CollageObject["name"];

function Card({ href, title, body, art, tone = "card", className, children, onClick }: { href: string; title: string; body: string; art: Art; tone?: "card" | "pink" | "sky" | "lime" | "cream"; className?: string; children?: React.ReactNode; onClick?: () => void }) {
  const tones = { card: "bg-ow-card text-ow-ink", pink: "bg-ow-pink text-ow-on-pink", sky: "bg-ow-sky text-ow-black", lime: "bg-ow-lime text-ow-black", cream: "bg-ow-cream text-ow-black" } as const;
  return (
    <Link href={href} onClick={onClick} className={cn("group relative flex min-h-[15rem] flex-col gap-3 overflow-hidden rounded-[2.875rem] p-7 transition-transform duration-200 hover:-translate-y-1", tones[tone], className)}>
      <FluentArt name={art} size={104} className="absolute -right-3 -bottom-3 rotate-[-10deg] transition-transform duration-300 group-hover:scale-110 group-hover:rotate-0" />
      <span className="flex items-start justify-between gap-3">
        <h3 className="ow-display text-ow-display">{title}</h3>
        <ArrowUpRight className="size-6 shrink-0 opacity-60 transition-opacity group-hover:opacity-100" />
      </span>
      <p className="max-w-[24rem] text-ow-body opacity-80">{body}</p>
      <div className="relative z-10 mt-auto pr-20">{children}</div>
    </Link>
  );
}

function Names({ rows }: { rows: readonly BoardRow[] }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {rows.slice(0, 3).map((r) => (
        <span key={r.symbol} className="flex items-center gap-1.5 rounded-full bg-ow-black/[0.07] py-1 pr-2.5 pl-1 text-ow-micro font-bold">
          <AssetDisc asset={r.symbol} className="asset-disc-32 scale-75" />
          {r.symbol}
          <span className="ow-num font-semibold opacity-70">{r.spot === null ? "" : `$${formatPrice(r.spot)}`}</span>
        </span>
      ))}
    </span>
  );
}

const open = (rows: readonly BoardRow[]) => rows.reduce((s, r) => s + r.open, 0);

/** "Crypto, stocks, pre-IPO. Same two buttons." — what trades, read live from the venue's lanes, and the ways to trade it. */
export function LandingMarkets() {
  const m = WORDS.markets;
  const { rows } = useLandingBoard();
  const of = (k: BoardKind) => rows.filter((r) => r.kind === k);
  const first = (k: BoardKind, fallback: string) => of(k)[0]?.symbol ?? fallback;
  const count = (k: BoardKind) => <span className="text-ow-caption font-bold">{m.open(open(of(k)))}</span>;
  return (
    <section className="mx-auto w-full max-w-[80rem] px-4 py-24 sm:px-8">
      <div className="mb-10 flex flex-col gap-3">
        <span className="text-ow-caption font-bold tracking-[0.14em] text-ow-pink-ink uppercase">{m.kicker}</span>
        <h2 className="ow-display ow-display-lg max-w-[56rem]">{m.title}</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card href={`/trade/${first("crypto", "BTC")}`} title={m.cards.crypto.title} body={m.cards.crypto.body} art="coin" tone="sky" className="lg:row-span-2 lg:min-h-[31rem]">
          <div className="flex flex-col gap-3">
            <Names rows={of("crypto")} />
            {count("crypto")}
          </div>
        </Card>
        <Card href="/markets" title={m.cards.stocks.title} body={m.cards.stocks.body} art="chartIncreasing">
          <div className="flex flex-col gap-3">
            <Names rows={of("stock")} />
            {count("stock")}
          </div>
        </Card>
        <Card href={`/trade/${first("preipo", "OPENAI")}`} title={m.cards.preipo.title} body={m.cards.preipo.body} art="rocket" tone="lime">
          <div className="flex flex-col gap-3">
            <Names rows={of("preipo")} />
            {count("preipo")}
          </div>
        </Card>
        <Card href="/trade" onClick={() => setParlayOn(true)} title={m.cards.parlay.title} body={m.cards.parlay.body} art="admissionTickets" tone="pink" />
        <Card href="/markets" title={m.cards.cover.title} body={m.cards.cover.body} art="shield" tone="cream" />
        <Card href="/portfolio" title={m.cards.cc.title} body={m.cards.cc.body} art="moneyBag" className="md:col-span-2 lg:col-span-3 lg:min-h-[12rem]" />
      </div>

      <div className="mt-16 flex flex-col gap-3">
        <span className="text-ow-caption font-bold tracking-[0.14em] text-ow-pink-ink uppercase">{WORDS.more.kicker}</span>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Card href={WORDS.more.cards.games.href} title={WORDS.more.cards.games.title} body={WORDS.more.cards.games.body} art="joystick" />
        <Card href={WORDS.more.cards.automate.href} title={WORDS.more.cards.automate.title} body={WORDS.more.cards.automate.body} art="ninja" />
        <Card href={WORDS.more.cards.earn.href} title={WORDS.more.cards.earn.title} body={WORDS.more.cards.earn.body} art="gemStone" />
      </div>
    </section>
  );
}
