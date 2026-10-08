"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PillButton, Seal, SkyCollage, Sticker, type CollageObject } from "@/components/kit";
import { AssetDisc } from "@/features/markets/hero/asset-mark";
import { setMode } from "@/features/terminal/mode";
import { DOCS_URL } from "@/lib/docs-url";
import { HeroPhone } from "./hero/HeroPhone";
import { WORDS } from "./words";

/** The objects in the hero's sky, kept to the edges so the headline and the phone stay clear. */
const SKY: readonly CollageObject[] = [
  { name: "oldKey", x: 6, y: 86, size: 132, rotate: -24, float: 0 },
  { name: "coin", x: 46, y: 12, size: 64, rotate: 12, float: 1 },
  { name: "locked", x: 94, y: 16, size: 104, rotate: 10, float: 2 },
  { name: "moneyWithWings", x: 50, y: 88, size: 96, rotate: -8, float: 3 },
  { name: "bell", x: 95, y: 70, size: 84, rotate: 14, float: 4 },
  { name: "hourglassNotDone", x: 4, y: 20, size: 60, rotate: -14, float: 5 },
];

export function LandingNav() {
  const { nav } = WORDS;
  return (
    <nav className="relative z-30 mx-auto flex w-full max-w-[80rem] items-center justify-between gap-4 px-4 py-4 sm:px-8">
      <Link href="/" className="flex items-center gap-2.5" aria-label="Owarine home">
        <Seal size={40} rotate={-8} />
        <span className="ow-display text-ow-heading">Owarine</span>
      </Link>
      <div className="flex items-center gap-1 sm:gap-2">
        <Link href="/markets" className="hidden rounded-full px-3 py-2 text-ow-label font-semibold hover:bg-ow-white/40 sm:inline-flex">
          {nav.markets}
        </Link>
        <Link href="/how-it-works" className="hidden rounded-full px-3 py-2 text-ow-label font-semibold hover:bg-ow-white/40 md:inline-flex">
          {nav.how}
        </Link>
        <a href={DOCS_URL} className="hidden rounded-full px-3 py-2 text-ow-label font-semibold hover:bg-ow-white/40 md:inline-flex">
          {nav.docs}
        </a>
        <PillButton tone="black" size="sm" render={<Link href="/trade" />}>
          {nav.start}
        </PillButton>
      </div>
    </nav>
  );
}

/**
 * The first screen (plan step 3): UGLYCASH's sky with its objects, one huge condensed headline, one pink button, and a
 * phone running the real trading screen on the venue's live price (Tradash's landing, on Owarine's engine).
 */
export function LandingHero() {
  const { hero } = WORDS;
  const router = useRouter();
  const demo = () => {
    setMode("demo");
    router.push("/trade");
  };
  return (
    <SkyCollage objects={SKY} className="min-h-dvh max-sm:[&>div[aria-hidden]]:hidden">
      <LandingNav />
      <div className="mx-auto grid w-full max-w-[80rem] items-center gap-12 px-4 pt-6 pb-24 sm:px-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-8 lg:pt-10">
        <div className="flex flex-col items-start gap-6">
          <span className="flex items-center gap-2 rounded-full bg-ow-white py-1.5 pr-3.5 pl-3 text-ow-caption font-bold">
            {hero.kicker}
            {/* Canton's mark as its brand kit supplies it for a light ground: not recoloured, not combined (K-250). */}
            {/* eslint-disable-next-line @next/next/no-img-element -- a brand's supplied SVG, shown as supplied */}
            <img src="/brands/canton-on-light.svg" alt="Canton" className="h-4 w-auto" />
          </span>
          <h1 className="ow-display text-[clamp(3.5rem,8.4vw,8.5rem)]">
            {hero.title.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </h1>
          <div className="flex flex-col gap-3">
            <ul className="flex -space-x-2" aria-label="Some of the markets">
              {hero.assets.map((a) => (
                <li key={a} className="rounded-full ring-3 ring-ow-white">
                  <AssetDisc asset={a} className="asset-disc-36" />
                </li>
              ))}
            </ul>
            <p className="text-ow-cta font-bold">{hero.line}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <PillButton tone="pink" size="lg" render={<Link href="/trade" />}>
              {hero.start} <ArrowRight />
            </PillButton>
            <PillButton tone="white" size="lg" onClick={demo}>
              {hero.demo}
            </PillButton>
          </div>
        </div>
        <div className="relative mx-auto w-[min(20rem,82vw)]">
          <HeroPhone />
          <Sticker tone="lime" tilt={-10} className="pointer-events-none absolute top-[10%] -left-[30%] z-[60] hidden sm:inline-flex">
            {hero.stickers.private}
          </Sticker>
          <Sticker tone="pink" tilt={7} className="pointer-events-none absolute top-[72%] -right-[34%] z-[60] hidden sm:inline-flex">
            {hero.stickers.oracles}
          </Sticker>
        </div>
      </div>
    </SkyCollage>
  );
}
