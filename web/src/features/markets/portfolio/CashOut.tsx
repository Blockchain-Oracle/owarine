"use client";

import type { WritePhase } from "@owarine/core/ports";
import { formatBaseUnits } from "@owarine/core/units";
import type { HeldExit } from "@owarine/markets";
import { HeldPriceRow, TICKET_CANTON, useHeldSeconds, WriteProgress } from "@/features/canton-ux/ticket";
import { CASH_OUT, useCashOut, type CashOutTarget } from "./useCashOut";
import "./cash-out.css";

export interface CashOutState {
  busy: boolean;
  note: string | null;
  /** The write in flight or just finished (C7a): its steps and, while held, the firm price with its ring. */
  phase?: WritePhase | null;
  held?: HeldExit | null;
  updateId?: string | null;
}

/** The held buy-back's own words beside the ring: what it pays and for how many. */
function heldCopy(held: HeldExit, money: (base: bigint) => string, decimals: number): string {
  const size = formatBaseUnits(held.exit.contractsRaw, decimals, { maxDp: 2 });
  return CASH_OUT.held(money(held.exit.minProceedsBase), size);
}

/**
 * The cash-out's write (C7a, ticket direction B's pattern): the firm buy-back on its own row with the 20 s ring, and the
 * four write steps under it while it lands. Rendered under the row, full width, only while there is a write to show.
 */
export function CashOutWrite({ phase, held, updateId, money, decimals, remainingSec }: {
  phase: WritePhase;
  held: HeldExit | null;
  updateId: string | null;
  money: (base: bigint) => string;
  decimals: number;
  remainingSec: number | null;
}) {
  const priceCents = held ? held.exit.avgPriceBps / 100 : 0;
  return (
    <div className="co-write" data-phase={phase}>
      {held && phase !== "confirmed" && <HeldPriceRow priceCents={priceCents} remainingSec={remainingSec} aside={<span className="co-held-note">{heldCopy(held, money, decimals)}</span>} />}
      <WriteProgress phase={phase} variant="inline" words={{ ...TICKET_CANTON.sale, step: TICKET_CANTON.step }} {...(updateId ? { updateId } : {})} />
    </div>
  );
}

/** `LeverageBetRow`'s cash-out link (`type-caption text-accent underline`), "Sell half" beside it, the refusal as a sentence. */
export function CashOutLinkView({ busy, note, onCashOut, onSellHalf }: CashOutState & { onCashOut: () => void; onSellHalf?: () => void }) {
  return (
    <>
      <button type="button" className="type-caption text-accent underline" disabled={busy} onClick={onCashOut} data-cursor="hover">
        {busy ? CASH_OUT.cashingOut : CASH_OUT.cashOut}
      </button>
      {onSellHalf && !busy && (
        <button type="button" className="type-caption text-ink-secondary underline" onClick={onSellHalf} data-cursor="hover">
          {CASH_OUT.sellHalf}
        </button>
      )}
      {note && (
        <span className="type-caption basis-full text-left text-warning sm:text-right" role="status">
          {note}
        </span>
      )}
    </>
  );
}

/** The live control: shown only where a seat can sign the sale. */
export function CashOutLink(target: CashOutTarget & { canHalve?: boolean }) {
  const c = useCashOut(target);
  const remaining = useHeldSeconds(c.held?.validUntilMs ?? null);
  if (!c.canSign) return null;
  return (
    <>
      <CashOutLinkView busy={c.busy} note={c.note} onCashOut={() => void c.cashOut("all")} {...(target.canHalve !== false ? { onSellHalf: () => void c.cashOut("half") } : {})} />
      {c.phase && c.phase !== "composing" && (
        <div className="basis-full">
          <CashOutWrite phase={c.phase} held={c.held} updateId={c.updateId} money={c.money} decimals={target.decimals} remainingSec={remaining} />
        </div>
      )}
    </>
  );
}
