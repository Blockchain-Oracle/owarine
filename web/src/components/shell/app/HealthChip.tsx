"use client";

import { networkLabel } from "@owarine/markets/chain";
import Link from "next/link";
import { useStatus } from "@/features/status/useStatus";
import { cn } from "@/lib/utils";

const TONE = { healthy: "bg-ow-up-line", degraded: "bg-ow-breakeven", unreachable: "bg-ow-down-line", unread: "bg-ow-helper" } as const;
const WORD = { healthy: "All systems live", degraded: "Running degraded", unreachable: "Venue unreachable", unread: "Checking…" } as const;

/**
 * The network and its health as one dot and a word (roy-chain's data-health chip): the same verdict `/status` shows,
 * polled every 30 s while the tab is visible, and a link to the full page.
 */
export function HealthChip({ className }: { className?: string }) {
  const status = useStatus();
  const overall = status && status.ok ? status.value.overall : "unread";
  return (
    <Link
      href="/status"
      title={`${WORD[overall]} — open status`}
      className={cn("flex h-10 items-center gap-2 rounded-full px-3 text-ow-label text-ow-muted outline-none transition-colors hover:bg-ow-recessed hover:text-ow-ink focus-visible:ring-2 focus-visible:ring-ow-pink-ink", className)}
    >
      <span aria-hidden className={cn("size-2.5 shrink-0 rounded-full", TONE[overall])} />
      <span suppressHydrationWarning className="font-semibold text-ow-ink">
        {networkLabel()}
      </span>
      <span className="max-lg:sr-only">· {WORD[overall]}</span>
    </Link>
  );
}
