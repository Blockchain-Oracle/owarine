/**
 * The venue's reserve statement, planned the way the ledger computes it (C7b): the check before sending. Pure.
 */
import { atomicPerCashUnit, type ContractId, type Party } from "@agari/ledger/pure";
import type { Row } from "./allowances";
import type { AllowanceC, HoldingViewC, ListingC } from "./decode";

export interface HoldingRow {
  cid: ContractId;
  /** The created event's template (package-id form) and signatories: what makes a holding the registry's. */
  templateId: string;
  signatories: readonly Party[];
  view: HoldingViewC;
}

export interface AttestPlan {
  holdingCids: ContractId[];
  allowanceCids: ContractId[];
  /** What the statement will say, computed here the way the ledger computes it: the check before sending. */
  heldAtomic: bigint;
  liabilityAtomic: bigint;
  heldUnits: bigint;
  liabilityUnits: bigint;
  covered: boolean;
}

/**
 * The venue's own holdings of the listed instrument that are not locked and that the registry signed: what a withdrawal
 * can spend and a statement counts. A holding whose signatories lack the registry's party is a look-alike and is never
 * spent or counted; with `allowedPackageIds`, its template's package must be on the list too.
 */
export function unlockedHoldings(venue: Party, listing: ListingC, holdings: readonly HoldingRow[], allowedPackageIds: readonly string[] = []): HoldingRow[] {
  return holdings.filter(
    (h) =>
      h.view.owner === venue && h.view.instrumentAdmin === listing.instrumentAdmin && h.view.instrumentId === listing.instrumentId && h.view.lock === null &&
      h.signatories.includes(listing.instrumentAdmin) && (allowedPackageIds.length === 0 || allowedPackageIds.includes(h.templateId.slice(0, h.templateId.indexOf(":")))),
  );
}

/**
 * Every unlocked holding of the instrument the venue owns and every allowance of ANY listing of that instrument (each at
 * its own rate, in atomic units: two listings draw on one pool of coin), and what they add up to.
 */
export function planAttest(a: { venue: Party; listing: ListingC; holdings: readonly HoldingRow[]; allowances: readonly Row<AllowanceC>[]; allowedPackageIds?: readonly string[] }): AttestPlan {
  const mine = unlockedHoldings(a.venue, a.listing, a.holdings, a.allowedPackageIds);
  const owed = a.allowances.filter((x) => x.data.venue === a.venue && x.data.instrumentAdmin === a.listing.instrumentAdmin && x.data.instrumentId === a.listing.instrumentId);
  const heldAtomic = mine.reduce((s, h) => s + h.view.amountAtomic, 0n);
  const liabilityAtomic = owed.reduce((s, x) => s + x.data.units * atomicPerCashUnit(x.data.unitsPerCoin), 0n);
  const per = atomicPerCashUnit(a.listing.unitsPerCoin);
  return {
    holdingCids: mine.map((h) => h.cid),
    allowanceCids: owed.map((x) => x.cid),
    heldAtomic,
    liabilityAtomic,
    heldUnits: heldAtomic / per,
    liabilityUnits: (liabilityAtomic + per - 1n) / per,
    covered: heldAtomic >= liabilityAtomic,
  };
}
