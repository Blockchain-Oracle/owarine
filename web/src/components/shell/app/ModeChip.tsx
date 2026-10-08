"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useTradeMode, type TradeMode } from "@/features/terminal/mode";
import { cn } from "@/lib/utils";
import { useWalletSession } from "@/lib/wallet-session";

/**
 * Which account you are in. Not a picker (Abu, 8 Oct): the connection decides — no seat is the guest demo on paper
 * credits, a seat trades Canton DevNet test funds. Each world has a hanko like Owarine's own 終値 seal: 練 (practice) for
 * the demo, 試 (trial) for DevNet.
 */
const WORDS = {
  demo: { label: "DEMO", kanji: "練", title: "Guest demo", line: "Paper credits", hint: "Guest demo: paper credits on live prices. Take a seat to trade on Canton DevNet." },
  live: { label: "DEVNET", kanji: "試", title: "Canton DevNet", line: "Test funds", hint: "Canton DevNet: test funds, not real money. Open the network's status." },
} as const satisfies Record<TradeMode, unknown>;

/** The hanko: the world's kanji stamped in a rounded square, pressed again whenever the world changes. */
function Stamp({ mode, className }: { mode: TradeMode; className?: string }) {
  return (
    <span
      key={mode}
      aria-hidden
      className={cn("ow-seal-stamp ow-jp grid size-9 shrink-0 -rotate-6 place-items-center rounded-[0.7rem] border-2 border-current text-[1.15rem] leading-none", className)}
    >
      {WORDS[mode].kanji}
    </span>
  );
}

/** The demo's pass asks for a seat; DevNet's opens the network's status. */
function Pass({ mode, className, children }: { mode: TradeMode; className: string; children: ReactNode }) {
  const session = useWalletSession();
  const words = WORDS[mode];
  if (mode === "demo") {
    return (
      <button type="button" onClick={session.connect} title={words.hint} aria-label={`${words.hint}`} className={className}>
        {children}
      </button>
    );
  }
  return (
    <Link href="/status" title={words.hint} aria-label={words.hint} className={className}>
      {children}
    </Link>
  );
}

/**
 * The full rail's network pass: a ticket in the world's pill colour — the stamp on a stub, a perforation, the world's
 * name and what its money is, and a live dot on DevNet. The notches are cut in the rail's own colour, so the pass reads
 * as torn from the rail whatever world it is in.
 */
export function NetworkPlate({ className }: { className?: string }) {
  const mode = useTradeMode();
  const words = WORDS[mode];
  return (
    <Pass
      mode={mode}
      className={cn(
        "group relative flex items-center rounded-[1.25rem] bg-ow-mode-pill py-2.5 pr-3 text-left text-ow-mode-pill-ink outline-none transition-colors duration-(--dur-flood) focus-visible:ring-2 focus-visible:ring-ow-rail-ink/70",
        className,
      )}
    >
      <span className="grid w-14 shrink-0 place-items-center">
        <Stamp mode={mode} />
      </span>
      {/* the perforation, with a notch top and bottom */}
      <span aria-hidden className="relative w-0.5 self-stretch">
        <span className="absolute inset-0 border-l-2 border-dashed border-current opacity-35" />
        <span className="absolute -top-4 -left-[0.3125rem] size-3 rounded-full bg-ow-rail transition-colors duration-(--dur-flood)" />
        <span className="absolute -bottom-4 -left-[0.3125rem] size-3 rounded-full bg-ow-rail transition-colors duration-(--dur-flood)" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 pl-3">
        <span className="ow-display truncate text-ow-title">{words.label}</span>
        <span className="flex items-center gap-1.5 truncate text-ow-micro font-semibold opacity-80">
          {mode === "live" ? (
            <span aria-hidden className="relative grid size-2 place-items-center">
              <span className="absolute inset-0 rounded-full bg-current opacity-40 motion-safe:animate-ping" />
              <span className="relative size-1.5 rounded-full bg-current" />
            </span>
          ) : null}
          {words.line}
        </span>
      </span>
      <ArrowUpRight aria-hidden className="size-4 shrink-0 opacity-50 transition-[opacity,translate] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" strokeWidth={2.5} />
    </Pass>
  );
}

/** The icon rail's pass: the stamp alone, on the pill colour. */
export function NetworkStamp({ className }: { className?: string }) {
  const mode = useTradeMode();
  return (
    <Pass
      mode={mode}
      className={cn(
        "grid size-12 place-items-center rounded-[1rem] bg-ow-mode-pill text-ow-mode-pill-ink outline-none transition-colors duration-(--dur-flood) focus-visible:ring-2 focus-visible:ring-ow-rail-ink/70",
        className,
      )}
    >
      <Stamp mode={mode} className="size-8 text-base" />
    </Pass>
  );
}

/** The phone's top bar: the world as a chip beside the seal. */
export function ModeChip({ className }: { className?: string }) {
  const words = WORDS[useTradeMode()];
  return (
    <span
      title={words.hint}
      aria-label={words.hint}
      className={cn("inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-ow-mode-pill px-2.5 text-ow-micro font-black tracking-[0.08em] text-ow-mode-pill-ink transition-colors duration-(--dur-flood)", className)}
    >
      <span aria-hidden className="ow-jp text-[0.8rem] leading-none">
        {words.kanji}
      </span>
      {words.label}
    </span>
  );
}
