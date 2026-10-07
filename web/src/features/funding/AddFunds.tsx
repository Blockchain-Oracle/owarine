"use client";

import { partyLead } from "@owarine/core/units";
import { X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { TapHash } from "@/components/data";
import { ID_LABEL } from "@/features/canton-ux/id-label";
import { ConnectButton } from "@/features/markets/wallet";
import { RegionNote } from "@/features/region/RegionNote";
import { blockerLabel, diagnosisCopy } from "@/lib/copy";
import { useRegionRestricted } from "@/lib/region";
import { useWalletSession } from "@/lib/wallet-session";
import { CcRailPanel } from "./CcRailPanel";
import { FUNDING } from "./copy";
import "./funding.css";
import { useSeatCredit } from "./useSeatCredit";

const F = FUNDING.seat;
const short = (a: string) => `${a.slice(0, 8)}…${a.slice(-6)}`;

/**
 * The reference's Add funds dialog, for a seat on Canton (plan §4): the glowing eyebrow, "Demo credits" and what they
 * are, the seat row that copies, the seat's party and its credits (no cash value), and the grant pill. The grant is the
 * seat funding the lease asks for, so the pill leases (or re-leases) the seat; the server funds a leased seat once.
 */
export function AddFunds({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { address } = useWalletSession();
  const credit = useSeatCredit();
  const [copied, setCopied] = useState(false);
  // The geofence (D-095): the dialog still explains the credits; only the grant is held.
  const regionHeld = useRegionRestricted();

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, onClose]);

  if (!open) return null;
  const funded = credit.status === "funded";

  return (
    <div className="fund-modal-root">
      <button type="button" className="fund-modal-scrim" aria-label={FUNDING.modal.close} tabIndex={-1} onClick={onClose} />
      <div className="fund-modal" role="dialog" aria-modal="true" aria-labelledby="add-funds-title">
        <button type="button" onClick={onClose} aria-label={FUNDING.modal.close} className="fund-modal-close" data-cursor="hover">
          <X className="h-4 w-4" />
        </button>

        <div className="fund-eyebrow-row">
          <span className="fund-eyebrow-dot" />
          <span className="fund-eyebrow">{F.eyebrow}</span>
        </div>
        <h2 id="add-funds-title" className="fund-title">
          {F.title}
        </h2>
        <p className="fund-body">{F.body}</p>

        {!address ? (
          <div className="fund-connect-first">
            <p>{F.takeSeatFirst}</p>
            <ConnectButton />
          </div>
        ) : (
          <>
            <div className="fund-account">
              <span className="fund-account-label">{F.account}</span>
              <button
                type="button"
                className="fund-account-addr"
                aria-label="Copy seat address"
                onClick={() => {
                  void navigator.clipboard.writeText(address);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                data-cursor="hover"
              >
                {copied ? FUNDING.modal.copied : `${short(address)} ⧉`}
              </button>
            </div>
            <dl className="fund-facts">
              {credit.party && (
                <div>
                  <dt>{F.party}</dt>
                  <dd>
                    <TapHash value={credit.party} lead={partyLead(credit.party)} tail={4} label={ID_LABEL.party} />
                  </dd>
                </div>
              )}
              <div>
                <dt>{F.credits}</dt>
                <dd>{credit.balanceText ?? "—"}</dd>
              </div>
              <div>
                <dt>{F.cashValue}</dt>
                <dd>{F.none}</dd>
              </div>
            </dl>

            {funded ? (
              <Link href="/markets" onClick={onClose} className="fund-cta-vermilion" data-cursor="hover">
                {F.trade}
              </Link>
            ) : (
              <div className="fund-rows">
                <button type="button" onClick={() => void credit.request()} disabled={regionHeld || credit.busy} aria-busy={credit.busy} className="fund-cta-white" data-cursor="hover">
                  {regionHeld ? blockerLabel("region") : credit.busy ? F.requesting : credit.status === "unleased" ? F.lease : F.request}
                </button>
                {regionHeld && <RegionNote />}
              </div>
            )}

            <p className={funded ? "fund-msg fund-msg--ok" : "fund-msg"} role="status">
              {funded ? F.funded : credit.status === "unleased" ? F.unleased : F.unfunded}
            </p>
            {credit.refusal && <p className="fund-msg fund-msg--err">{diagnosisCopy(credit.refusal.kind).headline}</p>}
            <CcRailPanel />
          </>
        )}
      </div>
    </div>
  );
}
