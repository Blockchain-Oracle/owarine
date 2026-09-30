/**
 * The Canton Coin panel's state, as a pure view model (C7b): what the funds screens (web and phone) show, decided from the
 * capability and what the server read. The renderers draw it and decide nothing. The rule the model keeps: while the
 * capability is not-live nothing is offered and no figure is invented; once live, every figure comes from the server's read
 * (the listing's stated rate, the seat's allowance, the venue's reserve statement), formatted with `formatBaseUnits`, never
 * a float.
 */
import { CC_RAIL_WAITING_ON, type CcRailCapability } from "@agari/core/cc";
import { formatBaseUnits } from "@agari/core/units";
import { atomicPerCashUnit, cashUnitsToCc, largestAcceptedCc, UnitsError } from "@agari/ledger/pure";
import type { CcRailReply } from "@agari/markets";
import { FUNDING } from "./copy";

const C = FUNDING.cc;
/** Cash is 6-decimal base units (one credit = 10^6), as everywhere in the app. */
export const CASH_DECIMALS = 6;
const UNIT = "credits";
const CC_DECIMALS = 10;

export type CcPanelTone = "not-live" | "unlisted" | "closed" | "ready";

export interface CcPanel {
  tone: CcPanelTone;
  badge: string;
  headline: string;
  /** Plain lines under the headline, in order. */
  lines: string[];
  /** Offered only when live, listed and open. */
  canDeposit: boolean;
  /** Offered only when live and the seat has coin owed to it and no ask waiting. */
  canWithdraw: boolean;
  /** The most the seat can take back now, in cash units (0 when it cannot). */
  maxWithdrawUnits: bigint;
  /** The deposit step, as a coin amount string ("0.00001"); null without a listing. */
  step: string | null;
}

const trimCc = (atomic: bigint): string => formatBaseUnits(atomic, CC_DECIMALS, { maxDp: CC_DECIMALS, minDp: 0, group: false });

export function ccPanel(input: { capability: CcRailCapability; view: CcRailReply | null }): CcPanel {
  const { capability, view } = input;
  if (capability !== "live") {
    return { tone: "not-live", badge: C.notLive, headline: C.notLiveHeadline, lines: [C.notLiveBody, C.waitingOn(CC_RAIL_WAITING_ON)], canDeposit: false, canWithdraw: false, maxWithdrawUnits: 0n, step: null };
  }
  const listing = view?.listing ?? null;
  if (!view || !listing) {
    return { tone: "unlisted", badge: C.ready, headline: C.unlisted, lines: [], canDeposit: false, canWithdraw: false, maxWithdrawUnits: 0n, step: null };
  }
  const rate = BigInt(listing.unitsPerCoin);
  const step = trimCc(atomicPerCashUnit(rate));
  const lines = [
    C.rate(formatBaseUnits(rate, CASH_DECIMALS, { maxDp: CASH_DECIMALS, minDp: 2 }), UNIT),
    C.step(step),
    C.bounds(minAmount(BigInt(listing.minDepositUnits), rate), minAmount(BigInt(listing.maxDepositUnits), rate)),
    C.onlyDeposited,
  ];
  const allowance = BigInt(view.allowanceUnits);
  const cash = BigInt(view.cashUnits);
  const waiting = view.proposals.length > 0;
  const maxWithdrawUnits = waiting ? 0n : allowance < cash ? allowance : cash;
  if (allowance > 0n) lines.push(C.allowance(formatBaseUnits(allowance, CASH_DECIMALS), UNIT));
  const held = view.holdings.find((h) => h.instrumentAdmin === listing.instrumentAdmin && h.instrumentId === listing.instrumentId);
  if (held) lines.push(C.holds(trimCc(BigInt(held.unlockedAtomic))));
  if (waiting) lines.push(C.waitingForVenue);
  if (view.withdrawals.some((w) => w.state === "sent")) lines.push(C.inFlight);
  lines.push(
    view.reserve
      ? (view.reserve.covered ? C.reserveCovered : C.reserveShort)(formatBaseUnits(BigInt(view.reserve.heldUnits), CASH_DECIMALS), formatBaseUnits(BigInt(view.reserve.liabilityUnits), CASH_DECIMALS), UNIT)
      : C.noReserve,
  );
  return {
    tone: listing.depositsOpen ? "ready" : "closed",
    badge: C.ready,
    headline: listing.depositsOpen ? C.title : C.closed,
    lines,
    canDeposit: listing.depositsOpen,
    canWithdraw: maxWithdrawUnits > 0n,
    maxWithdrawUnits,
    step,
  };
}

const minAmount = (units: bigint, rate: bigint): string => {
  try {
    return trimCc(BigInt(cashUnitsToCc(units, rate).replace(".", "")));
  } catch {
    return "—";
  }
};

/**
 * What a typed deposit will actually send: the amount rounded DOWN to the listing's step (a form may round the user's own
 * input down; the venue never keeps a fraction), or null when nothing valid is left. `changed` says it was rounded.
 */
export function depositAmount(typed: string, unitsPerCoin: string): { amount: string; changed: boolean } | null {
  const t = typed.trim().replace(/,/g, "");
  if (!/^\d{1,8}(\.\d{1,10})?$/.test(t)) return null;
  try {
    const exact = largestAcceptedCc(t, BigInt(unitsPerCoin));
    if (!exact) return null;
    const shown = trimCc(BigInt(exact.replace(".", "")));
    const typedNormal = trimCc(BigInt(t.includes(".") ? (t.split(".")[0] + (t.split(".")[1] ?? "").padEnd(10, "0")) : t + "0".repeat(10)));
    return { amount: shown, changed: shown !== typedNormal };
  } catch (error) {
    if (error instanceof UnitsError) return null;
    throw error;
  }
}

/** What a typed number of credits to take back is, as cash units and as the coin it converts to; null when it cannot be sent. */
export function withdrawUnits(typed: string, panel: Pick<CcPanel, "maxWithdrawUnits">, unitsPerCoin: string): { units: bigint; coin: string } | null {
  const t = typed.trim().replace(/,/g, "");
  if (!/^\d{1,12}(\.\d{1,6})?$/.test(t)) return null;
  const [w = "", f = ""] = t.split(".");
  const units = BigInt(w) * 10n ** BigInt(CASH_DECIMALS) + BigInt(f.padEnd(CASH_DECIMALS, "0"));
  if (units <= 0n || units > panel.maxWithdrawUnits) return null;
  try {
    return { units, coin: trimCc(BigInt(cashUnitsToCc(units, BigInt(unitsPerCoin)).replace(".", ""))) };
  } catch {
    return null;
  }
}
