"use client";

import { useState, type ReactNode } from "react";
import { AssetDisc } from "@/features/markets/hero/asset-mark";
import { cn } from "@/lib/utils";
import { FUNDING } from "./copy";
import { depositAmount, withdrawUnits } from "./cc-panel";
import { useCcRail } from "./useCcRail";

const C = FUNDING.cc;

/**
 * The Canton Coin path (C7b) as one compact card: the coin's mark, its state and the fixed rate in the header; the test
 * coin tap; deposit and take-back as a field with its button on one line. The rules (step, bounds, what can leave, the
 * venue's reserve) are all still said, behind one disclosure, instead of five paragraphs up front (Abu, 8 Oct). The
 * honest-state rule holds: not live shows the one-line reason and offers nothing. The panel draws; `cc-panel.ts` decides.
 */
export function CcRailPanel() {
  const cc = useCcRail();
  const { panel } = cc;
  const [amount, setAmount] = useState("");
  const [credits, setCredits] = useState("");
  const listing = cc.view?.listing ?? null;
  const dep = listing ? depositAmount(amount, listing.unitsPerCoin) : null;
  const out = listing ? withdrawUnits(credits, panel, listing.unitsPerCoin) : null;
  const live = panel.tone === "ready" || panel.tone === "closed";
  return (
    <section className="flex flex-col gap-3 rounded-ow-card bg-ow-recessed/60 p-4" aria-label={C.title} data-capability={panel.tone === "not-live" ? "not-live" : "live"}>
      <header className="flex items-center gap-3">
        <AssetDisc asset="CC" className="ow-disc-24" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-ow-body font-bold">{C.title}</span>
          {panel.rate ? <span className="ow-axis text-ow-micro text-ow-muted">{panel.rate}</span> : null}
        </span>
        <span className={cn("rounded-full px-2 py-0.5 text-ow-micro font-bold", live ? "bg-ow-up-line/15 text-ow-up" : "bg-ow-hairline text-ow-muted")}>{panel.badge}</span>
      </header>

      {/* Only a state that changes what you can do gets a line of its own (closed, not listed, not live). */}
      {panel.tone !== "ready" ? <p className="text-ow-caption text-ow-muted">{panel.headline}</p> : null}
      {cc.readError && <p className="text-ow-caption text-ow-down" role="alert">{cc.readError}</p>}

      {panel.receiveCoin && (
        <button type="button" className={ROW_BUTTON} disabled={cc.busy} onClick={() => void cc.receive()}>
          {cc.busy ? C.sending : C.receiveCta(panel.receiveCoin)}
        </button>
      )}
      {panel.tapCoin && (
        <button type="button" className={ROW_BUTTON} disabled={cc.busy} onClick={() => void cc.tap()} title={C.tapNote}>
          {cc.busy ? C.sending : C.tapCta(panel.tapCoin)}
        </button>
      )}
      {panel.canDeposit && (
        <InlineForm
          id="cc-deposit"
          label={C.depositLabel}
          value={amount}
          onChange={setAmount}
          disabled={!dep || cc.busy}
          cta={cc.busy ? C.sending : C.depositCta(dep?.amount ?? "")}
          onSubmit={() => dep && void cc.deposit(dep.amount)}
          note={dep?.changed ? C.step(panel.step ?? "") : null}
        />
      )}
      {panel.canWithdraw && (
        <InlineForm
          id="cc-withdraw"
          label={C.withdrawLabel}
          value={credits}
          onChange={setCredits}
          disabled={!out || cc.busy}
          cta={cc.busy ? C.sending : out ? C.withdrawCta(credits.trim(), out.coin) : C.withdrawCta("", "…")}
          onSubmit={() => out && void cc.withdraw(out.units)}
          note={null}
        />
      )}

      {cc.notice && (
        <p className={cn("text-ow-caption", cc.notice.tone === "ok" ? "text-ow-up" : "text-ow-down")} role="status">
          {cc.notice.text}
        </p>
      )}

      {panel.lines.length > 0 ? (
        <details className="group text-ow-caption text-ow-muted">
          <summary className="cursor-pointer list-none font-semibold text-ow-ink marker:hidden [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-1">
              {C.rules}
              <span aria-hidden className="transition-transform group-open:rotate-90">›</span>
            </span>
          </summary>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-4">
            {panel.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

const ROW_BUTTON = "h-11 w-full rounded-full bg-ow-card text-ow-label font-bold text-ow-ink ring-1 ring-ow-hairline transition-colors hover:bg-ow-hairline disabled:opacity-50";

/** A labelled amount field and its button on one line. */
function InlineForm({ id, label, value, onChange, disabled, cta, onSubmit, note }: { id: string; label: string; value: string; onChange: (v: string) => void; disabled: boolean; cta: ReactNode; onSubmit: () => void; note: string | null }) {
  return (
    <form
      className="flex flex-col gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <label htmlFor={id} className="text-ow-micro font-semibold text-ow-muted">
        {label}
      </label>
      <div className="flex h-11 items-center gap-1 rounded-full bg-ow-card pr-1 pl-4 ring-1 ring-ow-hairline focus-within:ring-2 focus-within:ring-ow-pink-ink">
        <input id={id} className="ow-num min-w-0 flex-1 bg-transparent text-ow-body outline-none focus:outline-none" inputMode="decimal" autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} placeholder="0.0" />
        <button type="submit" disabled={disabled} className="h-9 shrink-0 rounded-full bg-ow-ink px-4 text-ow-label font-bold text-ow-inverse transition-opacity disabled:opacity-35">
          {cta}
        </button>
      </div>
      {note ? <p className="text-ow-micro text-ow-muted">{note}</p> : null}
    </form>
  );
}
