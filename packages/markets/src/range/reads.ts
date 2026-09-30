/**
 * The range reserve's reads on Canton (C8c): the `range` ticket reserve (a `PM.Reserve` statement and its `RiskBook`)
 * through `/api/ledger/tickets/*`. The basis and every price come from ops pricing the Window's own ladder with core's
 * `quoteRange`, the same function that issues the firm quote, so the number a screen shows is the one it is offered.
 */
import type { RangeMode, RangeParams, RangeQuote, RangeReserveState, RangeRound } from "@agari/core/range";
import type { ProviderShares } from "@agari/core/reserves";
import { err, ok, type Reading } from "@agari/core/schemas";
import { diagnosis, type Address, type MarketId } from "@agari/core/types";
import { nowMs } from "../provider/clock";
import { registeredSeatAddress } from "../provider/ledger-api";
import { asReading, rangeCall, readReserve, readTicketsMine, ticketIdOf } from "../tickets/client";
import { rangeParams } from "../tickets/params";
import { endedRounds } from "../tickets/receipt-views";
import { rangeReserveOf, rangeRoundOf, sharesOf } from "../tickets/views";
import type { RangeCapacity } from "./moonshot";
import type { RangeBand, RangePreview, RangeWindowBasis } from "./read";

export async function getRangeReserveState(): Promise<Reading<RangeReserveState | null>> {
  const r = await readReserve("range");
  return r.ok ? ok(r.value ? rangeReserveOf(r.value) : null, r.asOfMs) : r;
}

export async function listRangesOf(wallet: Address): Promise<Reading<RangeRound[]>> {
  const mine = await readTicketsMine();
  if (!mine.ok) return mine;
  // Live rounds, then the ended ones from their receipts (newest first), so a settled round stays in history.
  return ok([...mine.value.rounds.map((r) => rangeRoundOf(r, wallet)), ...endedRounds(mine.value.receipts, wallet)], mine.asOfMs);
}

export async function getRange(roundId: bigint): Promise<Reading<RangeRound | null>> {
  const mine = await readTicketsMine();
  if (!mine.ok) return mine;
  const owner = registeredSeatAddress() ?? ("" as Address);
  const r = mine.value.rounds.find((x) => ticketIdOf(x.cid) === roundId);
  return ok(r ? rangeRoundOf(r, owner) : (endedRounds(mine.value.receipts, owner).find((x) => x.roundId === roundId) ?? null), mine.asOfMs);
}

export async function getRangeSharesOf(_wallet: Address): Promise<Reading<ProviderShares>> {
  const mine = await readTicketsMine();
  return mine.ok ? ok(sharesOf(mine.value, "range"), mine.asOfMs) : mine;
}

export async function previewRangeBasis(marketId: MarketId): Promise<Reading<RangeWindowBasis>> {
  return asReading(await rangeCall({ op: "basis", marketId }), (r) => (r.kind === "basis" ? { openingPrint: r.openingPrint, centerQE6: r.centerQE6, sigmaE8: r.sigmaE8 } : null));
}

export async function previewRangeOpen(band: RangeBand, maxPayoutBase: bigint): Promise<Reading<RangePreview>> {
  const call = await rangeCall({ op: "preview", marketId: band.marketId, side: band.side, lowE8: band.lowPrint, highE8: band.highPrint, mode: { kind: "fixPayout", maxPayoutBase } });
  return asReading(call, (r) => (r.kind === "preview" ? { stakeBase: r.quote.stakeBase, probRaw: r.quote.probRaw, openingPrint: r.openingPrint, basis: r.basis } : null));
}

/** The band priced for the ticket: ops' own `quoteRange` over the Window's basis. `params` and `tauSec` are the reserve's, read at the same instant. */
export async function quoteRangeOnchain(band: RangeBand, mode: RangeMode, _params: RangeParams, _tauSec: number): Promise<Reading<RangeQuote>> {
  const call = await rangeCall({ op: "preview", marketId: band.marketId, side: band.side, lowE8: band.lowPrint, highE8: band.highPrint, mode });
  return asReading(call, (r) => (r.kind === "preview" ? r.quote : null));
}

/**
 * Whether the reserve would take a round locking `houseLockedBase` right now: the per-ticket cap, and what the
 * reserve's book already holds (the ledger books per boundary; the whole book is the conservative bound shown here).
 */
export async function readRangeCapacity(houseLockedBase: bigint, _expirySec: number): Promise<Reading<RangeCapacity>> {
  const r = await readReserve("range");
  if (!r.ok) return r;
  if (!r.value) return err(diagnosis("not-deployed", "the range reserve is not live on this network"));
  const p = rangeParams();
  const locked = r.value.bookLockedBase;
  const exposureCap = (r.value.assetsBase * BigInt(p.maxExposureBps)) / 10_000n;
  const refusal =
    houseLockedBase > p.maxPayoutCapBase ? diagnosis("reserve-cap", `OverPayoutCap(${houseLockedBase}, ${p.maxPayoutCapBase})`, { errorName: "OverPayoutCap" })
    : locked + houseLockedBase > p.maxExpiryLockedBase ? diagnosis("reserve-cap", `OverExpiryCap(${locked + houseLockedBase}, ${p.maxExpiryLockedBase})`, { errorName: "OverExpiryCap" })
    : r.value.lockedBase + houseLockedBase > exposureCap ? diagnosis("reserve-cap", `OverExposure(${r.value.lockedBase + houseLockedBase}, ${exposureCap})`, { errorName: "OverExposure" })
    : null;
  return ok({ fits: refusal === null, refusal, lockedByExpiryBase: locked }, nowMs());
}
