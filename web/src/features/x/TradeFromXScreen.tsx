"use client";

import { isOk } from "@owarine/core/schemas";
import { formatBaseUnits } from "@owarine/core/units";
import { useState } from "react";
import { ConnectButton } from "@/features/markets/wallet";
import { useVenue } from "@/features/markets/useVenue";
import { RegionNote } from "@/features/region/RegionNote";
import { useRegionRestricted } from "@/lib/region";
import { useWalletSession } from "@/lib/wallet-session";
import { docsUrl } from "@/lib/docs-url";
import { CapabilityReceipt } from "./CapabilityReceipt";
import { TRADE_FROM_X, X_HANDLE } from "./copy";
import { CustodyRail } from "./CustodyRail";
import { LinkStep } from "./LinkStep";
import { Dot, IdentityChip, ProofLink, Step } from "./StepSpine";
import { useXGrant } from "./useXGrant";
import { XReceiptsList } from "./XReceiptsList";
import { XRelayStatus } from "./XRelayStatus";
import { useXReceipts } from "./useXReceipts";
import { useXStatus } from "./useXStatus";
import { XPermissionPanel } from "./XPermissionPanel";
import { XInstructionBuilder } from "./XInstructionBuilder";
import "./x-card.css";

const RETURN_TO = "/trade-from-x";

/**
 * yosuku.xyz/trade-from-x — "X-trade", ported. Connect → fund + authorize →
 * link X → mention your calls. The page's whole argument is the un-drainable custody rail: the
 * agent's only power over your money is one function that opens a position YOU own and settles
 * back to you; the vault has no path that pays the agent.
 */
export function TradeFromXScreen() {
  const { address } = useWalletSession();
  const { boot } = useVenue();
  const symbol = boot && isOk(boot) ? boot.value.collateral.symbol : "credits";
  const link = useXStatus();
  const grant = useXGrant();
  const receipts = useXReceipts(address ?? null);
  const [amount, setAmount] = useState("5");
  // The geofence (D-095): a held browser reads the custody rail and its receipts; it funds and links nothing.
  const regionHeld = useRegionRestricted();

  const permission = grant.permission(link.status?.executor ?? null);
  const funded = permission === "ready";
  const linked = Boolean(link.status?.binding) && !link.needsLink && !link.walletMismatch;
  // Seat → X → fund (Abu, 8 Oct): linking needs only the seat and an X sign-in, so it is never held behind funding.
  const step = !address ? 1 : !linked ? 2 : !funded ? 3 : 4;
  const error = grant.error || link.error;

  return (
    <div className="xt xt-page">
      <div className="xt-grain" />
      <section className="xt-hero">
        <div className="xt-hero-grid">
          <div className="relative z-10">
            <div className="xt-boot xt-eyebrow" style={{ animationDelay: "0ms" }}>{TRADE_FROM_X.eyebrow}</div>
            <h1 className="xt-h1">
              <span className="xt-boot block" style={{ animationDelay: "90ms" }}>{TRADE_FROM_X.headline}</span>
              <span className="xt-payoff xt-h1-payoff">
                {TRADE_FROM_X.payoff}
                <span className="xt-ul absolute left-0 -bottom-1 h-px w-full" style={{ background: "var(--xt-v)" }} />
              </span>
            </h1>
            <p className="xt-boot xt-lede" style={{ animationDelay: "440ms" }}>
              {TRADE_FROM_X.lede(X_HANDLE)[0]}<strong>{X_HANDLE}</strong>{TRADE_FROM_X.lede(X_HANDLE)[2]}<strong>{TRADE_FROM_X.lede(X_HANDLE)[3]}</strong>{TRADE_FROM_X.lede(X_HANDLE)[4]}
            </p>
            <div className="xt-boot xt-meta" style={{ animationDelay: "560ms" }}>
              <span className="inline-flex items-center gap-1.5"><Dot /> {TRADE_FROM_X.yourKeys}</span>
              <span className="xt-meta-sep">·</span>
              <span>{TRADE_FROM_X.venue}</span>
            </div>
          </div>
          <div className="xt-boot relative z-10" style={{ animationDelay: "680ms" }}>
            <CustodyRail handle={X_HANDLE} />
          </div>
        </div>
      </section>

      <section className="xt-flow-wrap" id="x-trading">
        <div className="xt-flow-label">{TRADE_FROM_X.setup}</div>
        <ol className="xt-steps">
          <Step n="1" title={TRADE_FROM_X.steps.connect} state={step > 1 ? "done" : "active"} spine={{ from: 1, cur: step }}>
            {address ? <IdentityChip addr={address} /> : <ConnectButton />}
          </Step>
          <Step n="2" title={TRADE_FROM_X.steps.link} state={linked ? "done" : step === 2 ? "active" : "idle"} spine={{ from: 2, cur: step }}>
            <LinkStep link={link} returnTo={RETURN_TO} enabled={!regionHeld && Boolean(address)} />
          </Step>
          <Step n="3" title={TRADE_FROM_X.steps.fund} state={funded ? "done" : step === 3 ? "active" : "idle"} spine={{ from: 3, cur: step }} isLast>
            {regionHeld && <RegionNote className="xt-step-lede" />}
            {!address && <p className="xt-step-lede">Take a seat to check your X balance and permission.</p>}
            {address && (grant.grant || grant.pendingUpdate || !["ready", "unfunded"].includes(permission)) && <div className="xw">
              {grant.balanceBase !== null && <p className="xt-step-lede">X balance · <strong>{formatBaseUnits(grant.balanceBase, grant.decimals)} {symbol}</strong></p>}
              <XPermissionPanel grant={grant} executor={link.status?.executor ?? null} symbol={symbol} disabled={link.walletMismatch || Boolean(link.busy)} />
            </div>}
            {funded ? <a className="xt-receipt-link" href="/portfolio">Manage X balance in Portfolio ↗</a>
            : grant.deployed === false ? (
              <p className="xt-step-lede">{TRADE_FROM_X.receipt.notDeployed}</p>
            ) : permission === "unfunded" ? (
              <CapabilityReceipt
                amount={amount}
                setAmount={setAmount}
                disabled={regionHeld || !address || !grant.readable || Boolean(grant.busy) || link.walletMismatch}
                depositing={grant.busy === "fund"}
                firstTime={grant.grant === null}
                decimals={grant.decimals}
                symbol={symbol}
                onDeposit={(amountBase) => void grant.fund(amountBase, link.status?.executor ?? null)}
              />
            ) : null}
          </Step>

        </ol>

        {error && (
          <div className="xt-err">
            {error}
          </div>
        )}
        {(grant.ok || link.ok) && <div className="xt-ok">{grant.ok || link.ok}</div>}

        <div className={`xt-composer${step === 4 ? " xt-composer--live" : ""}`}>
          <div className="xt-composer-eyebrow">Trade from X</div>
          <XInstructionBuilder enabled={step === 4} balanceBase={grant.balanceBase} decimals={grant.decimals} symbol={symbol} />
          <XRelayStatus health={link.status?.relay} />
        </div>

        <div className="xt-trust">
          <div className="xt-meta" style={{ marginTop: 0 }}><Dot v /> {TRADE_FROM_X.noWithdraw}</div>
          <ProofLink href={docsUrl("architecture/programs")}>{TRADE_FROM_X.proofs.contract}</ProofLink>
          <ProofLink href={docsUrl("trading/tap-trading")}>{TRADE_FROM_X.proofs.caps}</ProofLink>
          <p className="xt-trust-note">{TRADE_FROM_X.testnetNote}</p>
        </div>

        {address && <XReceiptsList receipts={receipts?.receipts ?? []} configured={receipts?.configured ?? false} decimals={grant.decimals} symbol={symbol} />}
      </section>
    </div>
  );
}
