/**
 * Duplicate oracle posts (C6e, K-070) against a real Postgres: every PriceQuote keeps its own row, so `verify-projection`
 * and the projector agree on the live set, and exactly one row per (oracle, symbol, boundary) is `chosen`: the quote the
 * ledger cited as evidence, else the resolver's rule (earliest fetch, then the lowest price). Skipped unless
 * PROJECTOR_IT=1 and DATABASE_URL name a scratch database; it truncates the projection tables.
 *
 *   PROJECTOR_IT=1 DATABASE_URL=postgres://localhost/pm_c6e_test pnpm vitest run packages/db/src/idx/prints.it.test.ts
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getDb } from "../client";
import { ensureSchema } from "../migrate";
import { projectedLiveSets } from "./read-verify";
import { indexReader } from "./read";
import type { IdxEvidence, IdxFact, IdxUpdate } from "./types";
import { indexWriter } from "./write";

const RUN = process.env.PROJECTOR_IT === "1" && Boolean(process.env.DATABASE_URL);
const VENUE = "venue::1220";
const T = 1_790_694_000;
const A = "oracle-coinbase::1220";
const B = "oracle-kraken::1220";

let offset = 0;
const update = (...facts: IdxFact[]): IdxUpdate => {
  offset += 1;
  return { updateId: `u${offset}`, offset, recordTimeMs: null, effectiveAtMs: (T + offset) * 1000, commandId: null, workflowId: null, events: [], facts };
};
const quote = (contractId: string, oracle: string, priceE8: string, fetchedAtSec: number): IdxFact => ({
  kind: "price", contractId, oracle, symbol: "TSLA", boundarySec: T, priceE8, barStartSec: T - 1, barLenSec: 1, fetchedAtSec, payloadHash: `h-${contractId}`, policyVersion: 2,
});
const cite = (q: { contractId: string; oracle: string; priceE8: string; fetchedAtSec: number }): IdxEvidence => ({ ...q, payloadHash: `h-${q.contractId}`, quoteCid: q.contractId });

describe.skipIf(!RUN)("idx_prints keeps every post and flags the resolution's one", () => {
  const db = getDb()!;
  const w = indexWriter(db);
  beforeEach(async () => {
    await ensureSchema();
    await w.truncate();
    offset = 0;
  });
  afterAll(async () => {
    await db.end();
  });

  const rows = () => db<{ contract_id: string; chosen: boolean; evidence: boolean; duplicates: number; retired: boolean }[]>`
    SELECT contract_id, chosen, evidence, duplicates, retired FROM idx_prints ORDER BY contract_id`;

  it("a second post by the same oracle is its own row; the earlier fetch is chosen, then the ledger's evidence wins", async () => {
    await w.applyUpdate("venue", VENUE, update(quote("q1", A, "35000000000", T + 12), quote("b1", B, "35010000000", T + 11)));
    // The same oracle posts again for the same boundary, fetched earlier (the drive's fallback and a feeder, C6d run 2).
    await w.applyUpdate("venue", VENUE, update(quote("q2", A, "35100000000", T + 10)));
    expect(await rows()).toEqual([
      { contract_id: "b1", chosen: true, evidence: false, duplicates: 0, retired: false },
      { contract_id: "q1", chosen: false, evidence: false, duplicates: 0, retired: false },
      { contract_id: "q2", chosen: true, evidence: false, duplicates: 1, retired: false },
    ]);

    // verify-projection's set is the ledger's live set: all three contracts.
    expect([...(await projectedLiveSets(db))["PM.Oracle:PriceQuote"]].sort()).toEqual(["b1", "q1", "q2"]);
    // The chart and the proof count one print per oracle.
    const history = await indexReader(db).printHistory("TSLA", T, T);
    expect(history).toEqual([expect.objectContaining({ source_ts_sec: String(T), signers: 2 })]);

    // The OpenPrint cited q1 (the resolver offered it under a narrower rule): the ledger's choice is the flagged one.
    await w.applyUpdate("venue", VENUE, update({ kind: "open-print", contractId: "op1", termsCid: "t1", openPriceE8: "35000000000", signers: 2, evidence: [cite({ contractId: "q1", oracle: A, priceE8: "35000000000", fetchedAtSec: T + 12 }), cite({ contractId: "b1", oracle: B, priceE8: "35010000000", fetchedAtSec: T + 11 })] }));
    expect((await rows()).map((r) => [r.contract_id, r.chosen, r.evidence, r.duplicates])).toEqual([
      ["b1", true, true, 0],
      ["q1", true, true, 1],
      ["q2", false, false, 0],
    ]);

    // A later post never displaces cited evidence; retiring the unused one leaves the live set equal to the ledger's.
    await w.applyUpdate("venue", VENUE, update(quote("q3", A, "1", T + 5), { kind: "price-retired", contractId: "q2" }));
    const after = await rows();
    expect(after.filter((r) => r.chosen).map((r) => r.contract_id)).toEqual(["b1", "q1"]);
    expect([...(await projectedLiveSets(db))["PM.Oracle:PriceQuote"]].sort()).toEqual(["b1", "q1", "q3"]);
  });

  it("replaying the same posts in another order chooses the same row", async () => {
    await w.applyUpdate("venue", VENUE, update(quote("q2", A, "35100000000", T + 10)));
    await w.applyUpdate("venue", VENUE, update(quote("q1", A, "35000000000", T + 12)));
    await w.applyUpdate("venue", VENUE, update(quote("q4", A, "34900000000", T + 10)));
    // Same fetch second: the lower price wins (Oracle.collectEvidence's order).
    expect((await rows()).filter((r) => r.chosen).map((r) => r.contract_id)).toEqual(["q4"]);
  });
});
