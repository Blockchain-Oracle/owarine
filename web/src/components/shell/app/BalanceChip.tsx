"use client";

import { Plus } from "lucide-react";
import { usePathname } from "next/navigation";
import { PrivacyMask, PrivacyToggle } from "@/components/kit";
import { TUsdcMark } from "@/components/icons/AssetMarks";
import { OPEN_FUNDS_EVENT } from "@/features/funding";
import { cn } from "@/lib/utils";
import { isTradeRoute } from "../nav";
import { useShellBalance } from "./money";

const openFunds = () => window.dispatchEvent(new Event(OPEN_FUNDS_EVENT));

/**
 * The shell's money, in two shapes: a tile at the foot of the full rail (on black) and a pill in the top bar (on the
 * canvas, wherever the rail is icons only or gone). Behind the privacy eye; the pink + adds money in Live.
 */
export function BalanceChip({ variant }: { variant: "rail" | "bar" }) {
  const balance = useShellBalance();
  const trade = isTradeRoute(usePathname());
  const rail = variant === "rail";

  // The trading screen carries its own equity pill (cash plus open PnL); a second, different figure would only confuse.
  if (trade) return null;
  // No seat in Live: the seat control beside this says "Take a seat"; a second button would only repeat it.
  if (balance.kind === "seatless") return null;

  const demo = balance.kind === "demo";
  const amount = (
    <span className={cn("ow-num font-bold", rail ? "text-ow-title" : "text-ow-label", balance.text === null && "opacity-55")}>{balance.text ?? "—"}</span>
  );
  const unit = demo ? "credits" : balance.symbol;
  const label = demo ? "Demo balance" : "Balance";

  if (rail) {
    return (
      <div className="flex flex-col gap-1 rounded-[1.25rem] bg-ow-white/8 p-3.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-ow-caption font-medium text-ow-white/60">{label}</span>
          <PrivacyToggle className="size-7 bg-ow-white/10 text-ow-white hover:bg-ow-white/20 [&_svg]:size-3.5" />
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <PrivacyMask size="sm" className="min-w-0 flex-1 text-ow-white">
            <span className="flex min-w-0 flex-1 items-baseline gap-1.5 truncate">
              {amount}
              <span className="text-ow-caption text-ow-white/60">{unit}</span>
            </span>
          </PrivacyMask>
          {demo ? null : (
            <button type="button" onClick={openFunds} aria-label="Add money" className="grid size-8 shrink-0 place-items-center rounded-full bg-ow-pink text-ow-on-pink outline-none focus-visible:ring-2 focus-visible:ring-ow-white">
              <Plus className="size-4" strokeWidth={3} />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-ow-card pr-1 pl-3 ring-1 ring-ow-hairline">
      {demo ? null : <TUsdcMark className="size-4 shrink-0" />}
      <PrivacyMask size="sm">
        <span className="flex items-baseline gap-1">
          {amount}
          <span className="text-ow-micro text-ow-muted max-sm:hidden">{unit}</span>
        </span>
      </PrivacyMask>
      <PrivacyToggle className="size-8 bg-transparent [&_svg]:size-4" />
      {demo ? null : (
        <button type="button" onClick={openFunds} aria-label="Add money" className="grid size-8 shrink-0 place-items-center rounded-full bg-ow-pink text-ow-on-pink outline-none focus-visible:ring-2 focus-visible:ring-ow-pink-ink">
          <Plus className="size-4" strokeWidth={3} />
        </button>
      )}
    </div>
  );
}
