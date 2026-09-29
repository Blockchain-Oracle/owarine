"use client";

/**
 * The OTP Input's state hook — adapted from the 21st.dev catalogue: component #23543 "OTP Input" (registry item
 * ddoemonn/otp-input, author ddoemonn, 21st user user_2y2pjLtk7oS33zts6BqhEIOHrAj), pulled with `21st get 23543` on
 * 2026-09-29. The registry payload declares no licence; it is a public 21st.dev registry item (isPublic: true).
 *
 * Split out of the source's single file to keep both under the 400-line cap. Behaviour is the source's (per-cell entry,
 * paste fills forward, Backspace/Delete/arrows/Home/End), with one change: alphanumeric codes are upper-cased as typed,
 * so a seat-link code reads the same on both devices.
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type FocusEvent,
  type KeyboardEvent,
} from "react";

export type OtpMode = "numeric" | "alphanumeric";

const ALLOW: Record<OtpMode, RegExp> = {
  numeric: /^[0-9]$/,
  alphanumeric: /^[0-9a-zA-Z]$/,
};

export type UseOtpInputOptions = {
  length?: number;
  mode?: OtpMode;
  defaultValue?: string;
  disabled?: boolean;
  onChange?: (value: string) => void;
  onComplete?: (value: string) => void;
};

export type OtpCellProps = {
  ref: (el: HTMLInputElement | null) => void;
  value: string;
  disabled: boolean;
  type: "text";
  inputMode: "numeric" | "text";
  autoComplete: string;
  autoCorrect: "off";
  autoCapitalize: "off";
  spellCheck: false;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  onPaste: (e: ClipboardEvent<HTMLInputElement>) => void;
  onFocus: (e: FocusEvent<HTMLInputElement>) => void;
  onBlur: (e: FocusEvent<HTMLInputElement>) => void;
};

export type UseOtpInputReturn = {
  chars: string[];
  value: string;
  length: number;
  complete: boolean;
  focusedIndex: number;
  getCellProps: (index: number) => OtpCellProps;
  focusAt: (index: number) => void;
  clear: () => void;
};

export function useOtpInput({
  length = 6,
  mode = "numeric",
  defaultValue = "",
  disabled = false,
  onChange,
  onComplete,
}: UseOtpInputOptions = {}): UseOtpInputReturn {
  const allow = ALLOW[mode];

  const keep = useCallback(
    (text: string) =>
      text
        .split("")
        .filter((c) => allow.test(c))
        .join("")
        .toUpperCase(),
    [allow],
  );

  const [chars, setChars] = useState<string[]>(() => {
    const seed = defaultValue
      .split("")
      .filter((c) => ALLOW[mode].test(c))
      .map((c) => c.toUpperCase())
      .slice(0, length);
    return Array.from({ length }, (_, i) => seed[i] ?? "");
  });
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const charsRef = useRef(chars);
  charsRef.current = chars;

  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const changed = useRef(onChange);
  changed.current = onChange;
  const completed = useRef(onComplete);
  completed.current = onComplete;

  useEffect(() => {
    setChars((prev) =>
      prev.length === length
        ? prev
        : Array.from({ length }, (_, i) => prev[i] ?? ""),
    );
    refs.current.length = length;
  }, [length]);

  const commit = useCallback((next: string[]) => {
    charsRef.current = next;
    setChars(next);
    const value = next.join("");
    changed.current?.(value);
    if (next.length > 0 && next.every((c) => c !== ""))
      completed.current?.(value);
  }, []);

  const focusAt = useCallback(
    (index: number) => {
      const el = refs.current[Math.max(0, Math.min(length - 1, index))];
      if (!el) return;
      el.focus();
      el.select();
    },
    [length],
  );

  const fillFrom = useCallback(
    (index: number, text: string) => {
      const incoming = keep(text);
      if (incoming.length === 0) return;
      const next = [...charsRef.current];
      let cursor = index;
      for (const c of incoming) {
        if (cursor >= length) break;
        next[cursor] = c;
        cursor += 1;
      }
      commit(next);
      focusAt(cursor);
    },
    [commit, focusAt, keep, length],
  );

  const clear = useCallback(() => {
    commit(Array.from({ length }, () => ""));
    focusAt(0);
  }, [commit, focusAt, length]);

  const getCellProps = useCallback(
    (index: number): OtpCellProps => ({
      ref: (el) => {
        refs.current[index] = el;
      },
      value: chars[index] ?? "",
      disabled,
      type: "text",
      inputMode: mode === "numeric" ? "numeric" : "text",
      autoComplete: index === 0 ? "one-time-code" : "off",
      autoCorrect: "off",
      autoCapitalize: "off",
      spellCheck: false,
      onChange: (e) => {
        const previous = charsRef.current[index] ?? "";
        const raw = e.currentTarget.value;
        const trimmed =
          raw.length > 1 && previous && raw.startsWith(previous)
            ? raw.slice(previous.length)
            : raw;
        const incoming = keep(trimmed);

        if (incoming.length === 0) {
          if (raw.length === 0 && previous) {
            const next = [...charsRef.current];
            next[index] = "";
            commit(next);
          }
          e.currentTarget.value = charsRef.current[index] ?? "";
          return;
        }

        if (incoming.length === 1) {
          const next = [...charsRef.current];
          next[index] = incoming;
          e.currentTarget.value = incoming;
          commit(next);
          if (index < length - 1) focusAt(index + 1);
          return;
        }

        fillFrom(index, incoming);
      },
      onKeyDown: (e) => {
        if (e.key === "Backspace") {
          e.preventDefault();
          const current = charsRef.current;
          const next = [...current];
          if (current[index]) {
            next[index] = "";
            commit(next);
            return;
          }
          if (index > 0) {
            next[index - 1] = "";
            commit(next);
            focusAt(index - 1);
          }
          return;
        }
        if (e.key === "Delete") {
          e.preventDefault();
          const next = [...charsRef.current];
          next[index] = "";
          commit(next);
          return;
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          focusAt(index - 1);
          return;
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          focusAt(index + 1);
          return;
        }
        if (e.key === "Home") {
          e.preventDefault();
          focusAt(0);
          return;
        }
        if (e.key === "End") {
          e.preventDefault();
          focusAt(length - 1);
        }
      },
      onPaste: (e) => {
        e.preventDefault();
        const text = keep(e.clipboardData.getData("text"));
        fillFrom(text.length >= length ? 0 : index, text);
      },
      onFocus: (e) => {
        e.currentTarget.select();
        const firstEmpty = charsRef.current.findIndex((c) => c === "");
        if (firstEmpty !== -1 && firstEmpty < index) {
          focusAt(firstEmpty);
          return;
        }
        setFocusedIndex(index);
      },
      onBlur: (e) => {
        const to = e.relatedTarget as HTMLInputElement | null;
        if (to && refs.current.includes(to)) return;
        setFocusedIndex(-1);
      },
    }),
    [chars, commit, disabled, fillFrom, focusAt, keep, length, mode],
  );

  const value = chars.join("");

  return {
    chars,
    value,
    length,
    complete: chars.length > 0 && chars.every((c) => c !== ""),
    focusedIndex,
    getCellProps,
    focusAt,
    clear,
  };
}
