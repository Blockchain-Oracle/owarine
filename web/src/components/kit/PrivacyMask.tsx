"use client";

import { Eye, EyeOff } from "lucide-react";
import type { ReactNode } from "react";
import { togglePrivacy, usePrivacy } from "@/lib/privacy";
import { cn } from "@/lib/utils";
import { FluentArt } from "./SkyCollage";

/**
 * Wrap any money figure. With privacy mode on, the figure is replaced by the chosen sticker and a row of dots sized to
 * the text — the layout does not jump, and the real value is not in the DOM for a screenshot to catch.
 */
export function PrivacyMask({ children, size = "md", className }: { children: ReactNode; size?: "sm" | "md" | "lg"; className?: string }) {
  const { on, sticker } = usePrivacy();
  if (!on) return <>{children}</>;
  const art = size === "lg" ? 56 : size === "md" ? 30 : 18;
  return (
    <span data-slot="privacy-mask" className={cn("inline-flex items-center gap-1.5 align-middle", className)} aria-label="Hidden in privacy mode">
      <FluentArt name={sticker} size={art} className="-rotate-6" />
      <span aria-hidden className={cn("ow-num font-bold tracking-[0.12em]", size === "lg" ? "text-ow-mask" : size === "md" ? "text-ow-sticker" : "text-ow-label")}>
        ••••
      </span>
    </span>
  );
}

/** The eye that flips privacy mode, placed beside a balance. */
export function PrivacyToggle({ className }: { className?: string }) {
  const { on } = usePrivacy();
  return (
    <button
      type="button"
      onClick={togglePrivacy}
      aria-pressed={on}
      aria-label={on ? "Show balances" : "Hide balances"}
      className={cn("grid size-9 place-items-center rounded-full bg-ow-recessed text-ow-ink transition-colors hover:bg-ow-hairline", className)}
    >
      {on ? <EyeOff className="size-4.5" strokeWidth={2.25} /> : <Eye className="size-4.5" strokeWidth={2.25} />}
    </button>
  );
}
