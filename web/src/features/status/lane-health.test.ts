import { describe, expect, it } from "vitest";
import type { OpsSession } from "./ops.server";
import { lanesRow } from "./probes-ops.server";

const row = (lanes: Record<string, string>, inSession = false) => lanesRow({
  session: { ok: true, value: { lanes } as OpsSession, latencyMs: 1 },
  health: { ok: false, why: "not needed", latencyMs: 0 },
  inSession,
});

describe("market availability after US stock hours", () => {
  it("does not hide crypto traffic failures behind the closed stock session", () => {
    expect(row({ "AAPL-15m": "closed: post", "BTC-2m": "paused: traffic (core lanes only)" })).toMatchObject({ ok: false, expected: false });
  });
  it("does not hide stale pre-IPO feeds or unavailable xStock sources", () => {
    expect(row({ "OPENAI-60m": "paused: halted (prestocks-stale)" })).toMatchObject({ ok: false, expected: false });
    expect(row({ "TSLAx-5m": "paused: no signed source" })).toMatchObject({ ok: false, expected: false });
  });
  it("treats ordinary closed stocks as expected without masking healthy crypto", () => {
    expect(row({ "AAPL-15m": "closed: post" })).toMatchObject({ ok: true, expected: true });
    expect(row({ "AAPL-15m": "closed: post", "BTC-2m": "open #7" })).toMatchObject({ ok: true, grade: "good", expected: false });
  });
  it("counts unavailable regular stocks during their trading session", () => {
    expect(row({ "AAPL-15m": "paused: no signed source" }, true)).toMatchObject({ ok: false, expected: false });
  });
});
