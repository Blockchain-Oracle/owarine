/**
 * Integration test against a real local sandbox. Skipped unless LEDGER_IT=1.
 *
 *   dpm sandbox --json-api-port 7575 --dar spikes/pmspike/main/.daml/dist/pmspike-main-0.0.1.dar
 *   LEDGER_IT=1 pnpm --filter @owarine/ledger test:it
 *
 * Uses the spike's `Mechanism:PriceQuote` (signatory oracle, observer venue) as a throwaway template.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { createLedgerClient, type LedgerClient } from "./client";
import { noAuth } from "./auth";
import { LedgerError } from "./errors";
import type { CreatedEvent, JsTransaction } from "./types";
import { streamUpdates } from "./updates";

const RUN = process.env.LEDGER_IT === "1";
const URL_ = process.env.LEDGER_JSON_API_URL ?? "http://localhost:7575";
const TEMPLATE = "#pmspike-main:Mechanism:PriceQuote";
const run = Date.now().toString(36);

const created = (tx: JsTransaction): CreatedEvent[] =>
  tx.events.flatMap((e) => ("CreatedEvent" in e ? [e.CreatedEvent] : []));

const priceQuote = (party: string, symbol: string) => ({
  CreateCommand: {
    templateId: TEMPLATE,
    createArguments: { oracle: party, venue: party, symbol, price: "1.5", asOf: "2026-09-29T00:00:00Z" },
  },
});

describe.skipIf(!RUN)("ledger integration (local sandbox)", () => {
  let c: LedgerClient;
  let alice = "";
  let bob = "";

  beforeAll(async () => {
    c = createLedgerClient({ baseUrl: URL_, auth: noAuth(), userId: "owarine-it" });
    for (let i = 0; ; i++) {
      try {
        await c.version();
        break;
      } catch (e) {
        if (i > 60) throw e;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    // A fresh sandbox rejects party allocation for a few seconds after /v2/version answers.
    const allocate = async (hint: string) => {
      for (let i = 0; ; i++) {
        try {
          return (await c.allocateParty(hint)).party;
        } catch (e) {
          if (i > 30) throw e;
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    };
    alice = await allocate(`alice-${run}`);
    bob = await allocate(`bob-${run}`);
  }, 120_000);

  it("answers version, ledger end and synchronizers", async () => {
    const v = await c.version();
    const syncs = await c.connectedSynchronizers();
    console.log(`[it] version ${v.version}; ledger end ${await c.ledgerEnd()}; synchronizers ${syncs.map((s) => s.synchronizerAlias).join(",")}`);
    expect(v.version).toMatch(/^3\.5\./);
    expect(syncs.length).toBeGreaterThan(0);
  });

  let firstTx: JsTransaction;
  const commandId = `it:create:${run}`;

  it("creates via submit-and-wait-for-transaction (ACS_DELTA by default)", async () => {
    const r = await c.submitAndWaitForTransaction({ actAs: [alice], commandId, commands: [priceQuote(alice, "BTC")] });
    firstTx = r.transaction;
    const ev = created(r.transaction);
    console.log(`[it] created ${ev[0]?.contractId.slice(0, 16)}… at offset ${r.transaction.offset}, update ${r.transaction.updateId.slice(0, 16)}…, attempts ${r.attempts}`);
    expect(r.recovered).toBe(false);
    expect(ev).toHaveLength(1);
    expect(ev[0]!.createArgument).toMatchObject({ symbol: "BTC", price: "1.5000000000" });
  });

  it("deduplicates a resend under the same commandId and actAs set", async () => {
    const raw = await c
      .submitAndWaitForTransaction({ actAs: [alice], commandId, commands: [priceQuote(alice, "BTC")], recoverDuplicate: false })
      .catch((e: unknown) => e);
    expect(raw).toBeInstanceOf(LedgerError);
    const e = raw as LedgerError;
    console.log(`[it] resend → HTTP ${e.status} ${e.code} category ${e.errorCategory}; context completion_offset=${e.context.completion_offset} accepted=${e.context.accepted} existingSubmissionId=${e.context.existingSubmissionId}`);
    expect([e.status, e.kind, e.code]).toEqual([409, "duplicate", "DUPLICATE_COMMAND"]);
    expect(e.duplicateCompletionOffset).toBe(firstTx.offset);

    const rec = await c.submitAndWaitForTransaction({ actAs: [alice], commandId, commands: [priceQuote(alice, "BTC")] });
    console.log(`[it] resend with recovery → recovered=${rec.recovered}, same update=${rec.transaction.updateId === firstTx.updateId}`);
    expect(rec.recovered).toBe(true);
    expect(rec.transaction.updateId).toBe(firstTx.updateId);
    expect(created(rec.transaction)[0]!.contractId).toBe(created(firstTx)[0]!.contractId);
  });

  it("does NOT deduplicate the same commandId under a different actAs set", async () => {
    const r = await c.submitAndWaitForTransaction({ actAs: [bob], commandId, commands: [priceQuote(bob, "ETH")] });
    console.log(`[it] same commandId, actAs [bob] → new update ${r.transaction.updateId !== firstTx.updateId}`);
    expect(r.recovered).toBe(false);
    expect(r.transaction.updateId).not.toBe(firstTx.updateId);
  });

  it("reads per party: each sees only its own contracts; paging follows nextPageToken", async () => {
    await c.submitAndWaitForTransaction({ actAs: [alice], commandId: `it:create2:${run}`, commands: [priceQuote(alice, "SOL")] });
    const asAlice = await c.activeContracts({ parties: [alice], templateIds: [TEMPLATE], maxPageSize: 1 });
    const asBob = await c.activeContracts({ parties: [bob], templateIds: [TEMPLATE] });
    const pages: number[] = [];
    for await (const p of c.iterateActiveContracts({ parties: [alice], templateIds: [TEMPLATE], maxPageSize: 1 })) pages.push(p.contracts.length);
    const symbols = (xs: typeof asAlice.contracts) => xs.map((x) => (x.createdEvent.createArgument as { symbol: string }).symbol).sort();
    console.log(`[it] alice sees ${JSON.stringify(symbols(asAlice.contracts))} over pages ${JSON.stringify(pages)}; bob sees ${JSON.stringify(symbols(asBob.contracts))}`);
    expect(symbols(asAlice.contracts)).toEqual(["BTC", "SOL"]);
    expect(pages).toEqual([1, 1]);
    expect(symbols(asBob.contracts)).toEqual(["ETH"]);
    for (const x of asAlice.contracts) expect(x.createdEvent.witnessParties).toEqual([alice]);
  });

  it("streams /v2/updates from offset 0 and receives the created event", async () => {
    const seen: string[] = [];
    let checkpoints = 0;
    const target = created(firstTx)[0]!.contractId;
    let resolveHit!: () => void;
    const hit = new Promise<void>((r) => (resolveHit = r));
    const s = streamUpdates({
      baseUrl: URL_,
      auth: noAuth(),
      parties: [alice],
      beginExclusive: 0,
      onTransaction: (tx) => {
        for (const e of tx.events) if ("CreatedEvent" in e) seen.push(e.CreatedEvent.contractId);
        if (seen.includes(target)) resolveHit();
      },
      onCheckpoint: () => {
        checkpoints++;
      },
      onError: (e) => console.log(`[it] stream error ${e.message}`),
    });
    await Promise.race([hit, new Promise((_, rej) => setTimeout(() => rej(new Error("no created event within 20 s")), 20_000))]);
    console.log(`[it] stream as alice: ${seen.length} created events, ${checkpoints} checkpoints, cursor ${s.cursor}`);
    expect(seen).toContain(target);
    await s.close();
  }, 30_000);
});
