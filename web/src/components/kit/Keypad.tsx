"use client";

import { pressKey, type KeypadKey, type KeypadRules } from "@owarine/core/input";
import { Delete } from "lucide-react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

/**
 * UGLYCASH's big amount keypad: three columns of large bold digits, a point and delete, no key borders. The typed
 * string is controlled by the caller (the shared `pressKey` machine decides what each press does). The physical
 * keyboard works too while the keypad is mounted.
 */
const KEYS: readonly KeypadKey[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "del"];

export function Keypad({ value, onChange, rules, onPress, className }: { value: string; onChange: (next: string) => void; rules?: KeypadRules; onPress?: (key: KeypadKey) => void; className?: string }) {
  const press = (key: KeypadKey) => {
    onPress?.(key);
    onChange(pressKey(value, key, rules));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      const key: KeypadKey | null = /^[0-9]$/.test(e.key) ? (e.key as KeypadKey) : e.key === "." || e.key === "," ? "." : e.key === "Backspace" ? "del" : null;
      if (!key) return;
      e.preventDefault();
      onPress?.(key);
      onChange(pressKey(value, key, rules));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [value, onChange, onPress, rules]);

  return (
    <div role="group" aria-label="Amount keypad" className={cn("grid grid-cols-3 gap-1", className)}>
      {KEYS.map((key) => (
        <button
          key={key}
          type="button"
          aria-label={key === "del" ? "Delete" : key === "." ? "Decimal point" : key}
          onClick={() => press(key)}
          className="ow-num grid h-16 place-items-center rounded-2xl text-ow-key font-bold text-ow-ink transition-colors select-none active:bg-ow-recessed"
        >
          {key === "del" ? <Delete className="size-7" strokeWidth={2.25} /> : key}
        </button>
      ))}
    </div>
  );
}
