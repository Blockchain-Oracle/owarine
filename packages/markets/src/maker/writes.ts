/**
 * The maker vault's writes on Canton (abu-pm-main 0.5.0, K-092, K-200), through the seat's queued lane:
 *
 *   maker-supply / maker-withdraw   a firm supply or withdraw quote from ops, priced from the vault's fresh statement
 *                                   (`reserve: "maker"`), then the seat's own `Supply_Accept` / `Withdraw_Accept`
 *   maker-merge / maker-settle      the reference's permissionless cranks: the venue runs them now for the Window
 *   maker-quote / maker-pull        the maker actor's own; on Canton the venue's issuer quotes for the vault, so a seat
 *                                   refuses them before anything is journaled
 */
import type { MakerIntent } from "@agari/core/maker";
import type { PhaseListener, TxOutcome } from "@agari/core/ports";
import { diagnosis } from "@agari/core/types";
import type { SeatLaneDeps } from "../submitter/seat-lane";
import { earnCall, forgetTicketReads } from "../tickets/client";
import { earnWrite } from "../tickets/earn-lane";

const ISSUER_QUOTES = "the vault's quotes are the venue issuer's on Canton (MAKER_MODE=vault): a seat does not place or pull them";

async function crank(op: "merge" | "settle", marketId: string): Promise<TxOutcome> {
  const r = await earnCall({ op, reserve: "maker", marketId });
  if (!r.ok) return { status: "refused", diagnosis: r.diagnosis };
  const q = r.value;
  if (q.kind === "refused") return { status: "refused", diagnosis: q.diagnosis };
  if (q.kind !== "maker-op") return { status: "refused", diagnosis: diagnosis("unknown", `unexpected ${q.kind} reply to a maker ${op}`) };
  forgetTicketReads();
  if (q.done === 0) return { status: "refused", diagnosis: diagnosis("unknown", q.note) };
  // The venue signed the crank; there is no seat transaction to point at.
  return { status: "confirmed", txHash: "" as never };
}

export async function submitMakerTx(ctx: unknown, intent: MakerIntent, onPhase?: PhaseListener): Promise<TxOutcome> {
  const deps = ctx as SeatLaneDeps;
  switch (intent.kind) {
    case "maker-supply":
      return earnWrite(deps, "maker", { op: "supply", amountBase: intent.amountBase }, intent.kind, onPhase);
    case "maker-withdraw":
      return earnWrite(deps, "maker", { op: "withdraw", shares: intent.shares }, intent.kind, onPhase);
    case "maker-merge":
      return crank("merge", intent.marketId);
    case "maker-settle":
      return crank("settle", intent.marketId);
    case "maker-quote":
    case "maker-pull":
      return { status: "refused", diagnosis: diagnosis("not-deployed", ISSUER_QUOTES) };
  }
}
