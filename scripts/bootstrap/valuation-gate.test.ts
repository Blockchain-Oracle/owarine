import { describe, expect, it, vi } from "vitest";
import { valuationGate, valuationRefusal } from "./valuation-gate";

/** C8j.2 (D-125): `--lanes valuation` registers nothing while the venue's Pyth key is refused an index. */
const refused = () => new Response('requires access to one of the following groups: ["pyth-indices"]', { status: 403 });
const answered = (url: string) => {
  const id = /ids\[\]=([0-9a-f]+)/.exec(url)![1]!;
  return new Response(JSON.stringify({ parsed: [{ id, price: { price: "140000000000", conf: "70000000", expo: -8, publish_time: 1_790_755_000 }, metadata: { prev_publish_time: 1_790_754_999 } }] }), { status: 200 });
};

describe("valuation lanes at registration (C8j.2)", () => {
  it("probes nothing when valuation is not among the lanes", async () => {
    const fetch = vi.fn();
    expect(await valuationGate(new Set(["crypto", "preipo", "basket"]), { key: "k", fetch })).toEqual({ requested: false, entitled: true, lines: [] });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("refuses on 403 pyth-indices, as 2026-09-30's probe answered, and never prints the key", async () => {
    const fetch = vi.fn(async () => refused());
    const gate = await valuationGate(new Set(["preipo", "valuation"]), { key: "secret-key-value", fetch: fetch as unknown as typeof globalThis.fetch });
    expect(gate).toMatchObject({ requested: true, entitled: false });
    expect(gate.lines).toEqual(["OPENAI denied (403 pyth-indices)", "ANTHROPIC denied (403 pyth-indices)"]);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(valuationRefusal(gate)).toMatch(/^refusing --lanes valuation: .*OPENAI denied \(403 pyth-indices\)/);
    expect(valuationRefusal(gate)).not.toContain("secret-key-value");
  });

  it("refuses without a key, and sends nothing", async () => {
    const fetch = vi.fn();
    const gate = await valuationGate(new Set(["valuation"]), { key: undefined, fetch });
    expect(gate.entitled).toBe(false);
    expect(gate.lines).toEqual(["OPENAI unknown (no PYTH_API_KEY)", "ANTHROPIC unknown (no PYTH_API_KEY)"]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("lets the lanes register once every index answers 200", async () => {
    const fetch = vi.fn(async (url: string) => answered(url));
    const gate = await valuationGate(new Set(["valuation"]), { key: "k", fetch: fetch as unknown as typeof globalThis.fetch });
    expect(gate.entitled).toBe(true);
    expect(gate.lines[0]).toMatch(/^OPENAI entitled \(200, publishes every 1 s/);
  });

  it("refuses when one index is refused and the other answers", async () => {
    let n = 0;
    const fetch = vi.fn(async (url: string) => (n++ === 0 ? answered(url) : refused()));
    const gate = await valuationGate(new Set(["valuation"]), { key: "k", fetch: fetch as unknown as typeof globalThis.fetch });
    expect(gate.entitled).toBe(false);
  });
});
