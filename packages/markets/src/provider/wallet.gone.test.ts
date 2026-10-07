import { afterEach, describe, expect, it, vi } from "vitest";
import { parseMarketsEnv } from "../env";
import { configureMarkets } from "../runtime/read-runtime";
import { getBalanceSheet, listOpenPositions } from "./wallet";

/**
 * C4f, found by C11b: a browser joined to a phone's seat kept showing 998.29 after the phone reset the seat. `/api/seat`
 * said `none` and `/me/balance` answered 401, but a failed refresh kept its last good value (marked stale). A refusal of
 * who is asking is not an outage: the money belongs to a seat this device no longer holds.
 */
const WALLET = "4UzR1111111111111111111111111111111111j6aD" as never;
const balance = { decimals: 6, spendableBase: "998295536", nativeLamports: "0", orderEscrowBase: "0", venueCreditBase: "0", venueCreditByMarket: [], vaultBase: null };

function answers(...replies: Array<{ status: number; body: unknown }>): void {
  let i = 0;
  vi.stubGlobal("fetch", async () => {
    const r = replies[Math.min(i++, replies.length - 1)]!;
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { "content-type": "application/json" } });
  });
}

const leased = (value: unknown) => ({ status: 200, body: { value, address: WALLET, party: "owarine-user-seat-1::1220", offset: 9 } });
const refused = (status: number, kind: string) => ({ status, body: { diagnosis: { kind, retryable: false, technical: "this seat's lease has ended; take a seat again" } } });

afterEach(() => vi.unstubAllGlobals());

describe("a seat that is gone never shows its money (C4f)", () => {
  it("drops the last balance when the seat route refuses the caller", async () => {
    configureMarkets(parseMarketsEnv({ cluster: "localnet", ledgerApiPath: "https://site.test/api/ledger" }));
    answers(leased(balance), refused(401, "signer-required"));
    const first = await getBalanceSheet(WALLET);
    expect(first.ok && first.value.spendableBase).toBe(998_295_536n);
    const after = await getBalanceSheet(WALLET);
    expect(after.ok).toBe(false);
    expect(!after.ok && after.error.kind).toBe("signer-required");
  });

  it("does not bring the old balance back on a later outage", async () => {
    configureMarkets(parseMarketsEnv({ cluster: "localnet", ledgerApiPath: "https://site.test/api/ledger" }));
    answers(leased(balance), refused(401, "signer-required"), { status: 503, body: null });
    await getBalanceSheet(WALLET);
    await getBalanceSheet(WALLET);
    const outage = await getBalanceSheet(WALLET);
    expect(outage.ok).toBe(false);
  });

  it("still keeps the last good value, marked stale, through an outage", async () => {
    configureMarkets(parseMarketsEnv({ cluster: "localnet", ledgerApiPath: "https://site.test/api/ledger" }));
    answers(leased([]), { status: 503, body: null });
    await listOpenPositions(WALLET);
    const outage = await listOpenPositions(WALLET);
    expect(outage.ok && outage.stale).toBe(true);
  });
});
