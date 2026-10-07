"use client";

import { useState } from "react";
import { FUNDING } from "./copy";
import { depositAmount, withdrawUnits } from "./cc-panel";
import { useCcRail } from "./useCcRail";

const C = FUNDING.cc;

/**
 * The Canton Coin path under the demo credits (C7b). The honest-state rule: while the capability is not-live the card says
 * "Not live", says why in one sentence and offers nothing, and no figure appears; once live it states the listing's fixed
 * rate, the exact step, what the seat can take back and the venue's reserve, and offers a deposit and a take-back form whose
 * amounts the view model has already made exact. The panel draws; `cc-panel.ts` decides.
 */
export function CcRailPanel() {
  const cc = useCcRail();
  const { panel } = cc;
  const [amount, setAmount] = useState("");
  const [credits, setCredits] = useState("");
  const listing = cc.view?.listing ?? null;
  const dep = listing ? depositAmount(amount, listing.unitsPerCoin) : null;
  const out = listing ? withdrawUnits(credits, panel, listing.unitsPerCoin) : null;
  return (
    <section className={`fund-cc fund-cc--${panel.tone}`} aria-label={C.title} data-capability={panel.tone === "not-live" ? "not-live" : "live"}>
      <div className="fund-cc-head">
        <span className="fund-cc-title">{C.title}</span>
        <span className="fund-cc-badge">{panel.badge}</span>
      </div>
      <p className="fund-cc-headline">{panel.headline}</p>
      {panel.lines.map((line) => (
        <p key={line} className="fund-cc-line">
          {line}
        </p>
      ))}
      {cc.readError && <p className="fund-msg fund-msg--err" role="alert">{cc.readError}</p>}
      {panel.receiveCoin && (
        <div className="fund-cc-form">
          <button type="button" className="fund-row" disabled={cc.busy} onClick={() => void cc.receive()} data-cursor="hover">
            {cc.busy ? C.sending : C.receiveCta(panel.receiveCoin)}
          </button>
        </div>
      )}
      {panel.tapCoin && (
        <div className="fund-cc-form">
          <button type="button" className="fund-row" disabled={cc.busy} onClick={() => void cc.tap()} data-cursor="hover">
            {cc.busy ? C.sending : C.tapCta(panel.tapCoin)}
          </button>
          <p className="fund-cc-line">{C.tapNote}</p>
        </div>
      )}
      {panel.canDeposit && (
        <form
          className="fund-cc-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (dep) void cc.deposit(dep.amount);
          }}
        >
          <label className="fund-cc-label" htmlFor="cc-deposit">{C.depositLabel}</label>
          <input id="cc-deposit" className="fund-cc-input" inputMode="decimal" autoComplete="off" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.0" />
          <button type="submit" className="fund-row" disabled={!dep || cc.busy} data-cursor="hover">
            {cc.busy ? C.sending : dep ? C.depositCta(dep.amount) : C.depositCta("…")}
          </button>
          {dep?.changed && <p className="fund-cc-line">{C.step(panel.step ?? "")}</p>}
        </form>
      )}
      {panel.canWithdraw && (
        <form
          className="fund-cc-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (out) void cc.withdraw(out.units);
          }}
        >
          <label className="fund-cc-label" htmlFor="cc-withdraw">{C.withdrawLabel}</label>
          <input id="cc-withdraw" className="fund-cc-input" inputMode="decimal" autoComplete="off" value={credits} onChange={(e) => setCredits(e.target.value)} placeholder="0.0" />
          <button type="submit" className="fund-row" disabled={!out || cc.busy} data-cursor="hover">
            {cc.busy ? C.sending : out ? C.withdrawCta(credits.trim(), out.coin) : C.withdrawCta("…", "…")}
          </button>
        </form>
      )}
      {cc.notice && (
        <p className={cc.notice.tone === "ok" ? "fund-msg fund-msg--ok" : "fund-msg fund-msg--err"} role="status">
          {cc.notice.text}
        </p>
      )}
    </section>
  );
}
