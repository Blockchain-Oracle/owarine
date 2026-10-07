/**
 * A cash contract of exactly `amount` for a seat, before a choice that takes the WHOLE value of the cash it is handed
 * (`Mandate_Deposit`, `GrantDesk_Fund`): an exact contract is used as it is; otherwise the smallest contract above the
 * amount is split (`VenueCash_Split`, change back to the seat), merging first when no single contract covers it.
 * Splitting and merging only rearrange the seat's own cash, so a step that lands without the write that follows it
 * leaves the seat exactly as rich as before. Each step's command id derives from the write's journal id.
 *
 * C8g: the grant top-up handed the seat's largest contract to `GrantDesk_Fund`, which moved all of it into the grant
 * (a 1-credit top-up moved 995.50). The desk's deposit already split first; both now share this.
 */
import { TEMPLATE_IDS } from "@owarine/daml";
import type { LedgerClient, Party } from "@owarine/ledger";
import { decodeVenueCash, templateSuffix } from "../ops/canton/decode";
import { mergeCash, splitCash } from "../ops/canton/commands";
import { refuse } from "./rejection";
import { selectCash } from "./writes";

export interface ExactCashDeps {
  client: Pick<LedgerClient, "submitAndWaitForTransaction">;
  /** The seat's own cash, fresh. */
  cashOf: (party: Party) => Promise<readonly { cid: string; amount: bigint }[]>;
}

const ascending = (a: { amount: bigint }, b: { amount: bigint }) => (a.amount === b.amount ? 0 : a.amount < b.amount ? -1 : 1);

export async function exactCash(deps: ExactCashDeps, party: Party, journalId: string, amount: bigint, prefix: string, what = "this write"): Promise<string> {
  if (amount <= 0n) throw refuse("invalid-price", `${what} must be positive`);
  let cash = await deps.cashOf(party);
  const exact = cash.find((c) => c.amount === amount);
  if (exact) return exact.cid;
  let cover = cash.filter((c) => c.amount > amount).sort(ascending)[0];
  if (!cover) {
    const picked = selectCash(cash, amount);
    if (!picked) throw refuse("insufficient-collateral", `the seat holds ${cash.reduce((s, c) => s + c.amount, 0n)} and ${what} is ${amount}`);
    const [head, ...rest] = picked as [string, ...string[]];
    await deps.client.submitAndWaitForTransaction({ actAs: [party], commandId: `${prefix}merge:${journalId}`, commands: [mergeCash(head, rest)] });
    cash = await deps.cashOf(party);
    const exactAfter = cash.find((c) => c.amount === amount);
    if (exactAfter) return exactAfter.cid;
    cover = cash.filter((c) => c.amount > amount).sort(ascending)[0];
    if (!cover) throw refuse("insufficient-collateral", `the seat's cash could not be gathered for ${what}`);
  }
  const r = await deps.client.submitAndWaitForTransaction({ actAs: [party], commandId: `${prefix}split:${journalId}`, commands: [splitCash(cover.cid, amount)] });
  const part = r.transaction.events
    .flatMap((e) => ("CreatedEvent" in e && templateSuffix(e.CreatedEvent.templateId) === templateSuffix(TEMPLATE_IDS.VenueCash) ? [e.CreatedEvent] : []))
    .find((e) => decodeVenueCash(e.createArgument).amount === amount);
  if (!part) throw refuse("contract-revert", `the split did not produce ${what}'s amount`);
  return part.contractId;
}
