/**
 * The client half of the R2 seat routes (abu-pm-seat): the seat's resting exit and its credit transfers. Same door as
 * every other seat call (`ledgerRequest`). Each write carries a fresh journal id, so the server recovers a retry of the
 * same tap instead of doing it twice.
 */
import type { MarketId, Side } from "@owarine/core/types";
import { ledgerRequest, type LedgerCallResult } from "./ledger-api";
import {
  armExitReplyWire, exitCancelReplyWire, exitCloseClientReplyWire, seatPkgReplyWire, sendReplyWire, transferEndReplyWire,
  type ArmExitReply, type ExitCancelReply, type ExitCloseClientReply, type SeatPkgReply, type SendReply, type TransferEndReply,
} from "./seat-wire";

export const readSeatPkg = (): Promise<LedgerCallResult<SeatPkgReply>> => ledgerRequest("/exits", { method: "GET", wire: seatPkgReplyWire });

export interface ArmExitInput {
  marketId: MarketId;
  side: Side;
  floorTicks: number;
  takeProfitTicks: number | null;
  stop: { stopE8: bigint; trailBps: number | null } | null;
}

export const postArmExit = (x: ArmExitInput, commandId: string = crypto.randomUUID()): Promise<LedgerCallResult<ArmExitReply>> =>
  ledgerRequest("/exits", { method: "POST", body: { commandId, ...x }, wire: armExitReplyWire });

export const postDisarmExit = (x: { marketId: MarketId; side: Side }, commandId: string = crypto.randomUUID()): Promise<LedgerCallResult<ExitCancelReply>> =>
  ledgerRequest("/exits/cancel", { method: "POST", body: { commandId, ...x }, wire: exitCancelReplyWire });

/** Close through the armed exit: the venue fills it at its bid, never below `minProceedsBase`. */
export const postExitClose = (exitCid: string, minProceedsBase: bigint): Promise<LedgerCallResult<ExitCloseClientReply>> =>
  ledgerRequest(`/exits/${encodeURIComponent(exitCid)}/close`, { method: "POST", body: { minProceedsBase }, wire: exitCloseClientReplyWire });

export const postSend = (x: { to: string; amount: bigint; memo: string }, commandId: string = crypto.randomUUID()): Promise<LedgerCallResult<SendReply>> =>
  ledgerRequest("/transfers", { method: "POST", body: { commandId, ...x }, wire: sendReplyWire });

export const postTransferEnd = (offerCid: string, choice: "accept" | "reject" | "withdraw", commandId: string = crypto.randomUUID()): Promise<LedgerCallResult<TransferEndReply>> =>
  ledgerRequest(`/transfers/${encodeURIComponent(offerCid)}`, { method: "POST", body: { commandId, choice }, wire: transferEndReplyWire });
