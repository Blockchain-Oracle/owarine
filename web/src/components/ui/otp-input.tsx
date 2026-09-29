"use client";

/**
 * OTP Input — adapted from the 21st.dev catalogue: component #23543 "OTP Input" (registry item ddoemonn/otp-input,
 * author ddoemonn, 21st user user_2y2pjLtk7oS33zts6BqhEIOHrAj), pulled with `21st get 23543` on 2026-09-29. The
 * registry payload declares no licence; it is a public 21st.dev registry item (isPublic: true).
 *
 * What changed from the source: the stone/emerald/red/blue utility strings and hex literals became `otp-input.css` in
 * the reference tokens (accent for the active cell, profit for success, loss for error); cell state is a data attribute
 * instead of a class ladder; the state hook lives in `use-otp-input.ts`. Motion is the source's (`motion/react`, which
 * the reference ships): the character crossfade, the caret blink and the error shake, all off under reduced motion.
 */
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useImperativeHandle, useRef, type Ref } from "react";
import { cn } from "@/lib/utils";
import { useOtpInput, type OtpMode } from "./use-otp-input";
import "./otp-input.css";

const CROSSFADE = { type: "spring", stiffness: 260, damping: 34, mass: 0.8 } as const;
const EASE = [0.23, 1, 0.32, 1] as const;

export type OtpStatus = "idle" | "error" | "success";
export type { OtpMode };

export interface OtpInputHandle {
  clear: () => void;
  focus: () => void;
}

export interface OtpInputProps {
  length?: number;
  mode?: OtpMode;
  defaultValue?: string;
  onChange?: (value: string) => void;
  onComplete?: (value: string) => void;
  status?: OtpStatus;
  errorMessage?: string;
  successMessage?: string;
  hint?: string;
  label?: string;
  groupEvery?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  focusOnError?: boolean;
  className?: string;
  ref?: Ref<OtpInputHandle>;
}

export function OtpInput({
  length = 6,
  mode = "numeric",
  defaultValue = "",
  onChange,
  onComplete,
  status = "idle",
  errorMessage = "",
  successMessage = "",
  hint = "",
  label = "Verification code",
  groupEvery = 3,
  disabled = false,
  autoFocus = false,
  focusOnError = true,
  className,
  ref,
}: OtpInputProps) {
  const reduced = useReducedMotion();
  const statusId = useId();
  const { chars, focusedIndex, getCellProps, focusAt, clear } = useOtpInput({ length, mode, defaultValue, disabled, onChange, onComplete });

  const wasError = useRef(false);
  const error = status === "error";
  const success = status === "success";

  useImperativeHandle(ref, () => ({ clear: () => { clear(); focusAt(0); }, focus: () => focusAt(0) }), [clear, focusAt]);

  useEffect(() => {
    if (error && !wasError.current && focusOnError && !disabled) focusAt(0);
    wasError.current = error;
  }, [error, focusOnError, disabled, focusAt]);

  useEffect(() => {
    if (autoFocus && !disabled) focusAt(0);
  }, [autoFocus, disabled, focusAt]);

  const enter = reduced ? { duration: 0 } : { duration: 0.22, ease: EASE };
  const swap = reduced ? { duration: 0 } : CROSSFADE;
  const hasStatus = hint.length > 0 || errorMessage.length > 0 || successMessage.length > 0;
  const message = error ? errorMessage : success ? successMessage : hint;

  return (
    <div className={cn("otp", className)} data-status={status}>
      <motion.div
        role="group"
        aria-label={label}
        className="otp-cells"
        initial={false}
        variants={{ idle: { x: 0 }, wrong: { x: [0, -5, 4, -3, 0] } }}
        animate={error && !reduced ? "wrong" : "idle"}
        transition={{ duration: 0.32, ease: EASE }}
      >
        {Array.from({ length }, (_, i) => {
          const char = chars[i] ?? "";
          const active = focusedIndex === i;
          const gap = groupEvery > 0 && i > 0 && i % groupEvery === 0;
          const state = error ? "error" : success ? "success" : active ? "active" : char ? "filled" : "empty";
          return (
            <div key={i} className="otp-cell" data-gap={gap ? "" : undefined}>
              <input
                {...getCellProps(i)}
                aria-label={`${label}, character ${i + 1} of ${length}`}
                aria-invalid={error || undefined}
                aria-describedby={hasStatus ? statusId : undefined}
                className="otp-input"
                data-state={state}
              />
              <span aria-hidden className="otp-glyph">
                <AnimatePresence initial={false} mode="popLayout">
                  {char ? (
                    <motion.span
                      key={char}
                      initial={reduced ? false : { opacity: 0, scale: 0.97, y: 10, filter: "blur(0.375rem)" }}
                      animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0rem)" }}
                      exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: -6, filter: "blur(0.1875rem)" }}
                      transition={enter}
                      className="otp-char"
                    >
                      {char}
                    </motion.span>
                  ) : null}
                </AnimatePresence>
                {active && !char && !disabled ? (
                  <motion.span
                    className="otp-caret"
                    initial={{ opacity: 1 }}
                    animate={reduced ? { opacity: 1 } : { opacity: [1, 1, 0, 0] }}
                    transition={reduced ? { duration: 0 } : { duration: 1.06, times: [0, 0.5, 0.5, 1], repeat: Infinity, ease: "linear" }}
                  />
                ) : null}
              </span>
            </div>
          );
        })}
      </motion.div>

      {hasStatus && (
        <>
          <div aria-hidden className="otp-message">
            <AnimatePresence initial={false} mode="wait">
              <motion.span
                key={status}
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, y: -3 }}
                transition={swap}
                className="otp-message-text"
              >
                {message}
              </motion.span>
            </AnimatePresence>
          </div>
          <span id={statusId} role="status" className="sr-only">
            {message}
          </span>
        </>
      )}
    </div>
  );
}
