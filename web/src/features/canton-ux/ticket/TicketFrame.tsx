"use client";

import type { ReactNode } from "react";
import { AmountBlock } from "@/features/markets/ticket/AmountBlock";
import { BetAgainstToggle } from "@/features/markets/ticket/BetAgainstToggle";
import { BetModes } from "@/features/markets/ticket/BetModes";
import { ReadoutStrip, type ReadoutCells } from "@/features/markets/ticket/ReadoutStrip";
import { SideSegments } from "@/features/markets/ticket/SideSegments";
import { TICKET } from "@/lib/copy";

const noop = () => undefined;
const NO_RESERVE = { value: 1, onChange: noop, available: false, maxMultiple: 1, lockedReason: null } as const;

export interface FrameQuote {
  stakeText: string;
  stakeBase: bigint;
  balanceBase: bigint;
  decimals: number;
  symbol: string;
  cells: ReadoutCells;
  chancePct: number;
}

interface TicketFrameProps {
  quote: FrameQuote;
  /** Between the amount block and the strip (direction B's held price). */
  beforeStrip?: ReactNode;
  /** The CTA region: the reference CTA, or what a direction puts in its place. */
  cta: ReactNode;
  /** Under the CTA, above the footnote (direction A's inline progress). */
  afterCta?: ReactNode;
  /** Laid over the ticket's lower half (direction C's receipt drawer). */
  overlay?: ReactNode;
  label: string;
}

/**
 * The reference ticket's blocks in the reference order (`Ticket.tsx`: mode · side · against · amount · strip · CTA ·
 * footnote), rendered from the real components with canned props so each direction changes only its slot. The
 * account gate and Public / Private are left out because they read live hooks and render nothing for a funded seat.
 */
export function TicketFrame({ quote, beforeStrip, cta, afterCta, overlay, label }: TicketFrameProps) {
  return (
    <section aria-label={label} className="tk-ticket tk-ticket--rail cx-tk">
      <BetModes mode="dir" onChange={noop} rangeAvailable={false} />
      <SideSegments side="up" onSelect={noop} />
      <BetAgainstToggle />
      <AmountBlock
        value={quote.stakeText}
        onChange={noop}
        stakeBase={quote.stakeBase}
        onStakeBase={noop}
        balanceBase={quote.balanceBase}
        decimals={quote.decimals}
        symbol={quote.symbol}
        belowMin={false}
        leverage={NO_RESERVE}
        costBase={null}
      />
      {beforeStrip}
      <ReadoutStrip cells={quote.cells} live caption={TICKET.liveOdds} chance={TICKET.chance(quote.chancePct)} />
      {cta}
      {afterCta}
      <p className="tk-foot">{TICKET.footnote}</p>
      {overlay}
    </section>
  );
}
