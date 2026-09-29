"use client";

import { Fixture } from "@/app/dev/states/_sections/Fixture";
import { SectionHeader } from "@/components/chrome";
import { DirectionTicket, LiveDirection, TICKET_CANTON } from "@/features/canton-ux/ticket";
import { DIRECTIONS, FRAMES, MAX_COST_BASE, PRICE_CENTS, QUOTE, UPDATE_ID } from "./fixtures";

const COMMON = { quote: QUOTE, priceCents: PRICE_CENTS, maxCostBase: MAX_COST_BASE } as const;

/**
 * `/dev/ticket-canton` (D-081): the ticket's write progress and 20 s held price in three directions for the owner to
 * choose from. Each ticket is the reference's own blocks with canned props; only the slot each direction names changes.
 */
export function TicketCantonFixtures() {
  return (
    <div className="container flex flex-col gap-10 py-8">
      <SectionHeader index="00" eyebrow="Fixtures · D-081 choice" title={TICKET_CANTON.devTitle} />
      <p className="type-caption text-ink-muted">
        The ticket stays the reference ticket. Each direction adds the same two things, the write steps (StepProgress) and the 20 s held price (CountdownRing), in a different place. Press the first
        ticket&apos;s button in each row to play a placement.
      </p>
      {DIRECTIONS.map((d, i) => (
        <section key={d.id} className="flex flex-col gap-4" aria-labelledby={`direction-${d.id}`}>
          <SectionHeader index={`0${i + 1}`} title={d.title} />
          <p id={`direction-${d.id}`} className="type-body max-w-3xl text-ink-secondary">
            {d.why}
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Fixture label="Live — press the button" className="min-w-0 max-md:border-0 max-md:bg-transparent max-md:p-0">
              <LiveDirection direction={d.id} {...COMMON} label={`Direction ${d.id}, live`} updateId={UPDATE_ID} />
            </Fixture>
            {FRAMES.map((f) => (
              <Fixture key={f.label} label={f.label} className="min-w-0 max-md:border-0 max-md:bg-transparent max-md:p-0">
                <DirectionTicket direction={d.id} {...COMMON} state={f.state} label={`Direction ${d.id}: ${f.label}`} />
              </Fixture>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
