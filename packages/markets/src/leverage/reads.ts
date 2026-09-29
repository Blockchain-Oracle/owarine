/**
 * Boost's reserve on Canton (C8c): the `boost` ticket reserve (`PM.Reserve` statement + `RiskBook`) and the seat's own
 * `BoostPosition`s, through `/api/ledger/tickets/*`. A position's mark is its contracts at the venue ladder's fair
 * price; its knock-out line is the pinned proceeds, and only the venue's oracle-quorum barrier knocks it out (K-029).
 */
import type { LeverageMark, LeveragePosition, LeverageReserveState } from "@agari/core/leverage";
import type { ProviderShares } from "@agari/core/reserves";
import { err, ok, type Reading } from "@agari/core/schemas";
import { diagnosis, type Address } from "@agari/core/types";
import { registeredSeatAddress } from "../provider/ledger-api";
import { readReserve, readTicketsMine, ticketIdOf } from "../tickets/client";
import { leveragePositionOf, leverageReserveOf, sharesOf } from "../tickets/views";

export async function getLeverageReserveState(): Promise<Reading<LeverageReserveState | null>> {
  const r = await readReserve("boost");
  return r.ok ? ok(r.value ? leverageReserveOf(r.value) : null, r.asOfMs) : r;
}

export async function listLeveragePositionsOf(wallet: Address): Promise<Reading<LeveragePosition[]>> {
  const mine = await readTicketsMine();
  return mine.ok ? ok(mine.value.positions.map((p) => leveragePositionOf(p, wallet)), mine.asOfMs) : mine;
}

export async function getLeveragePosition(positionId: bigint): Promise<Reading<LeveragePosition | null>> {
  const mine = await readTicketsMine();
  if (!mine.ok) return mine;
  const p = mine.value.positions.find((x) => ticketIdOf(x.cid) === positionId);
  return ok(p ? leveragePositionOf(p, registeredSeatAddress() ?? ("" as Address)) : null, mine.asOfMs);
}

/** Every open boost is only the venue's to see (each is bilateral): a seat lists its own. */
export const listLeverageOpenPositions = async (): Promise<Reading<LeveragePosition[]>> => {
  const seat = registeredSeatAddress();
  return seat ? listLeveragePositionsOf(seat) : ok([], Date.now());
};

export async function getLeverageSharesOf(_wallet: Address): Promise<Reading<ProviderShares>> {
  const mine = await readTicketsMine();
  return mine.ok ? ok(sharesOf(mine.value, "boost"), mine.asOfMs) : mine;
}

export async function getLeverageMark(positionId: bigint): Promise<Reading<LeverageMark>> {
  const mine = await readTicketsMine();
  if (!mine.ok) return mine;
  const p = mine.value.positions.find((x) => ticketIdOf(x.cid) === positionId);
  if (!p) return err(diagnosis("already-claimed", "this boost is no longer open"));
  if (p.markBase === null) return err(diagnosis("market-not-trading", "the venue is not quoting this Window: the boost marks at settlement"));
  const quantityRaw = p.lots * 1000n * p.cashUnit;
  return ok({ markBase: p.markBase, filledRaw: quantityRaw, lineBase: p.knockOutProceedsBase, knockable: p.frontedBase > 0n && p.markBase <= p.knockOutProceedsBase }, mine.asOfMs);
}
