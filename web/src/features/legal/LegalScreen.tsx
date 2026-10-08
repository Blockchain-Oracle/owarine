"use client";

import { Accordion } from "@base-ui/react/accordion";
import { AtSign, ChevronDown, Coins, Globe2, Newspaper, Scale, ShieldCheck, Sparkles, type LucideIcon } from "lucide-react";
import { Sticker } from "@/components/kit";
import { LEGAL } from "./copy";

const ICON: Record<string, LucideIcon> = { "test-funds": Coins, advice: Scale, data: ShieldCheck, regions: Globe2, sources: Newspaper, credits: Sparkles };
const CHEVRON = "size-4.5 shrink-0 text-ow-muted transition-transform duration-200 group-data-panel-open:rotate-180 motion-reduce:transition-none";
const PANEL = "h-(--accordion-panel-height) overflow-hidden transition-[height] duration-200 ease-ow-spring data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none";

/**
 * `/legal`, revamped (Abu, 8 Oct): the three facts that matter first, then one dropdown per topic in the status page's
 * shape — glyph, title, the gist in one line — opening to its short points. Panels are `hidden="until-found"`, so the
 * browser's find still reaches every line.
 */
export function LegalScreen() {
  return (
    <div className="container grid gap-8 py-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12 lg:py-12">
      <header className="flex flex-col gap-5 lg:sticky lg:top-(--stage-sticky-top,1.5rem) lg:self-start">
        <div className="flex items-start gap-3">
          <h1 className="ow-display ow-display-lg text-ow-ink">{LEGAL.heading}</h1>
          <Sticker tone="lime" tilt={-6} size="sm" className="mt-1">
            {LEGAL.sticker}
          </Sticker>
        </div>
        <p className="ow-body max-w-sm text-ow-lead text-ow-muted">{LEGAL.lede}</p>
        <ul className="flex flex-wrap gap-2">
          {LEGAL.facts.map((fact) => (
            <li key={fact} className="inline-flex h-8 items-center rounded-full bg-ow-card px-3.5 text-ow-label font-bold text-ow-ink ring-1 ring-ow-hairline">
              {fact}
            </li>
          ))}
        </ul>
        <a href={LEGAL.contact.href} rel="noopener" className="inline-flex w-fit items-center gap-2 text-ow-label text-ow-muted hover:text-ow-ink">
          <AtSign aria-hidden className="size-4" />
          {LEGAL.contact.label} · <span className="font-bold text-ow-ink">{LEGAL.contact.text}</span>
        </a>
      </header>

      <Accordion.Root multiple defaultValue={["test-funds"]} className="flex flex-col gap-3">
        {LEGAL.sections.map((section) => {
          const Glyph = ICON[section.id] ?? Scale;
          return (
            <Accordion.Item key={section.id} value={section.id} id={section.id} className="scroll-mt-24 rounded-ow-card bg-ow-card ring-1 ring-ow-hairline">
              <Accordion.Header>
                <Accordion.Trigger className="group flex w-full items-center gap-3 px-4 py-3.5 text-left outline-none focus-visible:rounded-ow-card focus-visible:ring-2 focus-visible:ring-ow-pink-ink">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ow-recessed">
                    <Glyph aria-hidden className="size-4.5" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-ow-lead font-bold">{section.title}</span>
                    <span className="truncate text-ow-caption text-ow-muted">{section.gist}</span>
                  </span>
                  <ChevronDown aria-hidden className={CHEVRON} />
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel hiddenUntilFound className={PANEL}>
                <div className="mx-4 flex flex-col gap-3 border-t border-ow-hairline py-4">
                  <ul className="flex flex-col gap-2.5">
                    {section.points.map((point) => (
                      <li key={point} className="flex gap-2.5 text-ow-body text-ow-ink">
                        <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-ow-pink" />
                        {point}
                      </li>
                    ))}
                  </ul>
                  {"links" in section && section.links ? (
                    <p className="flex flex-wrap gap-x-4 gap-y-1 pl-4 text-ow-label">
                      {section.links.map((link) => (
                        <a key={link.href} href={link.href} rel="noopener" className="font-bold text-ow-pink-ink underline decoration-ow-pink/40 underline-offset-3 hover:decoration-ow-pink">
                          {link.text}
                        </a>
                      ))}
                    </p>
                  ) : null}
                </div>
              </Accordion.Panel>
            </Accordion.Item>
          );
        })}
      </Accordion.Root>
    </div>
  );
}
