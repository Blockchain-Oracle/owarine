"use client";

import { ArrowRight, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PillButton, Seal, Sticker } from "@/components/kit";
import { OPEN_SEARCH_EVENT } from "@/components/shell/app/CommandPalette";

const C = {
  void: "VOID",
  title: "404",
  line: "No print for this page, so it voided. Nothing was lost.",
  window: "Window",
  print: "Open print",
  missing: "missing",
  result: "Result",
  refunded: "void · refunded",
  markets: "Go to markets",
  home: "Home",
  search: "Search",
} as const;

/**
 * The 404 (Abu, 8 Oct): a page that is not there, told as a Window that voided for want of a print, the venue's own way
 * of saying "nothing happened, nothing lost". The path it was asked for sits on the ticket; Markets, Home and search
 * get you back.
 */
export function NotFoundScreen() {
  const path = usePathname() ?? "/";
  return (
    <div className="container flex min-h-[70vh] items-center justify-center py-12">
      <div className="flex w-full max-w-md flex-col items-center gap-7 text-center">
        <div className="relative">
          <h1 className="ow-display ow-display-xl text-ow-ink">{C.title}</h1>
          <Sticker tone="pink" tilt={-8} size="md" className="absolute -top-3 -right-6">
            {C.void}
          </Sticker>
        </div>
        <p className="ow-body text-ow-lead text-ow-muted">{C.line}</p>

        <div className="relative w-full rounded-ow-card bg-ow-card p-5 text-left ring-1 ring-ow-hairline">
          <Seal size={52} rotate={-12} className="absolute -top-6 -left-5" />
          <dl className="ow-axis flex flex-col gap-2.5 text-ow-label">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-ow-muted">{C.window}</dt>
              <dd className="min-w-0 truncate text-ow-ink">{path}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 border-t border-dashed border-ow-hairline pt-2.5">
              <dt className="text-ow-muted">{C.print}</dt>
              <dd className="text-ow-down">{C.missing}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 border-t border-dashed border-ow-hairline pt-2.5">
              <dt className="text-ow-muted">{C.result}</dt>
              <dd className="font-bold text-ow-ink">{C.refunded}</dd>
            </div>
          </dl>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <PillButton tone="black" render={<Link href="/markets" />}>
            {C.markets} <ArrowRight />
          </PillButton>
          <PillButton tone="ghost" render={<Link href="/" />}>
            {C.home}
          </PillButton>
          <PillButton tone="ghost" size="icon" aria-label={C.search} onClick={() => window.dispatchEvent(new Event(OPEN_SEARCH_EVENT))}>
            <Search />
          </PillButton>
        </div>
      </div>
    </div>
  );
}
