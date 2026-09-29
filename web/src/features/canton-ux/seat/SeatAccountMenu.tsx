"use client";

import { shortHex } from "@agari/core/units";
import { Check, Copy } from "lucide-react";
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
  seatNumber: number;
  /** The seat key's address (base58, shown exactly as written, D-010). */
  address: string;
  /** The leased party the ledger knows this seat as. */
  party: string;
  state: "leased" | "draining";
  /** When the idle lease runs out; ticks locally. */
  leaseExpirySec: number | null;
  leaseSpanSec: number;
  cashText: string;
  /** Fixtures only: open on first paint. */
  defaultOpen?: boolean;
  onLink: () => void;
  onReset: () => void;
}

/** A party id keeps its readable hint and the fingerprint's first four characters. */
const partyLead = (party: string) => party.indexOf("::") + 6;

/**
 * The connected account (L-02): the reference's address pill and `addr-dot` avatar opening the reference's
 * `header-account-menu`, extended for a guest seat with the seat, its party id (`Hash`, with copy), the lease time left
 * (the reference `Countdown`), and "Reset seat" where the wallet's Disconnect was. Draining, the lease row gives way to
 * a desk-kit `StatusDot` and the one sentence that says nothing is lost.
 */
export function SeatAccountMenu({ seatNumber, address, party, state, leaseExpirySec, leaseSpanSec, cashText, defaultOpen = false, onLink, onReset }: SeatMenuProps) {
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
  return (
    <div className="relative cx-seat-anchor" ref={menuRef}>
      <button type="button" className="wallet-pill" aria-label={M.open} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="addr-dot" />
        <span title={address}>{shortHex(address, 4, 4)}</span>
      </button>
      {open && (
        <div className="header-account-menu cx-seat-menu" role="menu" aria-label={M.seat(seatNumber)}>
          <div className="header-account-pools cx-seat-head">
            <div className="cx-seat-title">
              <span className="cx-seat-name">{M.seat(seatNumber)}</span>
              <StatusDot tone={draining ? "warn" : "live"}>{draining ? M.draining : M.leased}</StatusDot>
            </div>
            <div className="header-account-row">
              <span>{M.party}</span>
              <span className="cx-seat-party">
                <Hash value={party} lead={partyLead(party)} tail={4} className="val" />
                <button
                  type="button"
                  className="cx-seat-copy"
                  aria-label={copied ? M.copied : M.copyParty}
                  onClick={() => void navigator.clipboard?.writeText(party).then(() => setCopied(true), () => undefined)}
                >
                  {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
                </button>
              </span>
            </div>
            {!draining && leaseExpirySec !== null && (
              <div className="header-account-row">
                <span>{M.lease}</span>
                <Countdown expirySec={leaseExpirySec} intervalSec={leaseSpanSec} className="val" />
              </div>
            )}
            <div className="header-account-row">
              <span>{M.tradingAccount}</span>
              <span className="val">{cashText}</span>
            </div>
            <p className="cx-seat-note">{draining ? M.drainingNote : M.leaseNote}</p>
          </div>
          <Link href="/portfolio" className="header-account-link" role="menuitem">
            {M.portfolio}
          </Link>
          {!draining && (
            <button type="button" className="header-account-link cx-seat-item" role="menuitem" onClick={onLink}>
              {M.link}
            </button>
          )}
          <button type="button" className="header-account-link header-account-link--danger" role="menuitem" onClick={onReset}>
            {M.reset}
          </button>
        </div>
      )}
    </div>
  );
}
