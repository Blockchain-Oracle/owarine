"use client";

import type { WritePhase } from "@agari/core/ports";
import { Money } from "@/components/data/Money";
import { BlockedButton } from "@/components/states";
import { Button } from "@/components/ui/button";
import { SIDE_WORD } from "@/features/markets/side-styles";
import { TICKET } from "@/lib/copy";
import { TICKET_CANTON } from "./copy";
import { HeldPriceRow } from "./HeldPrice";
import { QuoteRing } from "./QuoteRing";
import { TicketFrame, type FrameQuote } from "./TicketFrame";
import { useWriteDemo } from "./useWriteDemo";
import { WriteProgress } from "./WriteProgress";
import "./ticket-canton.css";

const T = TICKET_CANTON;
const UP = SIDE_WORD.up;

export type Direction = "A" | "B" | "C";

export interface FrameState {
  phase: WritePhase | null;
  quoteLeftSec: number | null;
  /** The held price ran out: the fresh price is offered in place, never taken silently. */
  expired?: { fromCents: number; toCents: number };
  updateId?: string;
}

interface DirectionProps {
  direction: Direction;
  quote: FrameQuote;
  priceCents: number;
  maxCostBase: bigint;
  state: FrameState;
  label: string;
  onPlace?: () => void;
  onDone?: () => void;
}

const WRITING: ReadonlySet<WritePhase> = new Set(["composing", "submitted", "confirming", "unknown"]);

/** The reference CTA in the state the phase implies: armed, "Placing…" while the write is open, or the fresh price. */
function Cta({ state, quote, maxCostBase, onPlace }: Pick<DirectionProps, "state" | "quote" | "maxCostBase" | "onPlace">) {
  const writing = state.phase !== null && WRITING.has(state.phase);
  return (
    <BlockedButton blocker={writing ? "placing" : null} tone="up" size="lg" className="w-full" onClick={onPlace ?? (() => undefined)}>
      {state.expired ? T.expired.cta(UP, state.expired.toCents) : TICKET.buy(UP)} <Money value={maxCostBase} decimals={quote.decimals} symbol={quote.symbol} />
    </BlockedButton>
  );
}

function ExpiredNote({ expired }: { expired: NonNullable<FrameState["expired"]> }) {
  return (
    <p className="cx-expired" role="status">
      {T.expired.title} {T.expired.fresh(expired.fromCents, expired.toCents)}
    </p>
  );
}

/** A: minimal. The ring rides on the CTA; the steps sit inline under it. */
function DirectionA(p: DirectionProps) {
  const { state } = p;
  const ring = (state.quoteLeftSec ?? 0) > 0 && state.phase !== "confirmed" && !state.expired;
  return (
    <TicketFrame
      label={p.label}
      quote={p.quote}
      cta={
        <>
          {state.expired && <ExpiredNote expired={state.expired} />}
          <div className="cx-a-cta" data-ring={ring ? "" : undefined}>
            <Cta {...p} />
            {ring && <QuoteRing remainingSec={state.quoteLeftSec ?? 0} size="sm" className="cx-a-ring" />}
          </div>
        </>
      }
      afterCta={state.phase && <WriteProgress phase={state.phase} updateId={state.updateId} variant="inline" />}
    />
  );
}

/** B: the ring stands beside the price; while the write is open the steps take the CTA's place. */
function DirectionB(p: DirectionProps) {
  const { state } = p;
  const held = (state.quoteLeftSec ?? 0) > 0 && !state.expired;
  const writing = state.phase !== null && state.phase !== "reverted";
  return (
    <TicketFrame
      label={p.label}
      quote={p.quote}
      beforeStrip={held || state.expired ? <HeldPriceRow priceCents={p.priceCents} remainingSec={state.quoteLeftSec} expired={state.expired} /> : null}
      cta={
        writing ? (
          <WriteProgress phase={state.phase!} updateId={state.updateId} variant="block" />
        ) : (
          <>
            {state.expired && <ExpiredNote expired={state.expired} />}
            {state.phase === "reverted" && <WriteProgress phase="reverted" variant="block" />}
            <Cta {...p} />
          </>
        )
      }
    />
  );
}

/** C: a compact receipt drawer rises over the ticket with the held price, the ring and the steps. */
function DirectionC(p: DirectionProps) {
  const { state, quote } = p;
  const open = state.phase !== null || state.expired !== undefined;
  const done = state.phase === "confirmed" || state.phase === "reverted" || state.expired !== undefined;
  return (
    <TicketFrame
      label={p.label}
      quote={quote}
      cta={<Cta {...p} state={state.expired ? { ...state, phase: null } : state} />}
      overlay={
        open ? (
          <div className="cx-c-drawer" role="region" aria-label={T.receipt.title}>
            <div className="cx-c-head">
              <span className="cx-c-title">{T.receipt.title}</span>
              {(state.quoteLeftSec ?? 0) > 0 && state.phase !== "confirmed" && !state.expired && <QuoteRing remainingSec={state.quoteLeftSec ?? 0} size="sm" />}
            </div>
            <dl className="cx-c-rows">
              <div>
                <dt>{T.receipt.side}</dt>
                <dd>{UP}</dd>
              </div>
              <div>
                <dt>{T.receipt.price}</dt>
                <dd>{state.expired ? T.receipt.ranOut(state.expired.fromCents, state.expired.toCents) : T.ring.price(p.priceCents)}</dd>
              </div>
              <div>
                <dt>{T.receipt.stake}</dt>
                <dd>{quote.stakeText} {quote.symbol}</dd>
              </div>
              <div>
                <dt>{T.receipt.maxLoss}</dt>
                <dd>{quote.cells.loss} {quote.symbol}</dd>
              </div>
            </dl>
            <div className="cx-c-perf" aria-hidden />
            {state.expired ? <p className="cx-c-expired">{T.expired.title}</p> : state.phase && <WriteProgress phase={state.phase} updateId={state.updateId} variant="receipt" />}
            {done && (
              <Button type="button" variant="secondary" size="sm" className="w-full" onClick={p.onDone ?? (() => undefined)}>
                {state.expired ? T.receipt.close : T.receipt.done}
              </Button>
            )}
          </div>
        ) : null
      }
    />
  );
}

const BY_DIRECTION = { A: DirectionA, B: DirectionB, C: DirectionC } as const;

/** One direction's ticket in a fixed state. */
export function DirectionTicket(props: DirectionProps) {
  const Component = BY_DIRECTION[props.direction];
  return <Component {...props} />;
}

/** One direction's ticket, live: press the CTA to play a placement against a 20 s held price. */
export function LiveDirection(props: Omit<DirectionProps, "state" | "onPlace" | "onDone"> & { updateId: string }) {
  const demo = useWriteDemo();
  return (
    <div className="cx-live">
      <DirectionTicket {...props} state={{ phase: demo.phase, quoteLeftSec: demo.quoteLeftSec, updateId: props.updateId }} onPlace={() => demo.run()} onDone={demo.reset} />
      <div className="cx-live-controls">
        <Button type="button" variant="secondary" size="xs" onClick={() => demo.run(true)}>
          {T.demo.fail}
        </Button>
        <Button type="button" variant="ghost" size="xs" onClick={demo.reset}>
          {T.demo.again}
        </Button>
      </div>
    </div>
  );
}
