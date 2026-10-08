"use client";

import Link from "next/link";
import { Seal } from "@/components/kit";
import { cn } from "@/lib/utils";
import { HeaderAccount } from "../header/HeaderAccount";
import { BalanceChip } from "./BalanceChip";
import { CommandPalette } from "./CommandPalette";
import { HealthChip } from "./HealthChip";
import { ModeChip } from "./ModeChip";

/**
 * The slim line above the stage (roy-chain's `top-line.tsx`): the network's health and search. Static, no ticker. On
 * phones, where the rail is gone, it also carries the seal, the mode, the money and the seat; while the rail shows only
 * icons it carries the money too.
 */
export function TopBar({ className }: { className?: string }) {
  return (
    <header className={cn("flex h-(--topbar-h) shrink-0 items-center gap-2", className)}>
      <Link href="/" aria-label="Owarine home" className="grid size-10 shrink-0 place-items-center rounded-full bg-ow-pink md:hidden">
        <Seal size={26} tone="white" />
      </Link>
      <ModeChip className="md:hidden" />
      <HealthChip className="max-md:hidden" />
      <div className="ml-auto flex min-w-0 items-center gap-2">
        <CommandPalette className="max-md:hidden" />
        <div className="xl:hidden">
          <BalanceChip variant="bar" />
        </div>
        <div className="md:hidden">
          <HeaderAccount variant="avatar" />
        </div>
      </div>
    </header>
  );
}
