import { diagnosis, err, ok } from "@agari/core";
import { describe, expect, it } from "vitest";
import { indexStateOf } from "./index-state";
import type { PythIndexView } from "./usePythIndex";

const denied = { state: "denied" as const, status: 403, checkedAtSec: 1_791_251_453, reason: "pyth-indices" };
const view = (entitlement: PythIndexView["entitlement"], rows: PythIndexView["rows"] = {}): PythIndexView => ({ entitlement, rows });
const row = { indexE8: 1_015_657_000_000n, publishTimeSec: 1_791_251_400, ageSec: 3, fresh: true, tokenPriceE8: 1_127_380_000_000n, premiumBps: 1100 };

describe("C8d: why a valuation index is absent (D-125, D-015)", () => {
  it("is null while the first read is in flight", () => {
    expect(indexStateOf(null, "OPENAI")).toBeNull();
  });

  it("names the refusal, its status, its group and when it was checked, and the gate it waits on", () => {
    const state = indexStateOf(ok(view({ OPENAI: denied }), 0), "OPENAI");
    expect(state).toMatchObject({ kind: "absent", gate: "a Pyth key entitled to the pyth-indices group", checkedAtSec: denied.checkedAtSec });
    expect(state?.kind === "absent" && state.why).toBe("the venue's Pyth key may not read it (Hermes answered 403, group pyth-indices, checked 01:50 UTC)");
  });

  it("tells no key from no answer yet, and a failed read from both", () => {
    const noKey = indexStateOf(ok(view({ OPENAI: { state: "unknown", status: null, checkedAtSec: null, reason: "no PYTH_API_KEY" } }), 0), "OPENAI");
    expect(noKey?.kind === "absent" && noKey.why).toBe("no Pyth key is set on this venue");
    const pending = indexStateOf(ok(view({ OPENAI: { state: "unknown", status: null, checkedAtSec: null, reason: null } }), 0), "OPENAI");
    expect(pending?.kind === "absent" && pending.why).toBe("the venue has had no answer from Pyth yet");
    const failed = indexStateOf(err(diagnosis("unknown", "pyth-index route answered 502")), "OPENAI");
    expect(failed?.kind === "absent" && failed.why).toBe("the venue's index read failed just now");
  });

  it("shows the row only when ops published one: entitled without a print is still absent", () => {
    expect(indexStateOf(ok(view({ OPENAI: { ...denied, state: "entitled", status: 200, reason: null } }, { OPENAI: row }), 0), "OPENAI")).toEqual({ kind: "readable", row });
    const quiet = indexStateOf(ok(view({ OPENAI: { ...denied, state: "entitled", status: 200, reason: null } }), 0), "OPENAI");
    expect(quiet?.kind === "absent" && quiet.why).toBe("the index has not printed since the key was entitled");
  });
});
