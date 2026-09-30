"use client";

import type { Side } from "@agari/core/types";
import { Button } from "@/components/ui/button";
import { TICKET } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { useBetAgainst, sidesInOrder } from "../bet-against";
import { SIDE_CLASSES, SIDE_WORD } from "../side-styles";

interface SideSegmentsProps {
  side: Side | null;
  onSelect: (side: Side) => void;
  /** The side words: UP/DOWN, or Yes/No on a committee event (C6e). */
  words?: Readonly<Record<Side, string>>;
}

/**
 * Tap-is-the-choice: the two sides read as one control, and the word never leaves the wash (color law).
 * While "Betting against" is on, DOWN is the first segment (A-1a) — the same two sides, in the caller's order.
 */
export function SideSegments({ side, onSelect, words = SIDE_WORD }: SideSegmentsProps) {
  const betAgainst = useBetAgainst();
  return (
    <div role="radiogroup" aria-label={TICKET.sideLabel} className="grid grid-cols-2 gap-2">
      {sidesInOrder(betAgainst).map((option) => (
        <Button
          key={option}
          role="radio"
          aria-checked={side === option}
          aria-pressed={side === option}
          variant="outline"
          size="lg"
          onClick={() => onSelect(option)}
          className={cn("type-body-strong", SIDE_CLASSES[option])}
        >
          {words[option]}
        </Button>
      ))}
    </div>
  );
}
