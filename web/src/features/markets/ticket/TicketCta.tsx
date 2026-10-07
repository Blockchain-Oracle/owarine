"use client";

import type { BlockerContext, BlockerKind } from "@owarine/core/copy";
import type { Side } from "@owarine/core/types";
import { Money } from "@/components/data";
import { BlockedButton } from "@/components/states";
import { TICKET } from "@/lib/copy";
import { SIDE_WORD } from "../side-styles";
import { ON_FILL_UNIT } from "./on-fill";

interface TicketCtaProps {
  blocker: BlockerKind | null;
  ctx: BlockerContext;
  side: Side | null;
  /** The escrow the order locks — the most the bet can cost. */
  costBase: bigint | null;
  decimals: number;
  symbol: string;
  onClick: () => void;
  /** The side words: UP/DOWN, or Yes/No on a committee event (C6e). */
  words?: Readonly<Record<Side, string>>;
}

/** The 52px CTA: armed it carries the side wash and the exact max cost; blocked, its label is the blocker (UX-DR4). */
export function TicketCta({ blocker, ctx, side, costBase, decimals, symbol, onClick, words = SIDE_WORD }: TicketCtaProps) {
  return (
    <BlockedButton blocker={blocker} ctx={ctx} tone={side ?? "primary"} size="lg" className="w-full" onClick={onClick}>
      {side && costBase !== null ? (
        <>
          {TICKET.buy(words[side])} <Money value={costBase} decimals={decimals} symbol={symbol} className={ON_FILL_UNIT} />
        </>
      ) : (
        TICKET.buyPlain
      )}
    </BlockedButton>
  );
}
