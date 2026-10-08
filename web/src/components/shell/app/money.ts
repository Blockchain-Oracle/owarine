"use client";

import { isOk } from "@owarine/core/schemas";
import { formatBaseUnits } from "@owarine/core/units";
import { useBalancePlate } from "@/features/markets/balance";
import { useModeState, useTradeMode } from "@/features/terminal/mode";

const AMOUNT_DP = 2;
/** Paper credits carry the ledger's six decimals (`DEMO_START_BASE`). */
const DEMO_DECIMALS = 6;

export type ShellBalance =
  | { kind: "demo"; text: string }
  /** Live with a seat: what a bet can be paid from (seat cash plus the Trading Balance); null until it is read. */
  | { kind: "live"; text: string | null; symbol: string }
  /** Live with no seat yet. */
  | { kind: "seatless" };

/**
 * The one money figure the shell shows: the demo balance in Demo, the seat's spendable total in Live (the sum the old
 * header pill showed). Never a half-loaded sum: an unread sheet is null, drawn as a dash.
 */
export function useShellBalance(): ShellBalance {
  const mode = useTradeMode();
  const { demoBalanceBase } = useModeState();
  const plate = useBalancePlate();
  if (mode === "demo") {
    return { kind: "demo", text: formatBaseUnits(BigInt(demoBalanceBase), DEMO_DECIMALS, { maxDp: AMOUNT_DP, minDp: AMOUNT_DP }) };
  }
  if (plate.kind !== "connected") return { kind: "seatless" };
  const sheet = plate.reading && isOk(plate.reading) ? plate.reading.value : null;
  const text = sheet ? formatBaseUnits(sheet.spendableBase + (sheet.vaultBase ?? 0n), sheet.decimals, { maxDp: AMOUNT_DP, minDp: AMOUNT_DP }) : null;
  return { kind: "live", text, symbol: plate.symbol ?? "" };
}
