"use client";

import { ArrowRight, Check, X } from "lucide-react";
import Link from "next/link";
import { FluentArt, PrivacyMask, PrivacyToggle, Sticker } from "@/components/kit";
import { cn } from "@/lib/utils";
import { WORDS } from "./words";

/**
 * "Nobody sees your bets": the case in one paragraph, who can read what (the same answer `/who-sees-what` proves contract
 * by contract), and privacy mode itself — the real toggle, so a visitor can try the sticker on a balance.
 */
export function LandingPrivate() {
  const p = WORDS.private;
  return (
    <section className="relative overflow-hidden bg-ow-black text-ow-white">
      <div className="mx-auto grid w-full max-w-[80rem] gap-12 px-4 py-24 sm:px-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center">
        <div className="flex flex-col gap-6">
          <span className="text-ow-caption font-bold tracking-[0.14em] text-ow-lime uppercase">{p.kicker}</span>
          <h2 className="ow-display ow-display-lg">{p.title}</h2>
          <p className="max-w-[36rem] text-ow-lead text-ow-white/75">{p.body}</p>
          <div className="overflow-hidden rounded-3xl bg-ow-white/[0.06]">
            <table className="w-full text-left text-ow-label">
              <thead>
                <tr className="text-ow-micro tracking-[0.1em] text-ow-white/60 uppercase">
                  <th className="px-4 py-3 font-semibold" />
                  {p.who.map((w) => (
                    <th key={w} className="px-3 py-3 text-center font-semibold">
                      {w}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {p.rows.map((row) => (
                  <tr key={row.what} className="border-t border-ow-white/10">
                    <th scope="row" className="px-4 py-3 font-semibold">
                      {row.what}
                    </th>
                    {row.sees.map((yes, i) => (
                      <td key={p.who[i]} className="px-3 py-3 text-center">
                        <span className={cn("inline-grid size-7 place-items-center rounded-full", yes ? "bg-ow-lime text-ow-black" : "bg-ow-white/10 text-ow-white/50")} aria-label={yes ? "Sees it" : "Cannot see it"}>
                          {yes ? <Check className="size-4" strokeWidth={3} /> : <X className="size-4" strokeWidth={3} />}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-ow-caption text-ow-white/60">{p.proved}</p>
          <Link href="/who-sees-what" className="inline-flex items-center gap-1.5 self-start text-ow-label font-bold text-ow-lime hover:underline">
            {p.matrix} <ArrowRight className="size-4" />
          </Link>
        </div>

        <div className="relative mx-auto w-full max-w-[26rem]">
          <FluentArt name="shushingFace" size={112} className="absolute -top-20 -left-16 z-10 -rotate-12" />
          <FluentArt name="locked" size={96} className="absolute -right-6 -bottom-10 z-10 rotate-12" />
          <div className="relative rounded-[2.875rem] bg-ow-card p-7 text-ow-ink">
            <div className="flex items-center justify-between">
              <span className="text-ow-caption font-semibold text-ow-muted">Example seat</span>
              <PrivacyToggle />
            </div>
            <div className="mt-2 min-h-[3.5rem]">
              <PrivacyMask size="lg">
                <span className="ow-num text-ow-mask font-bold">1,204.55</span>
              </PrivacyMask>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-ow-canvas p-3">
                <span className="text-ow-micro text-ow-muted">Open calls</span>
                <PrivacyMask size="sm">
                  <span className="ow-num block text-ow-title font-bold">3</span>
                </PrivacyMask>
              </div>
              <div className="rounded-2xl bg-ow-canvas p-3">
                <span className="text-ow-micro text-ow-muted">Today</span>
                <PrivacyMask size="sm">
                  <span className="ow-num block text-ow-title font-bold text-ow-up">+48.20</span>
                </PrivacyMask>
              </div>
            </div>
            <div className="mt-6 flex flex-col gap-1">
              <span className="text-ow-label font-bold">{p.mask.title}</span>
              <span className="text-ow-caption text-ow-muted">{p.mask.body}</span>
            </div>
          </div>
          <Sticker tone="lime" tilt={8} className="pointer-events-none absolute -top-4 right-6">
            {p.mask.tap}
          </Sticker>
        </div>
      </div>
    </section>
  );
}
