/**
 * Product dependents (C8d, C-DAML-03): a RangeRound, a ParlayTicket's undecided legs or a BoostPosition pins its
 * Window's terms until it ends. One row per (product contract, terms); a parlay that decides a leg re-creates the ticket
 * with fewer undecided legs, so its old rows close and its new rows open in the same update. Absolute values, so a
 * replayed update changes nothing.
 */
import type postgres from "postgres";
import type { IdxFact, IdxUpdate } from "./types";

type Tx = postgres.TransactionSql;

export async function dependentRows(tx: Tx, u: IdxUpdate, tsSec: number, f: Extract<IdxFact, { kind: "dependent" }>): Promise<void> {
  for (const t of f.terms) {
    const row = {
      product_cid: f.contractId, terms_cid: t.termsCid, market_key: t.marketKey, product: f.product, owner_party: f.owner,
      opened_update_id: u.updateId, opened_offset: u.offset, opened_ts_sec: tsSec,
    };
    await tx`INSERT INTO idx_dependents ${tx(row)} ON CONFLICT (product_cid, terms_cid) DO NOTHING`;
  }
}

export async function dependentClosed(tx: Tx, u: IdxUpdate, tsSec: number, f: Extract<IdxFact, { kind: "dependent-closed" }>): Promise<void> {
  await tx`
    UPDATE idx_dependents SET closed_update_id = ${u.updateId}, closed_ts_sec = ${tsSec}, how = ${f.how}
    WHERE product_cid = ${f.contractId} AND closed_ts_sec IS NULL`;
}
