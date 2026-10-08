"use client";

import type { WritePhase } from "@owarine/core/ports";
import { Check, CircleAlert, LoaderCircle } from "lucide-react";
import type { CSSProperties } from "react";
import { TapHash } from "@/components/data/TapHash";
import { ID_LABEL } from "../id-label";
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
  if (variant === "block") return <WritePill phase={phase} updateId={updateId} words={T} />;
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
            <TapHash value={updateId} lead={8} tail={4} label={ID_LABEL.update} className="cx-write-id" />
          </>
        )}
      </p>
    </div>
  );
}

/** The pill's fill per phase: each confirmed step is a quarter; a stop holds the fill where it stopped. */
const FILL: Record<WritePhase, number> = { composing: 25, submitted: 50, confirming: 75, confirmed: 100, reverted: 75, unknown: 75 };
/** One line inside the pill; a failure's full sentence goes under it. */
const SHORT: Record<WritePhase, string> = {
  composing: "Holding your price",
  submitted: "Sending to the ledger",
  confirming: "Venue confirming",
  confirmed: "Placed",
  reverted: "Not accepted",
  unknown: "Checking the ledger",
};

/**
 * The block write progress (Abu, 8 Oct: the four-step stepper in a pill "sucks"): the ticket's call button turns into its
 * own progress bar, the same pill at the same height, filling as the call is held, sent, confirmed and placed. One line
 * inside with the step count; placed goes green with its ledger update under it, a refusal goes red with why.
 */
function WritePill({ phase, updateId, words }: { phase: WritePhase; updateId?: string; words: WriteWords }) {
  const done = phase === "confirmed";
  const failed = phase === "reverted";
  const unsure = phase === "unknown";
  const step = Math.min(STEP_OF[phase], words.steps.length);
  const icon = done ? <Check aria-hidden className="size-5" strokeWidth={3} /> : failed || unsure ? <CircleAlert aria-hidden className="size-5" /> : <LoaderCircle aria-hidden className="size-5 animate-spin" />;
  return (
    <div className="cx-pill-wrap" data-phase={phase}>
      <div className="cx-pill" style={{ "--fill": `${FILL[phase]}%` } as CSSProperties} aria-hidden>
        <span className="cx-pill-fill" />
        <span className="cx-pill-body">
          {icon}
          <span className="cx-pill-text">{phase === "confirmed" ? SHORT.confirmed : words === T ? SHORT[phase] : words.status[phase].replace(/…$/, "")}</span>
          {!done && !failed && !unsure ? <span className="cx-pill-count">{step}/{words.steps.length}</span> : null}
        </span>
      </div>
      <p className="cx-pill-note" role="status">
        <span className="sr-only">{words.step(step, words.steps.length, words.steps[step - 1]?.label ?? "")}. </span>
        {done ? (
          updateId ? (
            <>
              {words.status.confirmed} <TapHash value={updateId} lead={8} tail={4} label={ID_LABEL.update} className="cx-write-id" />
            </>
          ) : (
            words.status.confirmed.replace(/\. Ledger update$/, ".")
          )
        ) : failed || unsure ? (
          words.status[phase]
        ) : (
          <span className="sr-only">{words.status[phase]}</span>
        )}
      </p>
    </div>
  );
}
