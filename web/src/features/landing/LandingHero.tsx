"use client";

import { Play, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Seal } from "@/components/kit";
import { AssetDisc } from "@/features/markets/hero/asset-mark";
import { setMode } from "@/features/terminal/mode";
import { DOCS_URL } from "@/lib/docs-url";
import { Blobs, CandyCTA, Mascots, Sparkles, StaggerTitle, type Mascot, type SparkleSpot } from "./candy";
import { HeroPhone } from "./hero/HeroPhone";
import { WORDS } from "./words";

/** The hero's mascots, kept to the edges so the headline and the phone stay clear. */
const MASCOTS: readonly Mascot[] = [
  { name: "rocket", x: 5, y: 78, size: 120, rotate: -18 },
  { name: "crystalBall", x: 47, y: 14, size: 76, rotate: 8 },
  { name: "coin", x: 93, y: 12, size: 72, rotate: 14 },
  { name: "locked", x: 96, y: 66, size: 96, rotate: 10 },
  { name: "glowingStar", x: 3, y: 18, size: 58, rotate: -10 },
];
const SPARKS: readonly SparkleSpot[] = [
  { x: 12, y: 30, size: 30, delay: 0 },
  { x: 40, y: 22, size: 18, delay: 1.1, tone: "pink" },
  { x: 58, y: 70, size: 26, delay: 0.5 },
  { x: 88, y: 40, size: 20, delay: 1.7, tone: "white" },
  { x: 24, y: 88, size: 22, delay: 2.2, tone: "pink" },
];

export function LandingNav() {
  const { nav } = WORDS;
  return (
    <nav className="relative z-30 mx-auto flex w-full max-w-[75rem] items-center justify-between gap-4 px-4 py-5 sm:px-8">
      <Link href="/" className="flex items-center gap-2.5 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-current" aria-label="Owarine home">
        <span className="grid size-11 place-items-center rounded-2xl bg-ow-white">
          <Seal size={32} rotate={-8} />
        </span>
        <span className="lp-display text-ow-heading">Owarine</span>
      </Link>
      <div className="flex items-center gap-1 sm:gap-2">
        <Link href="/markets" className="hidden rounded-full px-3.5 py-2 text-ow-label font-bold hover:bg-ow-white/60 sm:inline-flex">
          {nav.markets}
        </Link>
        <Link href="/how-it-works" className="hidden rounded-full px-3.5 py-2 text-ow-label font-bold hover:bg-ow-white/60 md:inline-flex">
          {nav.how}
        </Link>
        <a href={DOCS_URL} className="hidden rounded-full px-3.5 py-2 text-ow-label font-bold hover:bg-ow-white/60 md:inline-flex">
          {nav.docs}
        </a>
        <CandyCTA tone="ghost" href="/trade">
          {nav.start}
        </CandyCTA>
      </div>
    </nav>
  );
}

/** Soft white cumulus at the sky's foot, so the next band reads as cloud level. */
function CloudBank() {
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-40 w-full" viewBox="0 0 1200 160" preserveAspectRatio="none">
      <path fill="white" d="M0 120c60-40 150-50 210-14 40-50 150-62 214-10 52-34 140-30 178 22 60-44 170-40 214 8 56-30 150-26 196 18 58-36 140-30 198 12V160H0Z" />
    </svg>
  );
}

/**
 * The first screen, the "Rainbow" way: a lavender sky with drifting colour and floating 3D objects, a rounded black
 * headline that arrives word by word, the tangerine and hot-pink pair, and a phone running a real trade on the
 * venue's live price (the hero engine, unchanged).
 */
export function LandingHero() {
  const { hero } = WORDS;
  const router = useRouter();
  const demo = () => {
    setMode("demo");
    router.push("/trade");
  };
  return (
    <section className="lp-sky relative isolate overflow-hidden">
      <Blobs />
      <Mascots items={MASCOTS} className="max-sm:hidden" />
      <Sparkles spots={SPARKS} />
      <CloudBank />
      <div className="relative z-10">
        <LandingNav />
        <div className="mx-auto grid w-full max-w-[75rem] items-center gap-14 px-4 pt-6 pb-36 sm:px-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-10 lg:pt-12">
          <div className="flex flex-col items-start gap-7">
            <span className="lp-pill flex items-center gap-2 py-2 pr-4 pl-3 text-ow-caption font-extrabold">
              <ShieldCheck className="size-4 lp-text-pink" strokeWidth={2.5} />
              {hero.kicker}
              {/* Canton's mark as its brand kit supplies it for a light ground: not recoloured, not combined (K-250). */}
              {/* eslint-disable-next-line @next/next/no-img-element -- a brand's supplied SVG, shown as supplied */}
              <img src="/brands/canton-on-light.svg" alt="Canton" className="h-4 w-auto" />
            </span>
            <StaggerTitle
              as="h1"
              now
              lines={hero.title}
              className="lp-display lp-hero"
              lineClassName={(i) => (i === 0 ? undefined : "lp-text-coral pb-1")}
            />
            <p className="lp-lead max-w-[30rem] lp-muted">{hero.line}</p>
            <div className="flex flex-wrap items-center gap-3">
              <CandyCTA tone="tangerine" href="/trade" tile={<Seal size={28} rotate={-6} />}>
                {hero.start}
              </CandyCTA>
              <CandyCTA tone="pink" onClick={demo} tile={<Play className="size-5 fill-current" />}>
                {hero.demo}
              </CandyCTA>
            </div>
            <ul className="flex items-center -space-x-2.5" aria-label="Some of the markets">
              {hero.assets.map((a) => (
                <li key={a} className="rounded-full ring-4 ring-ow-white">
                  <AssetDisc asset={a} className="asset-disc-36" />
                </li>
              ))}
              <li className="lp-pill ml-5! py-1.5 px-3 text-ow-micro font-extrabold">{hero.marketsCount}</li>
            </ul>
          </div>

          <div className="relative mx-auto w-[min(19rem,80vw)]">
            <HeroPhone />
            <div className="lp-toast absolute top-[14%] -left-[44%] z-[60] hidden items-center gap-3 px-3.5 py-3 sm:flex">
              <span className="grid size-8 place-items-center rounded-full lp-fill-pink">
                <ShieldCheck className="size-4" strokeWidth={2.75} />
              </span>
              <span className="flex flex-col leading-tight">
                <span className="text-ow-label font-extrabold">{hero.toasts.private.title}</span>
                <span className="text-ow-micro font-semibold lp-muted">{hero.toasts.private.body}</span>
              </span>
            </div>
            <div className="lp-toast absolute top-[70%] -right-[40%] z-[60] hidden items-center gap-3 px-3.5 py-3 sm:flex">
              <span className="grid size-8 place-items-center rounded-full lp-fill-tangerine text-ow-label font-black">3</span>
              <span className="flex flex-col leading-tight">
                <span className="text-ow-label font-extrabold">{hero.toasts.oracles.title}</span>
                <span className="text-ow-micro font-semibold lp-muted">{hero.toasts.oracles.body}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
