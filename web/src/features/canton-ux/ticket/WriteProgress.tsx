"use client";

import type { WritePhase } from "@agari/core/ports";
import { Hash } from "@/components/data/Hash";
import { StepProgress } from "@/components/ui/desk-kit";
import { TICKET_CANTON } from "./copy";

const T = TICKET_CANTON;
/** The words a write's steps speak; a sale (C7a cash-out) passes its own. */
export interface WriteWords {
  progressLabel: string;
  steps: readonly { label: string; hint: string }[];
  status: Record<WritePhase, string>;
  step: (n: number, total: number, label: string) => string;
}
const noop = () => undefined;

/** Where each of `WritePhase`'s six values sits on the four steps; the two failures stop at the step they failed on. */
const STEP_OF: Record<WritePhase, number> = { composing: 1, submitted: 2, confirming: 3, confirmed: 5, reverted: 3, unknown: 3 };

/**
 * Write progress (C-ADD-08) on the desk kit's `StepProgress` (21st #29458): composing, submitted, confirming, confirmed,
 * with reverted and unknown drawn as an error on the step they stopped at. The steps are a picture (inert: a placed
 * call has nothing to revisit); the one status line under them is what a screen reader hears.
 */
export function WriteProgress({ phase, updateId, variant = "inline", words = T }: { phase: WritePhase; updateId?: string; variant?: "inline" | "block" | "receipt"; words?: WriteWords }) {
  const T = words;
  const current = STEP_OF[phase];
  const error = phase === "reverted" || phase === "unknown";
  const label = T.steps[Math.min(current, T.steps.length) - 1]?.label ?? "";
  return (
    <div className="cx-write" data-variant={variant} data-phase={phase} data-error={error ? "" : undefined}>
      <div inert>
        <StepProgress steps={T.steps} current={current} onPick={noop} label={T.progressLabel} />
      </div>
      <p className="cx-write-status" role="status">
        <span className="sr-only">{T.step(Math.min(current, T.steps.length), T.steps.length, label)}. </span>
        {T.status[phase]}
        {phase === "confirmed" && updateId && (
          <>
            {" "}
            <Hash value={updateId} lead={8} tail={4} className="cx-write-id" />
          </>
        )}
      </p>
    </div>
  );
}
