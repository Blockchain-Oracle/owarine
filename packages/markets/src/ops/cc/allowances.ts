/**
 * Which of an owner's allowances a listing may spend, and which duplicates fold together (C7b). An allowance is the
 * listing's only under the terms the listing states now: the same id, instrument and rate (the ledger refuses anything else).
 */
import type { ContractId, Party } from "@owarine/ledger/pure";
import type { AllowanceC, ListingC } from "./decode";

export interface Row<T> {
  cid: ContractId;
  data: T;
}

/** An allowance is this listing's only under the terms the listing states now. */
export const sameTerms = (a: AllowanceC, l: ListingC): boolean =>
  a.listingId === l.listingId && a.instrumentAdmin === l.instrumentAdmin && a.instrumentId === l.instrumentId && a.unitsPerCoin === l.unitsPerCoin;

/** The owner's allowance under the listing's terms; the largest when there are several (duplicates are merged separately). */
export function allowanceFor(allowances: readonly Row<AllowanceC>[], owner: Party, l: ListingC): Row<AllowanceC> | undefined {
  return allowances.filter((a) => a.data.owner === owner && sameTerms(a.data, l)).sort((a, b) => (a.data.units === b.data.units ? 0 : a.data.units > b.data.units ? -1 : 1))[0];
}

/** Owners with more than one allowance under the listing's terms: fold the rest into the largest (`Allowance_Merge`). */
export function planMerges(allowances: readonly Row<AllowanceC>[], l: ListingC): { keep: ContractId; others: ContractId[] }[] {
  const byOwner = new Map<Party, Row<AllowanceC>[]>();
  for (const a of allowances) if (sameTerms(a.data, l)) byOwner.set(a.data.owner, [...(byOwner.get(a.data.owner) ?? []), a]);
  const out: { keep: ContractId; others: ContractId[] }[] = [];
  for (const rows of byOwner.values()) {
    if (rows.length < 2) continue;
    const [keep, ...others] = [...rows].sort((a, b) => (a.data.units === b.data.units ? 0 : a.data.units > b.data.units ? -1 : 1));
    out.push({ keep: keep!.cid, others: others.map((o) => o.cid) });
  }
  return out;
}

