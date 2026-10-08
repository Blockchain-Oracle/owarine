"use client";

import { ArrowRight, Check, X } from "lucide-react";
import Link from "next/link";
import { FluentArt, PrivacyMask, PrivacyToggle } from "@/components/kit";
import { cn } from "@/lib/utils";
import { Mascots, Rise, SectionHead, Sparkles } from "./candy";
import { WORDS } from "./words";

/**
 * "Nobody sees your bets" on the full-bleed Prism Wash: the case in one line, who can read what (the same answer
 * `/who-sees-what` proves contract by contract) as a candy matrix, and privacy mode itself — the real toggle, so a
 * visitor can swap a balance for a sticker.
 */
export function LandingPrivate() {
  const p = WORDS.private;
  return (
    <section className="lp-prism relative overflow-hidden py-24">
      <Mascots items={[{ name: "shushingFace", x: 8, y: 22, size: 96, rotate: -12 }, { name: "eyes", x: 93, y: 80, size: 84, rotate: 10 }]} className="max-md:hidden" />
      <Sparkles spots={[{ x: 18, y: 70, size: 24, delay: 0.6, tone: "pink" }, { x: 84, y: 18, size: 28, delay: 1.5 }]} />
      <div className="relative mx-auto w-full max-w-[75rem] px-4 sm:px-8">
        <SectionHead kicker={p.kicker} lines={p.title} />
        <p className="lp-lead lp-muted mx-auto mt-5 max-w-[40rem] text-center">{p.body}</p>

        <div className="mt-12 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <Rise index={0}>
            <div className="lp-card p-3 sm:p-4">
              <table className="w-full text-left">
                <thead>
                  <tr>
                    <th className="px-3 py-3" />
                    {p.who.map((w, i) => (
                      <th key={w} className="px-2 py-3 text-center">
                        <span className={cn("inline-block rounded-full px-3 py-1 text-ow-micro font-extrabold", i === 0 ? "lp-fill-tangerine" : i === 1 ? "lp-fill-ink" : "lp-fill-cloud")}>{w}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {p.rows.map((row) => (
                    <tr key={row.what} className="[&>*]:py-3">
                      <th scope="row" className="rounded-l-2xl px-3 text-ow-label font-extrabold">
                        {row.what}
                      </th>
                      {row.sees.map((yes, i) => (
                        <td key={p.who[i]} className="px-2 text-center">
                          <span className={cn("inline-grid size-9 place-items-center rounded-full", yes ? "lp-fill-sky" : "lp-fill-cloud lp-muted")} aria-label={yes ? "Sees it" : "Cannot see it"}>
                            {yes ? <Check className="size-4" strokeWidth={3.5} /> : <X className="size-4" strokeWidth={3.5} />}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] lp-fill-cloud px-4 py-3">
                <span className="text-ow-caption font-semibold lp-muted">{p.proved}</span>
                <Link href="/who-sees-what" className="inline-flex items-center gap-1.5 text-ow-label font-extrabold lp-text-pink hover:underline">
                  {p.matrix} <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>
          </Rise>

          <Rise index={1}>
            <div className="relative h-full overflow-hidden rounded-[2rem] lp-fill-ink p-7">
              <FluentArt name="locked" size={88} className="lp-float absolute -right-3 -bottom-3" />
              <div className="flex items-center justify-between gap-3">
                <span className="text-ow-caption font-bold opacity-70">Example seat</span>
                <PrivacyToggle />
              </div>
              <div className="mt-3 min-h-[3.5rem]">
                <PrivacyMask size="lg">
                  <span className="lp-num lp-display text-[3rem]">1,204.55</span>
                </PrivacyMask>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-[1.25rem] bg-ow-white/10 p-3">
                  <span className="text-ow-micro font-bold opacity-70">Open calls</span>
                  <PrivacyMask size="sm">
                    <span className="lp-num block text-ow-title font-black">3</span>
                  </PrivacyMask>
                </div>
                <div className="rounded-[1.25rem] bg-ow-white/10 p-3">
                  <span className="text-ow-micro font-bold opacity-70">Today</span>
                  <PrivacyMask size="sm">
                    <span className="lp-num block text-ow-title font-black text-ow-up-line">+48.20</span>
                  </PrivacyMask>
                </div>
              </div>
              <div className="mt-6 flex flex-col gap-1">
                <span className="text-ow-lead font-extrabold">{p.mask.title}</span>
                <span className="lp-body opacity-75">{p.mask.body}</span>
              </div>
            </div>
          </Rise>
        </div>
      </div>
    </section>
  );
}
