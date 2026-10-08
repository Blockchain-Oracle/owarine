"use client";

import { formatBaseUnits } from "@owarine/core/units";
import { ArrowRight, BadgeCheck, EyeOff, ReceiptText, Stamp, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { SponsorMark } from "@/components/brand/SponsorMark";
import { PillButton, Sticker } from "@/components/kit";
import { DemoFilm } from "@/features/install/DemoFilm";
import { SPONSORS } from "@/features/landing/sponsors";
import { useAudit } from "@/features/stats/useAudit";
import { useTraction } from "@/features/stats/useTraction";
import type { DemoFilm as Film } from "@/lib/release";
import { DOCS_URL } from "@/lib/docs-url";
import { DEMO } from "./copy";

const ICON: Record<string, LucideIcon> = { quote: ReceiptText, private: EyeOff, prints: Stamp, audit: BadgeCheck };

/**
 * `/demo`, rebuilt (Abu, 8 Oct: every earlier entry had one). The film first, from the one config point
 * (`OWARINE_DEMO_VIDEO_URL`, a runtime value: set it and restart pm-web); then the way into the live product; then the
 * four claims a judge can check, each one link from its evidence; then live numbers read from the same routes as
 * /stats, so nothing here is typed in by hand.
 */
export function DemoPage({ film }: { film: Film | null }) {
  return (
    <div className="container flex flex-col gap-10 py-8 lg:gap-14 lg:py-12">
      <section className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-3">
            <Sticker tone="lime" tilt={-4} size="sm" className="w-fit">
              {DEMO.sticker}
            </Sticker>
            <h1 className="ow-display ow-display-lg text-ow-ink">{DEMO.heading}</h1>
            <p className="ow-body max-w-xl text-ow-lead text-ow-muted">{DEMO.lede}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <PillButton tone="pink" render={<Link href="/markets" />}>
              {DEMO.actions.open} <ArrowRight />
            </PillButton>
            <PillButton tone="ghost" render={<a href={DOCS_URL} />}>
              {DEMO.actions.docs}
            </PillButton>
            <PillButton tone="ghost" render={<Link href="/pitch" />}>
              {DEMO.actions.pitch}
            </PillButton>
          </div>
        </div>
        <DemoFilm film={film} />
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="demo-claims">
        <h2 id="demo-claims" className="ow-display ow-display-sm text-ow-ink">
          {DEMO.claimsTitle}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {DEMO.claims.map((claim) => {
            const Glyph = ICON[claim.id] ?? BadgeCheck;
            return (
              <Link key={claim.id} href={claim.href} className="group flex flex-col gap-3 rounded-ow-card bg-ow-card p-5 ring-1 ring-ow-hairline transition-colors hover:ring-ow-pink">
                <span className="grid size-10 place-items-center rounded-full bg-ow-recessed">
                  <Glyph aria-hidden className="size-5" />
                </span>
                <span className="text-ow-lead font-bold text-ow-ink">{claim.title}</span>
                <span className="text-ow-body text-ow-muted">{claim.line}</span>
                <span className="mt-auto inline-flex items-center gap-1 text-ow-label font-bold text-ow-pink-ink">
                  {claim.cta} <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <LiveNumbers />

      <section className="flex flex-wrap items-center gap-x-8 gap-y-4" aria-label={DEMO.builtOn}>
        <span className="text-ow-label font-bold text-ow-muted">{DEMO.builtOn}</span>
        {SPONSORS.map((sponsor) => (
          <a key={sponsor.id} href={sponsor.href} rel="noopener" className="opacity-90 hover:opacity-100">
            <SponsorMark sponsor={sponsor} className={sponsor.id === "noders" ? "[--mark-height:34px]" : "[--mark-height:26px]"} />
          </a>
        ))}
      </section>
    </div>
  );
}

/** Three numbers from the routes /stats reads: Windows settled in 24 h, the latest recount, the venue's headroom. */
function LiveNumbers() {
  const traction = useTraction();
  const audit = useAudit();
  const t = traction?.ok ? traction.value : null;
  const a = audit?.ok ? audit.value : null;
  const L = DEMO.live;
  const recount = a?.recount ?? null;
  const reserve = a?.reserve.ok ? a.reserve.value : null;
  const decimals = t?.meta.decimals ?? 6;
  return (
    <section className="flex flex-col gap-4" aria-labelledby="demo-live">
      <h2 id="demo-live" className="ow-display ow-display-sm text-ow-ink">
        {DEMO.liveTitle}
      </h2>
      <dl className="grid gap-3 sm:grid-cols-3">
        <Number label={L.settled} value={t ? t.settledWindows.toLocaleString() : L.reading} sub={t ? L.settledSub(t.windows) : null} href="/stats" />
        <Number
          label={L.recount}
          value={a ? (recount ? (recount.ok ? L.recountOk : L.recountDiffers) : L.recountNone) : L.reading}
          sub={recount?.offset != null ? L.recountSub(recount.offset.toLocaleString()) : null}
          href="/stats"
        />
        <Number
          label={L.reserve}
          value={reserve ? `${formatBaseUnits(BigInt(reserve.headroomBase), decimals, { maxDp: 0, minDp: 0 })} ${t?.meta.symbol ?? "credits"}` : L.reading}
          sub={reserve ? L.reserveSub : null}
          href="/stats"
        />
      </dl>
    </section>
  );
}

function Number({ label, value, sub, href }: { label: string; value: string; sub: string | null; href: string }) {
  return (
    <Link href={href} className="flex flex-col gap-1 rounded-ow-card bg-ow-card p-5 ring-1 ring-ow-hairline hover:ring-ow-pink">
      <dt className="text-ow-label text-ow-muted">{label}</dt>
      <dd className="ow-num text-[28px] font-bold leading-tight text-ow-ink">{value}</dd>
      {sub ? <dd className="text-ow-caption text-ow-muted">{sub}</dd> : null}
    </Link>
  );
}
