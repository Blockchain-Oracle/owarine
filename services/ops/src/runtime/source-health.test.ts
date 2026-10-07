import { describe, expect, it } from "vitest";
import { attestedPrintSource, EXCHANGE_PRINT_SOURCE } from "@owarine/core/market";
import { probeAll } from "../actors/source-probe";
import { createSourceHealthStore } from "./source-health";

describe("source health (C6)", () => {
  it("nothing lists on an unprobed source; exchanges and committees need no probe", () => {
    const store = createSourceHealthStore();
    expect(store.unavailable(EXCHANGE_PRINT_SOURCE)).toBeNull();
    expect(store.unavailable(attestedPrintSource("committee", "DEMO-1"))).toBeNull();
    expect(store.unavailable(attestedPrintSource("redstone", "TSLA"))).toBe("redstone not checked yet");
    expect(store.unavailable("pyth")).toBe('unknown print source "pyth"');
    store.set("redstone", { ok: true, reason: null, checkedAtSec: 1 });
    expect(store.unavailable(attestedPrintSource("redstone", "TSLA"))).toBeNull();
  });

  it("probes every source and records the honest reason for each one that cannot sign here", async () => {
    const store = createSourceHealthStore();
    const fetchImpl = (async (url: string) => {
      if (url.includes("crossbar")) return new Response(JSON.stringify([{ feedHash: "h", results: null, error: "Service unavailable: IPFS fetch temporarily unavailable" }]), { status: 200 });
      if (url.includes("prestocks")) return new Response("rate limited", { status: 429 });
      if (url.includes("gw.invalid.test")) return new Response("{\"TSLA\":[]}", { status: 200 });
      return new Response("{}", { status: 200 });
    }) as typeof fetch;
    const line = await probeAll(store, {
      sources: { gateways: ["https://gw.invalid.test"], pythFeeds: [] }, pythIndex: { hasKey: false, feeds: () => [] },
      switchboardFeeds: new Map([["TSLAX/USD", "h"]]), fetchImpl, nowSec: () => 100,
    });
    expect(store.get("pyth")).toEqual({ ok: false, reason: "PYTH_API_KEY is not set: Pyth Hermes answers 401 without a key", checkedAtSec: 100 });
    expect(store.get("pyth-index")?.reason).toBe("Pyth feed not entitled (no PYTH_API_KEY)");
    expect(store.get("switchboard")?.reason).toBe("Switchboard Surge TSLAX/USD: crossbar: Service unavailable: IPFS fetch temporarily unavailable");
    expect(store.get("prestocks")?.reason).toMatch(/^PreStocks catalogue: .*429/);
    expect(store.get("redstone")).toEqual({ ok: true, reason: null, checkedAtSec: 100 });
    expect(line).toContain("switchboard down");
  });
});
