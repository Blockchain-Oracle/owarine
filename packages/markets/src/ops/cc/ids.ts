/**
 * Command ids of the Canton Coin rail: stable per logical action, so a crash-retry is deduplicated by the participant
 * instead of settling or paying twice. A contract id enters an id as a short digest (the same rule as the other actors).
 */
import { assertCommandId } from "@agari/ledger/pure";
import { digest } from "../canton/ids";

/** `ccdep:<digest(instruction)>`: the settle of one deposit. An instruction is consumed once, so one id per instruction. */
export const settleDepositCommandId = (instructionCid: string) => assertCommandId(`ccdep:${digest(instructionCid)}`);
/** `ccrej:<digest(instruction)>`: rejecting a deposit the venue will not take. */
export const rejectDepositCommandId = (instructionCid: string) => assertCommandId(`ccrej:${digest(instructionCid)}`);
/** `ccwd:<digest(proposal)>`: the answer to one withdrawal proposal. */
export const acceptWithdrawalCommandId = (proposalCid: string) => assertCommandId(`ccwd:${digest(proposalCid)}`);
/** `ccdecl:<digest(proposal)>`: declining one. */
export const declineWithdrawalCommandId = (proposalCid: string) => assertCommandId(`ccdecl:${digest(proposalCid)}`);
/** `ccdone:<digest(withdrawal)>`, `ccrefund:<…>`: closing one withdrawal in flight. */
export const completeWithdrawalCommandId = (withdrawalCid: string) => assertCommandId(`ccdone:${digest(withdrawalCid)}`);
export const refundWithdrawalCommandId = (withdrawalCid: string) => assertCommandId(`ccrefund:${digest(withdrawalCid)}`);
/** `ccmerge:<digest(keep, others)>`: folding one owner's duplicate allowances. */
export const mergeAllowancesCommandId = (keep: string, others: readonly string[]) => assertCommandId(`ccmerge:${digest(keep, ...[...others].sort())}`);
/** `ccattest:<listing>:<seq>`: the statement after `seq` (the previous statement is consumed, so one per seq). */
export const attestCommandId = (listingId: string, seq: number) => assertCommandId(`ccattest:${digest(listingId)}:${seq}`);
