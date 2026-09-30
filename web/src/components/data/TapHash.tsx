"use client";

import { shortHex } from "@agari/core/units";
import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import "./tap-hash.css";

const COPIED_MS = 1_500;

interface TapHashProps {
  value: string;
  lead?: number;
  tail?: number;
  /** What the id is, for the accessible name: "Party id", "Update id". */
  label: string;
  className?: string;
  /** Fixtures and tests: start with the whole id showing. */
  defaultOpen?: boolean;
}

/**
 * The reference's `Hash` for a value a phone has to be able to read. `Hash` holds the whole id in a `title`, which a
 * touch screen never shows, so a party or an update id was cut short for good there. This one is the same short form
 * and dotted underline; a tap (or Enter) shows the whole id where it stands and a small Copy button beside it, and a
 * second tap folds it back. A mouse still gets the `title` on hover. Copy's confirmation reuses the seat link's
 * Copy-then-check icon and 1.5 s hold, and is announced.
 */
export function TapHash({ value, lead, tail, label, className, defaultOpen = false }: TapHashProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);
  const short = shortHex(value, lead, tail);
  // Nothing was cut: there is nothing to reveal, so it is text.
  const whole = short === value;

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  if (whole) return <span className={cn("numbers", className)}>{value}</span>;

  return (
    <span className={cn("taphash", className)} data-open={open ? "" : undefined}>
      <button type="button" className="taphash-toggle numbers" aria-expanded={open} aria-label={open ? `${label} ${value}. Hide the whole id.` : `${label} ${short}. Show the whole id.`} title={open ? undefined : value} onClick={() => setOpen((was) => !was)}>
        {open ? value : short}
      </button>
      {open && (
        <button
          type="button"
          className="taphash-copy"
          aria-label={copied ? "Copied" : `Copy ${label.toLowerCase()}`}
          onClick={() => void navigator.clipboard?.writeText(value).then(() => setCopied(true), () => undefined)}
        >
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
        </button>
      )}
      <span className="sr-only" aria-live="polite">
        {copied ? "Copied to the clipboard" : ""}
      </span>
    </span>
  );
}
