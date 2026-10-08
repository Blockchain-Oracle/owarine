"use client";

import { Popover } from "@base-ui/react/popover";
import { Check } from "lucide-react";
import { setMode, type TradeMode } from "@/features/terminal/mode";
import { cn } from "@/lib/utils";
import { useWalletSession } from "@/lib/wallet-session";
import { useShellMode } from "./money";

const MODES: readonly { mode: TradeMode; label: string; line: string }[] = [
  { mode: "demo", label: "Demo", line: "Paper credits on the live market." },
  { mode: "live", label: "Live", line: "Your seat on Canton." },
];

/**
 * Which world you are trading in, as one chip: pink LIVE, sky DEMO (roy-chain's mode pill, in Owarine's colours). It
 * opens the two choices; Live with no seat yet asks for one.
 */
export function ModeChip({ className, side = "right" }: { className?: string; side?: "right" | "bottom" }) {
  const mode = useShellMode();
  const session = useWalletSession();
  const choose = (next: TradeMode) => {
    setMode(next);
    if (next === "live" && !session.address) session.connect();
  };
  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={`Mode: ${mode === "live" ? "Live" : "Demo"}. Change mode`}
        className={cn(
          "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-ow-micro font-black tracking-[0.08em] outline-none focus-visible:ring-2 focus-visible:ring-ow-white/80",
          mode === "live" ? "bg-ow-pink text-ow-on-pink" : "bg-ow-sky text-ow-black",
          className,
        )}
      >
        <span aria-hidden className={cn("size-1.5 rounded-full", mode === "live" ? "bg-ow-white motion-safe:animate-pulse" : "bg-ow-black/70")} />
        {mode === "live" ? "LIVE" : "DEMO"}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side={side} align="start" sideOffset={12} className="z-50">
          <Popover.Popup className="w-64 origin-[var(--transform-origin)] rounded-ow-card bg-ow-card p-1.5 text-ow-ink ring-1 ring-ow-hairline transition-[scale,opacity] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            <Popover.Title className="sr-only">Trading mode</Popover.Title>
            {MODES.map((m) => (
              <Popover.Close
                key={m.mode}
                onClick={() => choose(m.mode)}
                className="flex w-full items-center gap-3 rounded-[0.75rem] px-3 py-2.5 text-left outline-none hover:bg-ow-recessed focus-visible:bg-ow-recessed"
              >
                <span aria-hidden className={cn("size-2.5 shrink-0 rounded-full", m.mode === "live" ? "bg-ow-pink" : "bg-ow-sky")} />
                <span className="min-w-0 flex-1">
                  <span className="block text-ow-label font-bold">{m.label}</span>
                  <span className="block text-ow-caption text-ow-muted">{m.line}</span>
                </span>
                {m.mode === mode ? <Check aria-label="Current" className="size-4 shrink-0" strokeWidth={2.5} /> : null}
              </Popover.Close>
            ))}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
