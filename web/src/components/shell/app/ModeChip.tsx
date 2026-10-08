"use client";

import { useTradeMode } from "@/features/terminal/mode";
import { cn } from "@/lib/utils";

const WORDS = {
  demo: { label: "DEMO", line: "Guest demo: paper credits on live prices. Take a seat to trade on Canton DevNet." },
  live: { label: "DEVNET", line: "Canton DevNet: test funds, not real money." },
} as const;

/**
 * Which account you are in, as a label in the environment's own pill colour (roy-chain's mode pill). Not a picker
 * (Abu, 8 Oct): the connection decides — no seat is the guest demo, a seat trades DevNet test funds.
 */
export function ModeChip({ className }: { className?: string }) {
  const words = WORDS[useTradeMode()];
  return (
    <span
      title={words.line}
      aria-label={words.line}
      className={cn("inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-ow-mode-pill px-2.5 text-ow-micro font-black tracking-[0.08em] text-ow-mode-pill-ink transition-colors duration-(--dur-flood)", className)}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current opacity-80" />
      {words.label}
    </span>
  );
}
