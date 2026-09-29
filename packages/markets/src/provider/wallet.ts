/**
 * A seat's money (plan §5): its venue cash, its open legs and what it can claim, read live from the ledger AS the
 * seat's leased party through `/api/ledger/me/*` (per-party active contracts, 1–2 s server cache invalidated on the
 * seat's own writes). History, fills and lists stay on the projection (`/api/index`). The server answers for the seat
 * its cookie or signed header names; an answer for any other address than the one asked about is refused here as
 * `signer-required`, never shown.
 */
import type { Reading } from "@agari/core/schemas";
import { diagnosis, type Address, type BalanceSheet, type ClaimableRow, type OpenPosition } from "@agari/core/types";
import { z } from "zod";
import { COLLATERAL_SYMBOL } from "../collateral";
import { ReadingError } from "../errors/reading-error";
import { ledgerRequest } from "./ledger-api";
import { balanceWire, claimableWire, meReplyWire, openQuoteWire, positionWire, type OpenQuote } from "./ledger-wire";
import { withReading } from "./reading";

async function me<W extends z.ZodType>(wallet: Address, path: string, row: W): Promise<z.output<W>> {
  const r = await ledgerRequest(`/me/${path}`, { method: "GET", wire: meReplyWire });
  if (!r.ok) throw new ReadingError(r.diagnosis);
  if (r.value.address !== wallet) throw new ReadingError(diagnosis("signer-required", `the seat on this browser is ${r.value.address}, not ${wallet}`));
  const rows = row.safeParse(r.value.value);
  if (!rows.success) throw new ReadingError(diagnosis("unknown", `/me/${path} answered an unexpected shape: ${rows.error.message.slice(0, 200)}`));
  return rows.data as z.output<W>;
}

export function listOpenPositions(wallet: Address): Promise<Reading<OpenPosition[]>> {
  return withReading(`positions:${wallet}`, () => me(wallet, "positions", z.array(positionWire)));
}

/** Legs with an exit now: a resolved Window's claim, or a stale refund after `refundAfter`. The venue id is kept for the port's shape. */
export function listClaimables(wallet: Address, _venueId: Address): Promise<Reading<ClaimableRow[]>> {
  return withReading(`claimables:${wallet}`, () => me(wallet, "claimables", z.array(claimableWire)));
}

/**
 * Every pool of money labelled separately (FR-5). `nativeLamports` keeps its field and is always 0: a Canton seat pays
 * no network fee and holds no fee token. The Trading Balance is `null` until its package is live (C7a).
 */
export function getBalanceSheet(wallet: Address): Promise<Reading<BalanceSheet>> {
  return withReading(`balances:${wallet}`, () => me(wallet, "balance", balanceWire));
}

/** The seat's open quotes (issued, not yet accepted or expired): what the ticket's held price is. */
export function listOpenQuotes(wallet: Address): Promise<Reading<OpenQuote[]>> {
  return withReading(`quotes:${wallet}`, () => me(wallet, "quotes", z.array(openQuoteWire)));
}

/** A seat's venue cash in the collateral's own terms. */
export function getWalletCollateral(wallet: Address): Promise<Reading<{ amountBase: bigint; decimals: number; symbol: string }>> {
  return withReading(`wallet-collateral:${wallet}`, async () => {
    const sheet = await me(wallet, "balance", balanceWire);
    return { amountBase: sheet.spendableBase, decimals: sheet.decimals, symbol: COLLATERAL_SYMBOL };
  });
}
