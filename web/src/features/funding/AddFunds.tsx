"use client";

import { partyLead } from "@owarine/core/units";
import { ArrowRight, Check, Copy } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { TapHash } from "@/components/data";
import { PillButton, PrivacyMask, Sheet } from "@/components/kit";
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
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/**
 * Add funds, as one short sheet (Abu, 8 Oct: "too much slop text, not supposed to be this long"): the seat's test credits
 * as one big figure tagged "no cash value", one button (the grant, or Trade once funded), a one-line status only when
 * something needs doing, then Canton Coin as a compact card, and the seat and its party in a quiet foot.
 */
export function AddFunds({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { address } = useWalletSession();
  const credit = useSeatCredit();
  const [copied, setCopied] = useState(false);
  // The geofence (D-095): the sheet still shows the credits; only the grant is held.
  const regionHeld = useRegionRestricted();
  const funded = credit.status === "funded";

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title={F.title}>
      {!address ? (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <p className="text-ow-body text-ow-muted">{F.takeSeatFirst}</p>
          <ConnectButton />
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <section className="flex flex-col items-center gap-2 pt-1 text-center" aria-label={F.credits}>
            <span className="text-ow-label font-medium text-ow-muted">{F.credits}</span>
            <PrivacyMask size="lg">
              <span className="ow-num text-ow-figure leading-none font-bold">{credit.balanceText ?? "—"}</span>
            </PrivacyMask>
            <span className="rounded-full bg-ow-recessed px-3 py-1 text-ow-micro font-semibold text-ow-muted">{F.tag}</span>
          </section>

          <div className="flex flex-col gap-2">
            {funded ? (
              <PillButton tone="black" size="lg" block nativeButton={false} render={<Link href="/trade/BTC" onClick={onClose} />}>
                {F.trade} <ArrowRight aria-hidden />
              </PillButton>
            ) : (
              <PillButton tone="pink" size="lg" block onClick={() => void credit.request()} disabled={regionHeld || credit.busy} aria-busy={credit.busy}>
                {regionHeld ? blockerLabel("region") : credit.busy ? F.requesting : credit.status === "unleased" ? F.lease : F.request}
              </PillButton>
            )}
            {regionHeld && <RegionNote />}
            {!funded && !credit.busy ? (
              <p className="text-center text-ow-caption text-ow-muted" role="status">
                {credit.status === "unleased" ? F.unleased : F.unfunded}
              </p>
            ) : null}
            {credit.refusal && <p className="text-center text-ow-caption text-ow-down">{diagnosisCopy(credit.refusal.kind).headline}</p>}
          </div>

          <CcRailPanel />

          <footer className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-ow-hairline pt-4 text-ow-caption text-ow-muted">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 hover:bg-ow-recessed hover:text-ow-ink"
              aria-label="Copy seat address"
              onClick={() => {
                void navigator.clipboard.writeText(address);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {F.account} <span className="ow-axis text-ow-ink">{short(address)}</span>
              {copied ? <Check aria-hidden className="size-3.5" /> : <Copy aria-hidden className="size-3.5" />}
            </button>
            {credit.party ? (
              <span className="inline-flex items-center gap-1.5">
                {F.party} <TapHash value={credit.party} lead={partyLead(credit.party)} tail={4} label={ID_LABEL.party} />
              </span>
            ) : null}
          </footer>
        </div>
      )}
    </Sheet>
  );
}
