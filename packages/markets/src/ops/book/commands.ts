/**
 * The maker vault's commands (abu-pm-main 0.5.0, `PM.Maker` / `PM.Book`). Supply and withdraw quotes are the
 * reserve's own (`tcmd.issueSupply`, `Nav_IssueWithdraw`); a pair quote from the book is the desk's `Desk_IssueQuote`
 * on a `reserve:maker` shard. What is new is the statement the book publishes and the desk that publishes it.
 */
import { TEMPLATE_IDS, type PM } from "@agari/daml";
import { toDamlInt, type Command, type ContractId, type Party } from "@agari/ledger/pure";
import { isoOfSec } from "../canton/decode";

const exercise = (templateId: string, contractId: ContractId, choice: string, choiceArgument: unknown): Command => ({
  ExerciseCommand: { templateId, contractId, choice, choiceArgument },
});
const create = (templateId: string, createArguments: unknown): Command => ({ CreateCommand: { templateId, createArguments } });
const int = (v: bigint | number) => toDamlInt(BigInt(v));

/** `Maker_PublishNav`'s inputs: everything of the book's the statement counts (see `makerNav`). */
export interface MakerNavInputsC {
  cash: ContractId[];
  lpShares: ContractId[];
  withdrawQuotes: ContractId[];
  quotes: ContractId[];
  buyQuotes: ContractId[];
  legs: ContractId[];
  residuals: ContractId[];
  resolutions: ContractId[];
}

export const createMakerDesk = (venue: Party): Command => create(TEMPLATE_IDS.MakerDesk, { venue } satisfies PM.Maker.MakerDesk);

export const publishMakerNav = (makerDeskCid: ContractId, navCid: ContractId, asOfSec: number, inputs: MakerNavInputsC): Command =>
  exercise(TEMPLATE_IDS.MakerDesk, makerDeskCid, "Maker_PublishNav", { navCid, "asOf": isoOfSec(asOfSec), inputs });

/** A withdrawal paid only from the book's liquid cash: `Nav_IssueWithdraw` refuses any shard outside `reserve:<id>`. */
export const issueMakerWithdraw = (navCid: ContractId, o: { provider: Party; lpShareCid: ContractId; sharesIn: bigint; shardCid: ContractId; validUntilSec: number }): Command =>
  exercise(TEMPLATE_IDS.NavStatement, navCid, "Nav_IssueWithdraw", {
    provider: o.provider, lpShareCid: o.lpShareCid, sharesIn: int(o.sharesIn), shardCid: o.shardCid, validUntil: isoOfSec(o.validUntilSec),
  });

/** The book's own escape past `refundAfter` (the venue owns the leg): its backing back into `reserve:<id>`. */
export const refundBookLeg = (legCid: ContractId): Command => exercise(TEMPLATE_IDS.Leg, legCid, "Leg_RefundStale", {});

export const pruneBookReceipt = (cid: ContractId): Command => exercise(TEMPLATE_IDS.BookReceipt, cid, "BookReceipt_Prune", {});
