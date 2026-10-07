import { SHARE_TOKENS } from "@owarine/core/market";
import { CIP56_INTERFACE_IDS } from "@owarine/daml";
import type { LedgerClient } from "@owarine/ledger";
import { describe, expect, it } from "vitest";
import { HoldingsReadError, parseShareInstruments, readCip56Holdings, readHoldings } from "./reader";

const ME = "seat::1220aa";
const ADMIN = "issuer::1220bb";
const TOKEN = SHARE_TOKENS[0]!;

const view = (owner: string, admin: string, id: string, amount: string, lock: unknown = null) => ({ owner, instrumentId: { admin, id }, amount, lock, meta: { values: {} } });
const contract = (cid: string, v: unknown, offset = 1, status = 0, signatories: string[] | null = null) => ({
  synchronizerId: "s",
  createdEvent: { contractId: cid, templateId: "pkg:Any.Registry:AnyHolding", offset, createArgument: {}, signatories: signatories ?? [((v as { instrumentId?: { admin?: string } }).instrumentId?.admin) ?? "x", ME], interfaceViews: [{ interfaceId: "abcd:Splice.Api.Token.HoldingV1:Holding", viewStatus: { code: status }, viewValue: v }] },
});
const clientOf = (contracts: unknown[]) => {
  const calls: unknown[] = [];
  const client = { activeContracts: async (q: unknown) => { calls.push(q); return { contracts, activeAtOffset: 1 }; } } as unknown as Pick<LedgerClient, "activeContracts">;
  return { client, calls };
};

describe("CIP-56 holdings (C7b; fake ledger)", () => {
  it("reads through the Holding interface for the party only, exactly, locked or not", async () => {
    const { client, calls } = clientOf([
      contract("h1", view(ME, ADMIN, "AAPLt", "2.5000000000")),
      contract("h2", view(ME, ADMIN, "AAPLt", "0.0000000001", { holders: [ME], expiresAt: null, expiresAfter: null, context: null })),
      contract("offer", view("someone::1", ADMIN, "AAPLt", "99.0000000000", { holders: ["x"], expiresAt: null, expiresAfter: null, context: null })),
      contract("bad", { nonsense: true }),
      contract("forged", view(ME, ADMIN, "AAPLt", "999.0000000000"), 1, 0, [ME, "attacker::1"]),
      contract("unrendered", view(ME, ADMIN, "AAPLt", "1.0"), 1, 3),
    ]);
    const hs = await readCip56Holdings(client, ME);
    expect(hs.map((h) => [h.contractId, h.amountAtomic, h.locked])).toEqual([["h1", 25_000_000_000n, false], ["h2", 1n, true], ["forged", 9_990_000_000_000n, false]]);
    expect(hs.find((h) => h.contractId === "forged")?.signatories).not.toContain(ADMIN);
    expect(calls).toEqual([{ parties: [ME], interfaceIds: [CIP56_INTERFACE_IDS.Holding], maxPageSize: 500 }]);
  });

  it("reports a failed read as an error, never as an empty list", async () => {
    const client = { activeContracts: async () => { throw new Error("connect ECONNREFUSED https://ledger.internal:7575 token=abc"); } } as unknown as Pick<LedgerClient, "activeContracts">;
    const error = await readCip56Holdings(client, ME).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HoldingsReadError);
    expect(String((error as Error).message)).not.toMatch(/ledger\.internal|token=/);
  });

  it("answers the mapped share instruments, summed, unlocked only, in integers", async () => {
    const { client } = clientOf([
      contract("a", view(ME, ADMIN, "AAPLt", "1.5000000000")),
      contract("b", view(ME, ADMIN, "AAPLt", "0.2500000000")),
      contract("locked", view(ME, ADMIN, "AAPLt", "9.0000000000", { holders: [ME], expiresAt: null, expiresAfter: null, context: null })),
      contract("coin", view(ME, "dso::1", "Amulet", "500.0000000000")),
      // a look-alike the instrument's admin did not sign is not a holding, whatever its view says
      contract("forged", view(ME, ADMIN, "AAPLt", "1000000.0000000000"), 1, 0, [ME, "attacker::1"]),
    ]);
    const body = await readHoldings({ client, party: ME, instruments: [{ admin: ADMIN, id: "AAPLt", symbol: TOKEN.symbol }], cluster: "devnet" as never, nowSec: 1_000 });
    expect(body.owner).toBe(ME);
    expect(body.holdings).toHaveLength(1);
    expect(body.holdings[0]).toMatchObject({
      mint: `AAPLt@${ADMIN}`, symbol: TOKEN.symbol, issuer: TOKEN.issuer, underlying: TOKEN.underlying, rawAmount: "17500000000", decimals: 10,
      multiplierE12: "1000000000000", sharesE8: "175000000", priceE8: null, exposureUsdE6: null,
    });
  });

  it("answers an empty list, truthfully, when the party holds none of a mapped instrument or none is mapped", async () => {
    const { client } = clientOf([contract("coin", view(ME, "dso::1", "Amulet", "500.0"))]);
    expect((await readHoldings({ client, party: ME, instruments: [{ admin: ADMIN, id: "AAPLt", symbol: TOKEN.symbol }], cluster: "devnet" as never, nowSec: 1 })).holdings).toEqual([]);
    expect((await readHoldings({ client, party: ME, instruments: [], cluster: "devnet" as never, nowSec: 1 })).holdings).toEqual([]);
  });

  it("rounds the share count down, never up", async () => {
    const { client } = clientOf([contract("a", view(ME, ADMIN, "AAPLt", "0.0000000199"))]);
    const body = await readHoldings({ client, party: ME, instruments: [{ admin: ADMIN, id: "AAPLt", symbol: TOKEN.symbol }], cluster: "devnet" as never, nowSec: 1 });
    expect(body.holdings[0]?.sharesE8).toBe("1");
  });

  it("parses the instrument map strictly and drops what it cannot trust", () => {
    const raw = JSON.stringify([{ admin: "a", id: "x", symbol: TOKEN.symbol }, { admin: "a", id: "y", symbol: "NOPE" }, { admin: "", id: "z", symbol: TOKEN.symbol }, 5, null]);
    expect(parseShareInstruments(raw)).toEqual([{ admin: "a", id: "x", symbol: TOKEN.symbol }]);
    expect(parseShareInstruments("not json")).toEqual([]);
    expect(parseShareInstruments("{}")).toEqual([]);
    expect(parseShareInstruments(undefined)).toEqual([]);
  });
});
