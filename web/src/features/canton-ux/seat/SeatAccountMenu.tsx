"use client";

import { Popover } from "@base-ui/react/popover";
import { partyLead, shortHex } from "@owarine/core/units";
import { Check, Copy, KeyRound, Smartphone, UserRound, WalletCards } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Countdown } from "@/components/data/Countdown";
import { Hash } from "@/components/data/Hash";
import { cn } from "@/lib/utils";
import { SEAT } from "./copy";
import "./seat.css";

const M = SEAT.menu;
const COPIED_MS = 1_500;

export interface SeatMenuProps {
  /** From the party hint (`seat-3::…`); null when it carries no number. */
  seatNumber: number | null;
  /** The seat key's address (base58, shown exactly as written, D-010). */
  address: string;
  /** The leased party the ledger knows this seat as; null while the seat holds no lease. */
  party: string | null;
  /** `unleased`: a key with no party (a lapsed lease, a refused one); the menu offers to lease one. */
  state: "leased" | "draining" | "unleased";
  /** When the idle lease runs out; ticks locally. */
  leaseExpirySec: number | null;
  leaseSpanSec: number;
  cashText: string;
  /** Fixtures only: open on first paint. */
  defaultOpen?: boolean;
  /** "Use on another device"; the item is left out when there is no link flow. */
  onLink?: () => void;
  onReset: () => void;
  /** Unleased only: ask for a party again (an explicit click, as the lease rule requires). */
  onLease?: () => void;
  leasing?: boolean;
  /** Why the last lease did not land, in words (unleased only). */
  unleasedReason?: string | null;
  onOpenMenu?: () => void;
  /**
   * `rail`: the shell rail's row (the seat-number avatar, the seat, the address); the menu opens upward over the rail.
   * `avatar`: the avatar alone, for the phone's top bar.
   */
  variant?: "pill" | "rail" | "avatar";
}

/**
 * The connected seat (L-02), as one popover: the seat and its state, its Canton party (with copy), the lease time left,
 * its DevNet test funds, then Portfolio, "Use on another device" and Reset seat. Portalled, so it opens beside the rail
 * (or under the phone's avatar) instead of being clipped inside it (Abu, 8 Oct). Draining and unleased seats say so in
 * one line and offer what fixes them.
 */
export function SeatAccountMenu({
  seatNumber,
  address,
  party,
  state,
  leaseExpirySec,
  leaseSpanSec,
  cashText,
  defaultOpen = false,
  onLink,
  onReset,
  onLease,
  leasing = false,
  unleasedReason,
  onOpenMenu,
  variant = "pill",
}: SeatMenuProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const draining = state === "draining";
  const unleased = state === "unleased";
  const avatar = <span className="cx-seat-rail-avatar">{seatNumber ?? <UserRound className="size-4.5" strokeWidth={2.5} />}</span>;
  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) onOpenMenu?.();
      }}
    >
      <Popover.Trigger
        data-flood-origin
        aria-label={M.open}
        title={variant === "pill" ? undefined : `${M.seat(seatNumber)} · ${address}`}
        className={variant === "rail" ? "cx-seat-rail" : variant === "avatar" ? "cx-seat-rail cx-seat-rail--avatar" : "wallet-pill"}
      >
        {variant !== "pill" ? (
          <>
            <span aria-hidden className="contents">
              {avatar}
            </span>
            <span className="cx-seat-rail-copy">
              <span className="cx-seat-rail-name">{M.seat(seatNumber)}</span>
              <span className="cx-seat-rail-addr">{shortHex(address, 4, 4)}</span>
            </span>
          </>
        ) : (
          <>
            <span className="addr-dot" />
            <span title={address}>{shortHex(address, 4, 4)}</span>
          </>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side={variant === "rail" ? "right" : "bottom"} align="end" sideOffset={variant === "rail" ? 28 : 10} collisionPadding={12} className="z-[9300]">
          <Popover.Popup className="w-[min(21rem,calc(100vw-1.5rem))] origin-[var(--transform-origin)] rounded-[1.5rem] bg-ow-card p-2 text-ow-ink ring-1 ring-ow-hairline transition-[scale,opacity] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            <div className="flex items-center gap-3 px-3 pt-2 pb-3">
              <span aria-hidden>{avatar}</span>
              <Popover.Title className="min-w-0 flex-1 truncate text-ow-lead font-bold">{M.seat(seatNumber)}</Popover.Title>
              <span className={cn("inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-ow-micro font-bold", draining || unleased ? "bg-ow-breakeven/15 text-ow-ink" : "bg-ow-up-line/15 text-ow-up")}>
                <span aria-hidden className={cn("size-1.5 rounded-full", draining || unleased ? "bg-ow-breakeven" : "bg-ow-up-line")} />
                {draining ? M.draining : unleased ? M.unleased : M.leased}
              </span>
            </div>
            <dl className="flex flex-col gap-2 rounded-ow-card bg-ow-recessed/60 px-3 py-3 text-ow-label">
              {party !== null && (
                <Row label={M.party}>
                  <span className="flex min-w-0 items-center gap-1">
                    <Hash value={party} lead={partyLead(party)} tail={4} className="ow-axis truncate" />
                    <button
                      type="button"
                      className="grid size-6 shrink-0 place-items-center rounded-full text-ow-muted hover:bg-ow-hairline hover:text-ow-ink"
                      aria-label={copied ? M.copied : M.copyParty}
                      onClick={() =>
                        void navigator.clipboard?.writeText(party).then(
                          () => setCopied(true),
                          () => undefined,
                        )
                      }
                    >
                      {copied ? <Check aria-hidden className="size-3.5" /> : <Copy aria-hidden className="size-3.5" />}
                    </button>
                  </span>
                </Row>
              )}
              {state === "leased" && leaseExpirySec !== null && (
                <Row label={M.leaseLeft}>
                  <Countdown expirySec={leaseExpirySec} intervalSec={leaseSpanSec} className="ow-axis" />
                </Row>
              )}
              <Row label={M.tradingAccount}>
                <span className="ow-num font-bold">{cashText}</span>
              </Row>
            </dl>
            <p className="px-3 pt-2.5 pb-1 text-ow-caption text-ow-muted">{draining ? M.drainingNote : unleased ? (unleasedReason ?? M.unleasedNote) : M.leaseNote}</p>
            <div className="mt-1 flex flex-col border-t border-ow-hairline pt-1.5">
              {unleased && onLease && (
                <Item icon={<KeyRound />} onClick={onLease} disabled={leasing}>
                  {leasing ? M.leasing : M.lease}
                </Item>
              )}
              <Link href="/portfolio" onClick={close} className={ITEM}>
                <WalletCards aria-hidden className="size-4.5 text-ow-muted" />
                {M.portfolio}
              </Link>
              {state === "leased" && onLink && (
                <Item icon={<Smartphone />} onClick={() => (close(), onLink())}>
                  {M.link}
                </Item>
              )}
              <button type="button" onClick={() => (close(), onReset())} className={cn(ITEM, "text-ow-down")}>
                <span aria-hidden className="size-4.5" />
                {M.reset}
              </button>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

const ITEM = "flex h-11 w-full items-center gap-3 rounded-[0.875rem] px-3 text-left text-ow-body font-medium outline-none hover:bg-ow-recessed focus-visible:bg-ow-recessed disabled:opacity-50";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-4">
      <dt className="shrink-0 text-ow-muted">{label}</dt>
      <dd className="min-w-0 text-right">{children}</dd>
    </div>
  );
}

function Item({ icon, onClick, disabled, children }: { icon: ReactNode; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-busy={disabled} className={ITEM}>
      <span aria-hidden className="text-ow-muted [&_svg]:size-4.5">
        {icon}
      </span>
      {children}
    </button>
  );
}
