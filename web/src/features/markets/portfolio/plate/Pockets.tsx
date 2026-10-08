"use client";

import { formatBaseUnits } from "@owarine/core/units";
import { LockKeyhole, Vault, X as XLogo, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { PillButton, PrivacyMask, Sheet } from "@/components/kit";
import { PLATE } from "./copy";
import type { Money, PoolId } from "./useMoney";

interface Pocket {
  id: PoolId | "vault";
  label: string;
  note: string;
  amountBase: bigint | null;
  blockedReason: string | null;
  action: string;
  icon: LucideIcon;
  panel: ReactNode;
}

const ICON: Record<Pocket["id"], LucideIcon> = { vault: Vault, private: LockKeyhole, x: XLogo };

/**
 * Where else your money sits, as three equal tiles (8 Oct redesign): the Trading Balance, Private and X replies, each
 * with its amount, one line on what it is for, and one Manage button. Its controls (deposit, withdraw, link X) open
 * in a wide sheet instead of being folded into a narrow column, where Deposit / Withdraw ran off the edge.
 */
export function Pockets({ money, symbol, panels }: { money: Money; symbol: string; panels: Record<Pocket["id"], ReactNode> }) {
  const [open, setOpen] = useState<Pocket["id"] | null>(null);
  // The last pocket opened stays in the sheet while it animates closed, so its title and body never blank out.
  const [shown, setShown] = useState<Pocket["id"] | null>(null);
  const pockets: Pocket[] = [
    { id: "vault", label: PLATE.vault.label, note: PLATE.vault.note, amountBase: money.accountBase, blockedReason: null, action: PLATE.manage, icon: ICON.vault, panel: panels.vault },
    ...[...money.pools]
      .sort((a, b) => (a.id === "private" ? -1 : b.id === "private" ? 1 : 0))
      .map((pool) => ({ id: pool.id, label: pool.label, note: pool.note, amountBase: pool.amountBase, blockedReason: pool.blockedReason, action: pool.action?.label ?? PLATE.manage, icon: ICON[pool.id], panel: panels[pool.id] })),
  ];
  const current = pockets.find((p) => p.id === shown) ?? null;

  return (
    <section className="flex flex-col gap-3" aria-labelledby="pockets-title">
      <h2 id="pockets-title" className="ow-display ow-display-sm">
        {PLATE.pocketsTitle}
      </h2>
      <div className="grid gap-3 md:grid-cols-3">
        {pockets.map((pocket) => (
          <article key={pocket.id} className="flex flex-col gap-3 rounded-ow-card bg-ow-recessed/60 p-5">
            <header className="flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ow-card">
                <pocket.icon aria-hidden className="size-4.5" />
              </span>
              <h3 className="min-w-0 flex-1 truncate text-ow-lead font-bold">{pocket.label}</h3>
            </header>
            <p className="flex items-baseline gap-1.5">
              <PrivacyMask size="md">
                <span className="ow-num text-ow-key leading-none font-bold">{pocket.amountBase === null ? "—" : formatBaseUnits(pocket.amountBase, money.decimals, { maxDp: 2, minDp: 2 })}</span>
              </PrivacyMask>
              <span className="text-ow-label text-ow-muted">{symbol}</span>
            </p>
            <p className="line-clamp-2 flex-1 text-ow-label text-ow-muted">{pocket.blockedReason ?? pocket.note}</p>
            <PillButton tone="black" size="sm" className="self-start" onClick={() => (setShown(pocket.id), setOpen(pocket.id))}>
              {pocket.action}
            </PillButton>
          </article>
        ))}
      </div>
      <Sheet open={open !== null} onOpenChange={(o) => !o && setOpen(null)} title={current?.label ?? PLATE.pocketsTitle} size="lg">
        {current?.panel}
      </Sheet>
    </section>
  );
}
