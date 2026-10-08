"use client";

import { SectionHeader } from "@/components/chrome";
import { Fixture } from "./Fixture";

export function ChromeSection() {
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader index="04" title="Chrome" eyebrow="section rhythm" />
      <Fixture label="Section header — index · title · eyebrow">
        <SectionHeader index="02" title="The window" eyebrow="live now" />
      </Fixture>
    </section>
  );
}
