"use client";

import type { Address } from "@owarine/core/types";
import type { useFaucet } from "@/features/markets/faucet/useFaucet";
import { useFundingProgress } from "./useFundingProgress";

export function FundingProgress({ address, faucet }: { address: Address; faucet: ReturnType<typeof useFaucet> }) {
  const p = useFundingProgress(address, faucet);
  return <div className="fund-progress" aria-live="polite">
    <dl className="fund-balances">
      <div><dt>network fee</dt><dd>{p.solText}</dd></div>
      <div><dt>credits for trading</dt><dd>{p.tokenText}</dd></div>
    </dl>
    <p className="fund-foot-line">{p.policy}</p>
    <p className="fund-foot-line">{p.gasLine}</p>
    {p.mintNote && <p className="fund-foot-line">{p.mintNote}</p>}
    {p.busyLabel && <p className="fund-msg">{p.busyLabel}</p>}
    {p.error && <p className="fund-msg fund-msg--err" role="alert">{p.error}</p>}
    {p.solLink && <a className="fund-foot-link" href={p.solLink.href} target="_blank" rel="noreferrer">{p.solLink.label}</a>}
    {p.solNext && <p className="fund-foot-line">{p.solNext}</p>}
    {p.mintLink && <a className="fund-foot-link" href={p.mintLink.href} target="_blank" rel="noreferrer">{p.mintLink.label}</a>}
    {p.mintNext && <p className="fund-foot-line">{p.mintNext}</p>}
  </div>;
}
