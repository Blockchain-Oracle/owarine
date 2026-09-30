"use client";

import { SESSION } from "./copy";

/**
 * Where the reference's tap-trading chip sat on the ticket, as the phone draws it (mobile `features/markets/ticket/
 * FastChip.tsx`): the same leverage-chip grammar, shown on and not pressable, because there is nothing to arm. A seat
 * already trades in one tap, with no second key and no caps to set.
 */
export function FastChip() {
  return (
    <span className="tk-lev" data-on="" role="note" title={SESSION.fast.why} aria-label={`${SESSION.fast.label}: ${SESSION.fast.why}`}>
      {SESSION.fast.label}
    </span>
  );
}
