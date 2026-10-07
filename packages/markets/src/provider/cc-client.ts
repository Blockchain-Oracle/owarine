/**
 * The client half of the Canton Coin routes (C7b): what the funds screens call. Same door as every other seat call
 * (`ledgerRequest`: same-origin cookie on the web, the signed read header or the one-request write proof on the phone).
 * Each write carries a fresh client journal id, so a retry of the same tap is recovered by the server, not doubled.
 */
import { ccRailWire, ccWriteReplyWire, type CcRailReply, type CcWriteReply } from "./cc-wire";
import { ledgerRequest, type LedgerCallResult } from "./ledger-api";

export const readCcRail = (): Promise<LedgerCallResult<CcRailReply>> => ledgerRequest("/cc", { method: "GET", wire: ccRailWire });

export const postCcDeposit = (amount: string, commandId: string = crypto.randomUUID()): Promise<LedgerCallResult<CcWriteReply>> =>
  ledgerRequest("/cc/deposit", { method: "POST", body: { commandId, amount }, wire: ccWriteReplyWire });

export const postCcTap = (commandId: string = crypto.randomUUID()): Promise<LedgerCallResult<CcWriteReply>> =>
  ledgerRequest("/cc/tap", { method: "POST", body: { commandId }, wire: ccWriteReplyWire });

export const postCcReceive = (commandId: string = crypto.randomUUID()): Promise<LedgerCallResult<CcWriteReply>> =>
  ledgerRequest("/cc/receive", { method: "POST", body: { commandId }, wire: ccWriteReplyWire });

export const postCcWithdraw = (units: bigint, commandId: string = crypto.randomUUID()): Promise<LedgerCallResult<CcWriteReply>> =>
  ledgerRequest("/cc/withdraw", { method: "POST", body: { commandId, units: units.toString() }, wire: ccWriteReplyWire });
