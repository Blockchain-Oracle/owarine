"use client";

import { Fixture, FixtureGrid } from "@/app/dev/states/_sections/Fixture";
import { SectionHeader } from "@/components/chrome";
import { PRIVACY, ViewSwitcher, WhoCanSee, type SeenKind } from "@/features/canton-ux/privacy";
import { VIEWS } from "./fixtures";

const CHIPS: ReadonlyArray<{ kind: SeenKind; label: string; line: string; open?: boolean }> = [
  { kind: "position", label: "Chip — your position (details open)", line: "TSLA · 5m Window · UP · 5.00 credits at 62¢", open: true },
  { kind: "quote", label: "Chip — a firm quote", line: "Price held for you: 62¢ for 20 s" },
  { kind: "receipt", label: "Chip — a settled receipt", line: "Won · paid 8.06 credits · settled 14:40:00 UTC" },
];

/** `/dev/canton-privacy`: the chip in its three places and the Alice / Bob / Outsider switcher, from canned ledger answers. */
export function PrivacyFixtures() {
  return (
    <div className="container flex flex-col gap-8 py-8">
      <SectionHeader index="00" eyebrow="Fixtures" title={PRIVACY.devTitle} />
      <p className="type-caption text-ink-muted">Canned ledger answers only. Hover or focus a chip for who can see it; switch tabs to ask as another party.</p>
      <section className="flex flex-col gap-4">
        <SectionHeader index="01" title={PRIVACY.chip.label} eyebrow="badge + tooltip + LogoStack" />
        <FixtureGrid>
          {CHIPS.map((c) => (
            <Fixture key={c.kind} label={c.label} className={c.open ? "pb-40" : undefined}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="type-body text-ink">{c.line}</span>
                <WhoCanSee kind={c.kind} defaultOpen={c.open} />
              </div>
            </Fixture>
          ))}
        </FixtureGrid>
      </section>
      <section className="flex flex-col gap-4">
        <SectionHeader index="02" title="Whose view" eyebrow="UnderlineTabs + Code Block (21st 23586)" />
        <Fixture label="Alice, Bob and an outsider — one query, one offset, three answers">
          <ViewSwitcher views={VIEWS} />
        </Fixture>
        <Fixture label="Opened on the outsider — the honest empty answer">
          <ViewSwitcher views={VIEWS} initial="outsider" />
        </Fixture>
      </section>
    </div>
  );
}
