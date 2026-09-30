"use client";

import { useEffect, useState } from "react";
import { Fixture, FixtureGrid } from "@/app/dev/states/_sections/Fixture";
import { SectionHeader } from "@/components/chrome";
import { DrainingPlate, PoolFullPlate, SEAT, SeatAccountMenu, LINK_TTL_SEC, SeatLinkCard } from "@/features/canton-ux/seat";
import { webEnv } from "@/lib/env";
import { DRAIN_LEFT_SEC, DRAIN_SPAN_SEC, DRAINING, LEASE_LEFT_SEC, LEASE_SPAN_SEC, LEASED, LINK_CODE, LINK_LEFT_SEC, linkUrl, POOL_LEFT_SEC, POOL_SPAN_SEC, WAITING_KEY } from "./fixtures";

const noop = () => undefined;
const URL_TEXT = linkUrl(webEnv.appOrigin, LINK_CODE);
/** The fixture's verifier: the canned code joins, anything else is refused, after the ledger's usual second. */
const verify = (code: string) => new Promise<boolean>((resolve) => setTimeout(() => resolve(code === LINK_CODE), 900));

/** A deadline `sec` from first paint; null on the server so server and client markup agree. */
function useDeadline(sec: number): number | null {
  const [at, setAt] = useState<number | null>(null);
  useEffect(() => setAt(Math.floor(Date.now() / 1000) + sec), [sec]);
  return at;
}

/** The link card as it runs: a live code that expires by itself, a fresh one on request. */
function LiveLink() {
  const first = useDeadline(LINK_LEFT_SEC);
  const [fresh, setFresh] = useState<number | null>(null);
  return (
    <SeatLinkCard
      state="showing"
      code={LINK_CODE}
      url={URL_TEXT}
      expiresAtSec={fresh ?? first}
      seatNumber={LEASED.seatNumber}
      onFresh={() => setFresh(Math.floor(Date.now() / 1000) + LINK_TTL_SEC)}
      verify={verify}
    />
  );
}

/** `/dev/seat`: the guest-seat account menu, the pool plates and the seat link, from canned leases. */
export function SeatFixtures() {
  const leaseAt = useDeadline(LEASE_LEFT_SEC);
  const poolAt = useDeadline(POOL_LEFT_SEC);
  const drainAt = useDeadline(DRAIN_LEFT_SEC);
  return (
    <div className="container flex flex-col gap-8 py-8">
      <SectionHeader index="00" eyebrow="Fixtures" title={SEAT.devTitle} />
      <p className="type-caption text-ink-muted">Canned leases only. Timers tick from page load; the seat link accepts {LINK_CODE} and refuses anything else.</p>

      <section className="flex flex-col gap-4">
        <SectionHeader index="01" title="Account menu" eyebrow="avatar + dropdown · Hash · Countdown" />
        <FixtureGrid>
          <Fixture label="Connected — a leased seat (menu open)" className="pb-80">
            <div className="flex justify-end">
              <SeatAccountMenu {...LEASED} state="leased" leaseExpirySec={leaseAt} leaseSpanSec={LEASE_SPAN_SEC} defaultOpen onLink={noop} onReset={noop} />
            </div>
          </Fixture>
          <Fixture label="Connected — the seat is closing (menu open)" className="pb-80">
            <div className="flex justify-end">
              <SeatAccountMenu {...DRAINING} state="draining" leaseExpirySec={null} leaseSpanSec={LEASE_SPAN_SEC} defaultOpen onLink={noop} onReset={noop} />
            </div>
          </Fixture>
        </FixtureGrid>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader index="02" title="Pool" eyebrow="EmptyState + CountdownRing + StatusDot" />
        <FixtureGrid>
          <Fixture label="Pool full — waiting, next in line">
            <PoolFullPlate atSec={poolAt} spanSec={POOL_SPAN_SEC} ahead={1} />
          </Fixture>
          <Fixture label="Draining — open calls closed out at cost">
            <DrainingPlate atSec={drainAt} spanSec={DRAIN_SPAN_SEC} openCalls={2} />
          </Fixture>
        </FixtureGrid>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader index="03" title="Seat link" eyebrow="21st 29246 layout · OTP Input (21st 23543) · qrcode-generator" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Fixture label="Showing a code — live, expires by itself">
            <LiveLink />
          </Fixture>
          <Fixture label="Expired — and a refused code below">
            <SeatLinkCard state="expired" code={LINK_CODE} url={URL_TEXT} expiresAtSec={null} seatNumber={LEASED.seatNumber} onFresh={noop} verify={verify} joinDefault={{ value: "Q4TZ9BX2", status: "error" }} />
          </Fixture>
          <Fixture label="Allow — a device used the code and waits for this one (C4c)">
            <SeatLinkCard state="confirm" code={LINK_CODE} url={URL_TEXT} expiresAtSec={null} seatNumber={LEASED.seatNumber} waitingKey={WAITING_KEY} onDecide={() => new Promise((r) => setTimeout(r, 900))} onFresh={noop} verify={verify} />
          </Fixture>
          <Fixture label="Not allowed — this device refused it">
            <SeatLinkCard state="declined" code={LINK_CODE} url={URL_TEXT} expiresAtSec={null} seatNumber={LEASED.seatNumber} onFresh={noop} verify={verify} />
          </Fixture>
          <Fixture label="Linked — the other device joined">
            <SeatLinkCard state="linked" code={LINK_CODE} url={URL_TEXT} expiresAtSec={null} seatNumber={LEASED.seatNumber} linkedDevice="Your iPhone" onFresh={noop} verify={verify} />
          </Fixture>
        </div>
      </section>
    </div>
  );
}
