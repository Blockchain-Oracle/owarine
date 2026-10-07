"use client";

import { parseStrategyMetadata } from "@owarine/core/strategies";
import { txUrl } from "@owarine/core/urls";
import { webEnv } from "@/lib/env";
import { AgentPortrait } from "./AgentPortrait";
import { STRATEGIES } from "./copy";
import { money } from "./format";
import { strategyIdentity, STRATEGY_MARKETS } from "./identity";
import { COPY_STATE_LABEL } from "./lifecycle";
import type { StrategiesPayload } from "./protocol";
import { RecordCard } from "./RecordCard";
import { StrategyActivity } from "./StrategyActivity";
import type { CreatorFeesModel } from "./useCreatorFees";
import type { DeskModel } from "./useDesk";
import "./desk.css";

const F = STRATEGIES.creatorFees;

/**
 * The selected strategy, its actual consent state, and the runner's latest own report. `fees` is the creator's own
 * view (C8i): present only when the seat published the strategy.
 */
export function LiveDesk({ payload, desk, nowMs, onManage, fees = null }: { payload: StrategiesPayload; desk: DeskModel; nowMs: number; onManage: () => void; fees?: CreatorFeesModel | null }) {
  const card = desk.featured;
  if (!card) return null;
  const { name, seed } = strategyIdentity(card);
  const { decimals, symbol } = payload;
  const health = desk.health?.ok && !desk.health.stale && desk.health.value.reachable ? desk.health.value.strategies[card.strategyId] ?? null : null;
  const spec = parseStrategyMetadata(card.metadata)?.spec;
  return (
    <section className="live-desk mt-6 mb-6" aria-label="Selected strategy">
      <div className="desk"><div className="desk-body">
        <div className="flex items-start gap-4">
          <AgentPortrait seed={seed} name={name} />
          <div><h2 className="desk-name text-ink">{name}</h2><p className="desk-what text-ink/70">{spec?.preset === "agent" ? "AI judgment with enforced limits" : spec?.preset === "reversion" ? "Opening-price reversion rule" : "Opening-price momentum rule"} · {STRATEGY_MARKETS}</p></div>
        </div>
        <div className="mt-6"><RecordCard record={card.record} decimals={decimals} symbol={symbol} /></div>
        <div className="desk-pulse mt-5">
          <p className="desk-status text-signal">{COPY_STATE_LABEL[desk.state]}</p>
          <StrategyActivity state={desk.state} grant={desk.grant} health={health} nowMs={nowMs} />
        </div>
        {desk.grant && <div className="desk-numbers mt-5">
          <div><p className="desk-eyebrow">Remaining budget</p><p className="desk-figure">{money(desk.ledgerBase, decimals, symbol)}</p></div>
          <div><p className="desk-eyebrow">Your trade limit</p><p className="desk-limits">{money(desk.grant.caps.maxStakePerTradeBase, decimals, symbol)}</p><p className="desk-fine">{desk.grant.openPositions}/{desk.grant.caps.maxOpenPositions} open positions</p></div>
        </div>}
        {fees && <CreatorFees fees={fees} decimals={decimals} symbol={symbol} />}
        <button type="button" onClick={onManage} className="desk-btn-primary mt-5">{desk.subscriptionOf(card.strategyId) ? "Manage this copy" : "Review and copy"} →</button>
        <p className="desk-note mt-3 text-ink-muted">Copying enabled means permission is in place. Each trade still needs a market signal, fresh risk checks, and a confirmed receipt.</p>
      </div></div>
    </section>
  );
}

/** The creator's fees on its own strategy's desk, in the desk's numbers row: what waits, and one claim into the seat. */
function CreatorFees({ fees, decimals, symbol }: { fees: CreatorFeesModel; decimals: number; symbol: string }) {
  const waiting = fees.waitingBase ?? 0n;
  const last = fees.last;
  return (
    <div className="desk-numbers mt-5" role="group" aria-label={F.eyebrow}>
      <div>
        <p className="desk-eyebrow">{F.eyebrow}</p>
        <p className="desk-figure">{fees.waitingBase === null ? "—" : F.waiting(money(waiting, decimals, symbol))}</p>
        <p className="desk-fine">{!fees.readable ? F.unreadable : waiting > 0n ? F.count(fees.feeCount) : F.none}</p>
      </div>
      <div>
        <p className="desk-fine">{F.note}</p>
        <button type="button" className="desk-link-btn" disabled={!fees.readable || waiting === 0n || fees.claiming} onClick={() => void fees.claim()}>
          {fees.claiming ? F.claiming : `${F.claim} →`}
        </button>
        {last && (last.ok ? (
          <p className="desk-fine mt-2" role="status">
            {F.claimed(money(last.amountBase, decimals, symbol))}{" "}
            {last.txHash && <a className="text-signal" href={txUrl(last.txHash, webEnv.markets.cluster)} target="_blank" rel="noopener noreferrer">{F.receipt}</a>}
          </p>
        ) : (
          <p className="desk-fine mt-2 text-signal" role="alert">{F.failed(last.reason)}</p>
        ))}
      </div>
    </div>
  );
}
