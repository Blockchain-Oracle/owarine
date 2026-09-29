"use client";

import { countdown } from "@agari/core/lifecycle";
import { Armchair, Hourglass } from "lucide-react";
import type { ReactNode } from "react";
import { Countdown } from "@/components/data/Countdown";
import { CountdownRing } from "@/components/data/CountdownRing";
import { useNowMs } from "@/components/data/useNowMs";
import { EmptyState, StatusDot } from "@/components/ui/desk-kit";
import { SEAT } from "./copy";
import "./seat.css";

const P = SEAT.pool;

interface DeadlineProps {
  /** When the next seat frees (or the last open call settles), in epoch seconds; null until known. */
  atSec: number | null;
  /** The span the ring is drawn against. */
  spanSec: number;
}

function Ring({ atSec, spanSec, icon }: DeadlineProps & { icon: ReactNode }) {
  const now = useNowMs();
  const state = atSec !== null && now > 0 ? countdown(now, atSec, spanSec) : null;
  return (
    <CountdownRing fraction={state?.fraction ?? 1} urgent={state?.urgent ?? false} className="cx-plate-ring">
      {icon}
    </CountdownRing>
  );
}

/**
 * Pool full (C-ADD-10): the desk kit's `EmptyState` with the reference `CountdownRing` in its mark, the reference
 * `Countdown` for the next free seat and a `StatusDot` for the wait. The page keeps the reader's place in line and
 * takes the seat itself, so there is nothing to press.
 */
export function PoolFullPlate({ atSec, spanSec, ahead }: DeadlineProps & { ahead: number }) {
  return (
    <section className="cx-plate" aria-label={P.fullTitle}>
      <EmptyState
        icon={<Ring atSec={atSec} spanSec={spanSec} icon={<Armchair />} />}
        title={P.fullTitle}
        body={P.fullBody}
        action={
          <div className="cx-plate-meta">
            <span className="cx-plate-clock">
              {P.nextFrees} {atSec !== null ? <Countdown expirySec={atSec} intervalSec={spanSec} /> : "–:––"}
            </span>
            <StatusDot tone="warn">
              {P.waiting} · {P.inLine(ahead)}
            </StatusDot>
          </div>
        }
      />
    </section>
  );
}

/** Draining (C-OPS-07's `leased → draining → free`, as its holder sees it): open calls settle before anything moves. */
export function DrainingPlate({ atSec, spanSec, openCalls }: DeadlineProps & { openCalls: number }) {
  return (
    <section className="cx-plate" aria-label={P.drainingTitle}>
      <EmptyState
        icon={<Ring atSec={atSec} spanSec={spanSec} icon={<Hourglass />} />}
        title={P.drainingTitle}
        body={P.drainingBody}
        action={
          <div className="cx-plate-meta">
            {atSec !== null && (
              <span className="cx-plate-clock">
                {P.lastSettles} <Countdown expirySec={atSec} intervalSec={spanSec} />
              </span>
            )}
            <StatusDot tone="warn">
              {P.closing} · {P.openCalls(openCalls)}
            </StatusDot>
          </div>
        }
      />
    </section>
  );
}
