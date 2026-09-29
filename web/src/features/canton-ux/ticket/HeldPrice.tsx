"use client";

import type { ReactNode } from "react";
import { TICKET_CANTON } from "./copy";
import { QuoteRing } from "./QuoteRing";
import "./ticket-canton.css";

const T = TICKET_CANTON;

/**
 * K-010a's held-price row (direction B): the firm price on its own row with the 20 s ring beside it; once it ran out
 * and the venue priced again, the same row names the fresh price and the old one, and the ring is gone.
 */
export function HeldPriceRow({
  priceCents,
  remainingSec,
  expired,
  aside,
}: {
  priceCents: number;
  remainingSec: number | null;
  expired?: { fromCents: number; toCents: number };
  /** Beside the note: the ticket puts "Who can see this" here. */
  aside?: ReactNode;
}) {
  const held = !expired && (remainingSec ?? 0) > 0;
  return (
    <div className="cx-b-held" data-expired={expired ? "" : undefined} role={expired ? "status" : undefined}>
      {held && <QuoteRing remainingSec={remainingSec ?? 0} />}
      <span className="cx-b-price">{T.ring.price(expired?.toCents ?? priceCents)}</span>
      <span className="cx-b-note">{expired ? T.expired.fresh(expired.fromCents, expired.toCents) : T.ring.heldShort}</span>
      {aside}
    </div>
  );
}
