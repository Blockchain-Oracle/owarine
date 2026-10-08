"use client";

import type { EventMarket } from "@owarine/core/types";
import { ArrowRight, Download, Play } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SponsorMark } from "@/components/brand/SponsorMark";
import { FluentArt, Seal } from "@/components/kit";
import { AssetDisc } from "@/features/markets/hero/asset-mark";
import { etWhen, laneAssetLabel, laneCadenceLabel } from "@/features/markets/lanes/lane-view";
import { useVenue } from "@/features/markets/useVenue";
import { setMode } from "@/features/terminal/mode";
import { ADVICE_COPY } from "@owarine/core/copy";
import { proofHref } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { Blobs, CandyCTA, Mascots, Rise, SectionHead, Sparkles, StaggerTitle } from "./candy";
import { LANDING } from "./copy";
import { CANTON_ATTRIBUTION, SPONSORS } from "./sponsors";
import { useBuiltOn } from "./useBuiltOn";
import { useSettledWindows } from "./useSettledWindows";
import { WORDS } from "./words";

const COUNT = new Intl.NumberFormat("en-US");

function outcomeOf(m: EventMarket): "up" | "down" | "void" | null {
  if (m.voided) return "void";
  if (m.winningOutcome === null) return null;
  return m.winningOutcome === 1 ? "down" : "up";
}

/** "Every close is signed": the sources the venue's Windows settled on (the index's print mix) and the last Windows to settle. */
export function LandingProof() {
  const p = WORDS.proof;
  const { venueId } = useVenue();
  const built = useBuiltOn();
  const settled = useSettledWindows(venueId as never);
  const tally = built?.ok ? built.value.tally : [];
  const rows = settled?.ok ? settled.value : [];
  return (
    <section className="lp-cloud py-24">
      <div className="mx-auto w-full max-w-[75rem] px-4 sm:px-8">
        <SectionHead kicker={p.kicker} lines={p.title} />
        <p className="lp-lead lp-muted mx-auto mt-5 max-w-[38rem] text-center">{p.body}</p>
        <div className="mt-12 grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <Rise index={0}>
            <div className="flex h-full flex-col gap-3 rounded-[2rem] lp-fill-tangerine p-6">
              <span className="text-ow-caption font-extrabold opacity-90">{p.sources}</span>
              {tally.length === 0 ? <span className="lp-body opacity-90">{built === null ? p.reading : p.none}</span> : null}
              <ul className="grid gap-3 sm:grid-cols-2">
                {tally.map((t) => (
                  <li key={t.source} className="rounded-[1.5rem] bg-ow-white p-4 text-ow-ink">
                    <span className="lp-num lp-display block text-[2.25rem]">{COUNT.format(t.windows)}</span>
                    <span className="block text-ow-micro font-semibold lp-muted">{p.windows}</span>
                    <span className="mt-1 block text-ow-label font-extrabold">{LANDING.builtOn.sources[t.source].name}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Rise>
          <Rise index={1}>
            <div className="lp-card flex h-full flex-col gap-2 p-4">
              <span className="px-2 pt-1 text-ow-caption font-extrabold lp-muted">{p.settled}</span>
              {rows.length === 0 ? <p className="px-2 lp-body lp-muted">{settled === null ? p.reading : p.none}</p> : null}
              {rows.map((m) => {
                const label = laneAssetLabel(m.asset, m.lane);
                const o = outcomeOf(m);
                return (
                  <Link key={m.marketId} href={proofHref(m.marketId)} className="flex items-center gap-3 rounded-[1.25rem] px-3 py-2.5 transition-colors hover:bg-(--lp-cloud)">
                    <AssetDisc asset={label} className="asset-disc-36" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-ow-label font-extrabold">
                        {label} {laneCadenceLabel(m.lane, m.intervalSec)}
                      </span>
                      <span className="block text-ow-micro font-semibold lp-muted">closed {etWhen(m.expirySec)} ET · {o === "void" ? "stakes returned" : "signed close"}</span>
                    </span>
                    <span className={cn("rounded-full px-3 py-1 text-ow-micro font-extrabold", o === "up" ? "lp-fill-sky" : o === "down" ? "lp-fill-pink" : "lp-fill-cloud")}>{o ? p.outcome[o] : "—"}</span>
                    <span className="hidden text-ow-micro font-extrabold underline sm:inline">{p.proof}</span>
                  </Link>
                );
              })}
            </div>
          </Rise>
        </div>
      </div>
    </section>
  );
}

const ROAD_FILL = ["lp-fill-ink", "lp-fill-cloud", "lp-fill-cloud"] as const;
const ROAD_ART = ["glowingStar", "mobilePhone", "rocket"] as const;

export function LandingRoadmap() {
  const r = WORDS.roadmap;
  return (
    <section className="bg-ow-white py-24">
      <div className="mx-auto w-full max-w-[75rem] px-4 sm:px-8">
        <div className="mb-8 flex justify-center">
          <span className="lp-kicker lp-pill px-4 py-1.5">{r.kicker}</span>
        </div>
        <ol className="grid gap-4 md:grid-cols-3">
          {r.phases.map((ph, i) => (
            <li key={ph.title}>
              <Rise index={i} className="h-full">
                <div className={cn("lp-lift relative flex h-full flex-col gap-3 overflow-hidden rounded-[2rem] p-7", ROAD_FILL[i])}>
                  <FluentArt name={ROAD_ART[i]!} size={72} className="lp-float absolute -top-1 -right-1" />
                  <span className={cn("self-start rounded-full px-3 py-1 text-ow-micro font-extrabold", i === 0 ? "lp-fill-tangerine" : "bg-ow-white")}>{ph.tag}</span>
                  <h3 className="lp-display lp-h3 pr-14">{ph.title}</h3>
                  <p className="lp-body opacity-80">{ph.body}</p>
                </div>
              </Rise>
            </li>
          ))}
        </ol>
        <div className="mt-8 flex justify-center">
          <Link href="/pitch" className="inline-flex items-center gap-1.5 text-ow-label font-extrabold lp-text-pink hover:underline">
            {r.pitch} <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/** The last screen: the cotton sky again, the line again, the pair again. Then the footer, with who it is built on. */
export function LandingFinal() {
  const f = WORDS.final;
  const router = useRouter();
  return (
    <>
      <section className="lp-cotton relative isolate overflow-hidden py-32">
        <Blobs />
        <Mascots
          items={[
            { name: "trophy", x: 10, y: 30, size: 110, rotate: -12 },
            { name: "moneyWithWings", x: 89, y: 26, size: 104, rotate: 10 },
            { name: "key", x: 84, y: 80, size: 88, rotate: -20 },
            { name: "crystalBall", x: 14, y: 80, size: 80, rotate: 8 },
          ]}
          className="max-sm:hidden"
        />
        <Sparkles spots={[{ x: 26, y: 18, size: 30, delay: 0 }, { x: 72, y: 14, size: 22, delay: 1, tone: "pink" }, { x: 64, y: 84, size: 26, delay: 1.8 }, { x: 34, y: 86, size: 18, delay: 2.4, tone: "white" }]} />
        <div className="relative mx-auto flex max-w-[60rem] flex-col items-center gap-8 px-4 text-center">
          <span className="grid size-24 place-items-center rounded-[1.75rem] bg-ow-white">
            <Seal size={72} stamp />
          </span>
          <StaggerTitle lines={f.title} className="lp-display text-[clamp(4rem,12vw,8.5rem)]" lineClassName={(i) => (i === 1 ? "lp-text-coral pb-2" : undefined)} />
          <div className="flex flex-wrap justify-center gap-3">
            <CandyCTA tone="tangerine" href="/trade" tile={<Seal size={28} rotate={-6} />}>
              {f.start}
            </CandyCTA>
            <CandyCTA tone="pink" onClick={() => (setMode("demo"), router.push("/trade"))} tile={<Play className="size-5 fill-current" />}>
              {WORDS.hero.demo}
            </CandyCTA>
          </div>
          <Link href="/download" className="inline-flex items-center gap-2 text-ow-label font-bold lp-muted hover:underline">
            <Download className="size-4" /> {f.install}
          </Link>
        </div>
      </section>
      <LandingFoot />
    </>
  );
}

function LandingFoot() {
  const f = WORDS.foot;
  return (
    <footer className="bg-ow-white">
      <div className="mx-auto grid w-full max-w-[75rem] gap-10 px-4 py-14 sm:px-8 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex flex-col gap-4">
          <span className="flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-2xl lp-fill-cloud">
              <Seal size={36} />
            </span>
            <span className="lp-display text-ow-heading">Owarine</span>
          </span>
          <p className="lp-body lp-muted">{f.line}</p>
          <nav className="flex flex-wrap gap-2">
            {f.pages.map((pg) => (
              <Link key={pg.href} href={pg.href} className="rounded-full lp-fill-cloud px-3.5 py-1.5 text-ow-label font-bold hover:bg-(--lp-sky-tint)">
                {pg.label}
              </Link>
            ))}
          </nav>
          <p className="max-w-[40rem] text-ow-micro lp-muted">{ADVICE_COPY.notAdvice}</p>
          <p className="max-w-[40rem] text-ow-micro lp-muted">{CANTON_ATTRIBUTION}</p>
        </div>
        <div className="flex flex-col gap-3">
          <span className="lp-kicker lp-muted">{f.built}</span>
          <ul className="flex flex-col gap-3">
            {SPONSORS.map((s) => (
              <li key={s.id}>
                <a href={s.href} target="_blank" rel="noreferrer" className="lp-card-cloud flex items-center gap-3 p-3">
                  <SponsorMark sponsor={s} className="h-7" />
                  <span className="text-ow-micro font-bold">{s.role}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
