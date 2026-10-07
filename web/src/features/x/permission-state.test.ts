import { diagnosis } from "@owarine/core/types";
import { describe, expect, it } from "vitest";
import { xPermissionOf, type PermissionInput } from "./permission-state";

const base: PermissionInput = { snapshot: null, readable: false, everRead: false, saved: null, pendingUpdate: null, current: null, executor: "executor::1220", nowSec: 1_790_000_000 };
const failed = (kind: "signer-required" | "rpc-down") => ({ ok: false as const, error: diagnosis(kind, "GET /agents/vault → 401") });

describe("the X card's permission state on a cold load (C8i)", () => {
  it("is checking before the first read answers", () => {
    expect(xPermissionOf(base)).toBe("checking");
  });

  it("stays checking when the first read went out before the seat's key signed (401), instead of flashing unavailable", () => {
    expect(xPermissionOf({ ...base, snapshot: failed("signer-required") })).toBe("checking");
  });

  it("says unavailable for a real outage, or a 401 after the seat was read once", () => {
    expect(xPermissionOf({ ...base, snapshot: failed("rpc-down") })).toBe("unavailable");
    expect(xPermissionOf({ ...base, snapshot: failed("signer-required"), everRead: true })).toBe("unavailable");
  });

  it("reads the grant once the vault is readable", () => {
    const snapshot = { ok: true as const, value: {}, asOfMs: 0, stale: false };
    expect(xPermissionOf({ ...base, snapshot, readable: true, everRead: true })).toBe("unfunded");
  });
});
