"use client";

import { partyLead, shortHex } from "@owarine/core/units";
import { Check, Copy, UserRound } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { Countdown } from "@/components/data/Countdown";
import { Hash } from "@/components/data/Hash";
import { useFloatingMenus } from "@/components/shell/header/useFloatingMenus";
import { StatusDot } from "@/components/ui/desk-kit";
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
 * The connected account (L-02): the reference's address pill and `addr-dot` avatar opening the reference's
 * `header-account-menu`, extended for a guest seat with the seat, its party id (`Hash`, with copy), the lease time left
 * (the reference `Countdown`), and "Reset seat" where the wallet's Disconnect was. Draining, the lease row gives way to
 * a desk-kit `StatusDot` and the one sentence that says nothing is lost.
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
  const menuRef = useRef<HTMLDivElement>(null);
  const refs = useRef<ReadonlyArray<RefObject<HTMLElement | null>>>([menuRef]);
  const close = useCallback(() => setOpen(false), []);
  useFloatingMenus(refs.current, close);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const draining = state === "draining";
  const unleased = state === "unleased";
  return (
    <div className="relative cx-seat-anchor" ref={menuRef}>
      <button
        type="button"
        className={variant === "rail" ? "cx-seat-rail" : variant === "avatar" ? "cx-seat-rail cx-seat-rail--avatar" : "wallet-pill"}
        aria-label={M.open}
        aria-haspopup="menu"
        aria-expanded={open}
        title={variant === "pill" ? undefined : `${M.seat(seatNumber)} · ${address}`}
        onClick={() => {
          setOpen((v) => !v);
          onOpenMenu?.();
        }}
      >
        {variant !== "pill" ? (
          <>
            <span className="cx-seat-rail-avatar" aria-hidden>
              {seatNumber ?? <UserRound className="size-4.5" strokeWidth={2.5} />}
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
      </button>
      {open && (
        <div className={`header-account-menu cx-seat-menu${variant === "rail" ? " cx-seat-menu--above" : ""}`} role="menu" aria-label={M.seat(seatNumber)}>
          <div className="header-account-pools cx-seat-head">
            <div className="cx-seat-title">
              <span className="cx-seat-name">{M.seat(seatNumber)}</span>
              <StatusDot tone={draining || unleased ? "warn" : "live"}>{draining ? M.draining : unleased ? M.unleased : M.leased}</StatusDot>
            </div>
            {party !== null && (
              <div className="header-account-row">
                <span>{M.party}</span>
                <span className="cx-seat-party">
                  <Hash value={party} lead={partyLead(party)} tail={4} className="val" />
                  <button
                    type="button"
                    className="cx-seat-copy"
                    aria-label={copied ? M.copied : M.copyParty}
                    onClick={() =>
                      void navigator.clipboard?.writeText(party).then(
                        () => setCopied(true),
                        () => undefined,
                      )
                    }
                  >
                    {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
                  </button>
                </span>
              </div>
            )}
            {state === "leased" && leaseExpirySec !== null && (
              <div className="header-account-row">
                <span>{M.leaseLeft}</span>
                <Countdown expirySec={leaseExpirySec} intervalSec={leaseSpanSec} className="val" />
              </div>
            )}
            <div className="header-account-row">
              <span>{M.tradingAccount}</span>
              <span className="val">{cashText}</span>
            </div>
            <p className="cx-seat-note">{draining ? M.drainingNote : unleased ? (unleasedReason ?? M.unleasedNote) : M.leaseNote}</p>
          </div>
          {unleased && onLease && (
            <button type="button" className="header-account-link cx-seat-item" role="menuitem" disabled={leasing} aria-busy={leasing} onClick={onLease}>
              {leasing ? M.leasing : M.lease}
            </button>
          )}
          <Link href="/portfolio" className="header-account-link" role="menuitem" onClick={close}>
            {M.portfolio}
          </Link>
          {state === "leased" && onLink && (
            <button type="button" className="header-account-link cx-seat-item" role="menuitem" onClick={onLink}>
              {M.link}
            </button>
          )}
          <button
            type="button"
            className="header-account-link header-account-link--danger"
            role="menuitem"
            onClick={() => {
              close();
              onReset();
            }}
          >
            {M.reset}
          </button>
        </div>
      )}
    </div>
  );
}
