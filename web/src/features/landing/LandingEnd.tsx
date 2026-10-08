"use client";

import type { EventMarket } from "@owarine/core/types";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { SponsorMark } from "@/components/brand/SponsorMark";
import { PillButton, Seal, SkyCollage, type CollageObject } from "@/components/kit";
import { AssetDisc } from "@/features/markets/hero/asset-mark";
import { etWhen, laneAssetLabel, laneCadenceLabel } from "@/features/markets/lanes/lane-view";
import { useVenue } from "@/features/markets/useVenue";
import { ADVICE_COPY } from "@owarine/core/copy";
import { proofHref } from "@/lib/routes";
import { cn } from "@/lib/utils";
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
    <section className="mx-auto w-full max-w-[80rem] px-4 py-24 sm:px-8">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="flex flex-col gap-5">
          <span className="text-ow-caption font-bold tracking-[0.14em] text-ow-pink-ink uppercase">{p.kicker}</span>
          <h2 className="ow-display ow-display-lg">{p.title}</h2>
          <p className="max-w-[34rem] text-ow-lead text-ow-muted">{p.body}</p>
          <span className="mt-4 text-ow-micro font-bold tracking-[0.12em] text-ow-muted uppercase">{p.sources}</span>
          <ul className="grid grid-cols-2 gap-3">
            {tally.length === 0 ? <li className="col-span-2 text-ow-caption text-ow-muted">{built === null ? p.reading : p.none}</li> : null}
            {tally.map((t) => (
              <li key={t.source} className="rounded-3xl bg-ow-card p-4">
                <span className="ow-num block text-ow-figure font-bold">{COUNT.format(t.windows)}</span>
                <span className="block text-ow-micro text-ow-muted">{p.windows}</span>
                <span className="mt-1 block text-ow-label font-bold">{LANDING.builtOn.sources[t.source].name}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-3">
          <span className="text-ow-micro font-bold tracking-[0.12em] text-ow-muted uppercase">{p.settled}</span>
          {rows.length === 0 ? <p className="text-ow-caption text-ow-muted">{settled === null ? p.reading : p.none}</p> : null}
          {rows.map((m, i) => {
            const label = laneAssetLabel(m.asset, m.lane);
            const o = outcomeOf(m);
            return (
              <Link
                key={m.marketId}
                href={proofHref(m.marketId)}
                className="flex items-center gap-3 rounded-3xl bg-ow-cream px-4 py-3.5 text-ow-black transition-transform hover:-translate-y-0.5"
                style={{ rotate: `${i % 2 === 0 ? -0.6 : 0.6}deg` }}
              >
                <AssetDisc asset={label} className="asset-disc-36" />
                <span className="min-w-0 flex-1">
                  <span className="block text-ow-label font-bold">
                    {label} {laneCadenceLabel(m.lane, m.intervalSec)}
                  </span>
                  <span className="block text-ow-micro opacity-70">closed {etWhen(m.expirySec)} ET · {o === "void" ? "stakes returned" : "signed close"}</span>
                </span>
                <span className={cn("rounded-full px-2.5 py-1 text-ow-micro font-bold", o === "up" ? "bg-ow-up-line text-ow-black" : o === "down" ? "bg-ow-down-line text-ow-white" : "bg-ow-black/10")}>
                  {o ? p.outcome[o] : "—"}
                </span>
                <span className="hidden text-ow-micro font-bold underline sm:inline">{p.proof}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function LandingRoadmap() {
  const r = WORDS.roadmap;
  return (
    <section className="mx-auto w-full max-w-[80rem] px-4 pb-24 sm:px-8">
      <span className="text-ow-caption font-bold tracking-[0.14em] text-ow-pink-ink uppercase">{r.kicker}</span>
      <ol className="mt-6 grid gap-4 md:grid-cols-3">
        {r.phases.map((ph, i) => (
          <li key={ph.title} className={cn("flex flex-col gap-3 rounded-[2.875rem] p-7", i === 0 ? "bg-ow-ink text-ow-inverse" : "bg-ow-card")}>
            <span className={cn("self-start rounded-full px-2.5 py-1 text-ow-micro font-bold", i === 0 ? "bg-ow-lime text-ow-black" : "bg-ow-recessed")}>{ph.tag}</span>
            <h3 className="ow-display text-ow-display">{ph.title}</h3>
            <p className={cn("text-ow-body", i === 0 ? "text-ow-inverse/75" : "text-ow-muted")}>{ph.body}</p>
          </li>
        ))}
      </ol>
      <Link href="/pitch" className="mt-6 inline-flex items-center gap-1.5 text-ow-label font-bold text-ow-pink-ink hover:underline">
        {r.pitch} <ArrowRight className="size-4" />
      </Link>
    </section>
  );
}

const FINAL_SKY: readonly CollageObject[] = [
  { name: "trophy", x: 10, y: 30, size: 110, rotate: -12, float: 0 },
  { name: "moneyWithWings", x: 88, y: 26, size: 110, rotate: 10, float: 1 },
  { name: "key", x: 82, y: 78, size: 90, rotate: -20, float: 2 },
  { name: "sparkles", x: 18, y: 80, size: 70, rotate: 8, float: 3 },
];

/** The last screen: the sky again, the line again, one button. Then the footer, with who it is built on. */
export function LandingFinal() {
  const f = WORDS.final;
  return (
    <>
      <SkyCollage objects={FINAL_SKY} className="py-28 max-sm:[&>div[aria-hidden]]:hidden">
        <div className="mx-auto flex max-w-[60rem] flex-col items-center gap-8 px-4 text-center">
          <Seal size={88} stamp />
          <h2 className="ow-display text-[clamp(4rem,12vw,10rem)]">
            {f.title.map((l) => (
              <span key={l} className="block">
                {l}
              </span>
            ))}
          </h2>
          <PillButton tone="pink" size="lg" render={<Link href="/trade" />}>
            {f.start} <ArrowRight />
          </PillButton>
          <Link href="/download" className="text-ow-label font-semibold text-ow-black/75 hover:underline">
            {f.install}
          </Link>
        </div>
      </SkyCollage>
      <LandingFoot />
    </>
  );
}

function LandingFoot() {
  const f = WORDS.foot;
  return (
    <footer className="bg-ow-black text-ow-white">
      <div className="mx-auto grid w-full max-w-[80rem] gap-10 px-4 py-14 sm:px-8 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex flex-col gap-4">
          <span className="flex items-center gap-3">
            <Seal size={44} />
            <span className="ow-display text-ow-display">Owarine</span>
          </span>
          <p className="text-ow-caption text-ow-white/60">{f.line}</p>
          <nav className="flex flex-wrap gap-x-5 gap-y-2">
            {f.pages.map((pg) => (
              <Link key={pg.href} href={pg.href} className="text-ow-label font-semibold text-ow-white/80 hover:text-ow-white">
                {pg.label}
              </Link>
            ))}
          </nav>
          <p className="max-w-[40rem] text-ow-micro text-ow-white/50">{ADVICE_COPY.notAdvice}</p>
          <p className="max-w-[40rem] text-ow-micro text-ow-white/40">{CANTON_ATTRIBUTION}</p>
        </div>
        <div className="flex flex-col gap-3">
          <span className="text-ow-micro font-bold tracking-[0.12em] text-ow-white/50 uppercase">{f.built}</span>
          <ul className="flex flex-col gap-3">
            {SPONSORS.map((s) => (
              <li key={s.id}>
                <a href={s.href} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-2xl bg-ow-white p-3 text-ow-black">
                  <SponsorMark sponsor={s} className="h-7" />
                  <span className="text-ow-micro font-semibold">{s.role}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
