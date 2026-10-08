"use client";

import { toVerdict, type RoundReceipt, type SettledRound } from "@owarine/core/projection";
import { isOk } from "@owarine/core/schemas";
import { useMarket, useResolution } from "@owarine/markets/react";
import type { ReactNode } from "react";
import { Money } from "@/components/data";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { VerdictCard } from "../verdict";
import { HISTORY } from "./copy";
import { EarlyCloseReceipt } from "./EarlyCloseReceipt";

interface HistoryReceiptProps {
  round: SettledRound | null;
  symbol: string;
  onClose: () => void;
}

/** One figure of the ledger's receipt, in the verdict legs' row grammar. */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-hairline pb-2 type-data">
      <dt className="text-ink-secondary">{label}</dt>
      <dd className="text-ink">{children}</dd>
    </div>
  );
}

/**
 * What the ledger's `SettlementReceipt` recorded (engine 0.4.0): the product, what went in and came out, the fee the
 * venue recognised and, for a ticket, the pick, stake, the reserve and what settlement paid back into it.
 */
function LedgerReceipt({ receipt, decimals, symbol }: { receipt: RoundReceipt; decimals: number; symbol: string }) {
  const L = HISTORY.ledger;
  const d = receipt.detail;
  return (
    <section className="mt-4 flex flex-col gap-2" aria-label={L.title}>
      <p className="type-label-micro text-ink-muted">
        {L.title} · {L.product[receipt.product ?? "pair"] ?? receipt.product} · {L.receipts(receipt.receiptIds.length)}
      </p>
      <dl className="flex flex-col gap-2">
        {d && <Row label={L.pick}>{d.pick}</Row>}
        <Row label={L.cost}>
          <Money value={receipt.costBase} decimals={decimals} symbol={symbol} />
        </Row>
        <Row label={L.payout}>
          <Money value={receipt.payoutBase} decimals={decimals} symbol={symbol} />
        </Row>
        <Row label={L.fee}>
          <Money value={receipt.feeBase} decimals={decimals} symbol={symbol} />
        </Row>
        {d && (
          <>
            <Row label={L.stake}>
              <Money value={d.stakeBase} decimals={decimals} symbol={symbol} />
            </Row>
            <Row label={L.toReserve}>
              <Money value={d.toReserveBase} decimals={decimals} symbol={symbol} />
            </Row>
            <Row label={L.reserve}>
              {d.reserveId} · {L.markets(d.marketIds.length)} · {L.result[d.result] ?? d.result}
            </Row>
          </>
        )}
      </dl>
    </section>
  );
}

function ReceiptBody({ round, symbol }: { round: SettledRound; symbol: string }) {
  const market = useMarket(round.marketId);
  const resolution = useResolution(round.marketId);
  const openingPriceRaw = market && isOk(market) ? (market.value?.openingPriceRaw ?? null) : null;
  return (
    <VerdictCard
      verdict={toVerdict(round)}
      market={{ marketId: round.marketId, asset: round.asset, intervalSec: round.intervalSec, expirySec: round.expirySec, openingPriceRaw }}
      resolution={resolution && isOk(resolution) ? resolution.value : null}
      symbol={symbol}
      provenance={{ ...(round.source === "vault" ? {} : { entryTxHash: round.entryTxHash }), closedEarly: round.outcome === "closed" }}
    />
  );
}

function ReceiptSheetBody({ round, symbol }: { round: SettledRound; symbol: string }) {
  return (
    <>
      {round.question && <p className="type-body-strong text-ink mb-3">{round.question}</p>}
      {round.outcome === "closed" ? <EarlyCloseReceipt round={round} symbol={symbol} /> : <ReceiptBody round={round} symbol={symbol} />}
      {round.receipt && <LedgerReceipt receipt={round.receipt} decimals={round.decimals} symbol={symbol} />}
    </>
  );
}

/**
 * One open receipt at a time, as the reference's `TradeReceipt` modal: the sheet owns the
 * overlay, Escape and scroll-lock. The card inside is the same Verdict the live window stamps,
 * so a settled row and the moment it settled can never disagree.
 */
export function HistoryReceipt({ round, symbol, onClose }: HistoryReceiptProps) {
  return (
    <Sheet open={round !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="history-receipt-sheet">
        <SheetHeader className="sr-only">
          <SheetTitle>{round?.outcome === "closed" ? "Cash-out receipt" : HISTORY.receiptTitle}</SheetTitle>
          <SheetDescription>{round ? `${round.question ?? round.asset} · ${HISTORY.outcome[round.outcome]}` : ""}</SheetDescription>
        </SheetHeader>
        <div className="history-receipt-scroll">{round && <ReceiptSheetBody key={`${round.marketId}:${round.receipt?.receiptIds[0] ?? ""}`} round={round} symbol={symbol} />}</div>
      </SheetContent>
    </Sheet>
  );
}
