import type { Address } from "@agari/core/types";

/**
 * The games' sponsor — server only. Nothing here may be imported by a component.
 *
 * On Solana a sponsor paid the duel's pick fees by sending SOL to the seat's agent key. Canton has neither: the seat
 * pays no network fee (the venue submits every ledger write the duel makes), and there is no agent key to fund. So
 * there is nothing for a games sponsor to do, and this answers that plainly for `/status`, which still asks: not
 * configured, with nothing to hold. The wire keeps the reference's field names (`*Wei`), all empty.
 */
export interface GameSponsorStatusWire {
  configured: boolean;
  sponsor: Address | null;
  balanceWei: string | null;
  capWei: string;
  /** What the sponsor must hold, per match at the widest deck, to call itself ready. */
  deckEnvelopeWei: string;
  ready: boolean;
}

export async function gameSponsorStatus(): Promise<GameSponsorStatusWire> {
  return { configured: false, sponsor: null, balanceWei: null, capWei: "0", deckEnvelopeWei: "0", ready: false };
}
