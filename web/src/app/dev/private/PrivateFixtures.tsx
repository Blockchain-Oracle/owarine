"use client";

import Link from "next/link";
import { Fixture, FixtureGrid } from "@/app/dev/states/_sections/Fixture";
import { SectionHeader } from "@/components/chrome";
import { PRIVATE, PrivateBalancePanel, PrivateClaims } from "@/features/private";
import { RouteControl } from "@/features/session";
import { FIXTURE_SYMBOL, POSITIONS } from "./fixtures";

const noop = () => undefined;
const ROUTE = { onChange: noop, vaultAvailableBase: 12_000_000n, decimals: 6, symbol: FIXTURE_SYMBOL, armed: false, deployed: true } as const;
const LIST = { decimals: 6, symbol: FIXTURE_SYMBOL, onCashOut: noop, busySlot: null } as const;

/** `/dev/private` — the route control's private states and the private list on Canton (C8d), then the live panel. Scaffolding: never linked from the app. */
export function PrivateFixtures() {
  return (
    <div className="container pl-page">
      <SectionHeader index="00" eyebrow="Fixtures" title={PRIVATE.devTitle} />
      <p className="type-caption text-ink-muted">
        Canned readings of the seat&apos;s private bucket and its private calls. The live control is on <Link href="/markets">/markets</Link>, the panel on <Link href="/portfolio">/portfolio</Link>.
      </p>
      <FixtureGrid>
        <Fixture label="Route control — Private ready, chosen">
          <RouteControl {...ROUTE} source="private" privateOption={{ label: PRIVATE.route.label, enabled: true, title: PRIVATE.route.titleReady, retry: null, retryLabel: PRIVATE.route.retry }} />
        </Fixture>
        <Fixture label="Route control — checking private mode">
          <RouteControl {...ROUTE} source="wallet" privateOption={{ label: PRIVATE.route.label, enabled: false, title: PRIVATE.route.titleProbing, retry: null, retryLabel: PRIVATE.route.retry }} />
        </Fixture>
        <Fixture label="Route control — not available (venue reduce-only), with retry">
          <RouteControl {...ROUTE} source="wallet" privateOption={{ label: PRIVATE.route.label, enabled: false, title: PRIVATE.route.titleUnavailable("the venue is reduce-only by its operator"), retry: noop, retryLabel: PRIVATE.route.retry }} />
        </Fixture>
        <Fixture label="Route control — over the private cap">
          <RouteControl {...ROUTE} source="wallet" privateOption={{ label: PRIVATE.route.label, enabled: false, title: PRIVATE.route.titleOverCap(`50 ${FIXTURE_SYMBOL}`), retry: null, retryLabel: PRIVATE.route.retry }} />
        </Fixture>
      </FixtureGrid>
      <FixtureGrid>
        <Fixture label="Private calls — open, settled (Cash out), lost, home">
          <PrivateClaims {...LIST} positions={POSITIONS} />
        </Fixture>
        <Fixture label="Private calls — reading, then none">
          <PrivateClaims {...LIST} positions={null} />
          <PrivateClaims {...LIST} positions={[]} />
        </Fixture>
        <Fixture label="Private calls — cashing out the settled one">
          <PrivateClaims {...LIST} positions={POSITIONS.slice(1, 2)} busySlot={POSITIONS[1]!.pairId} />
        </Fixture>
      </FixtureGrid>
      <FixtureGrid>
        <Fixture label="Live — the seat's private balance and calls">
          <PrivateBalancePanel />
        </Fixture>
      </FixtureGrid>
    </div>
  );
}
