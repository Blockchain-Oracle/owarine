import { describe, expect, it } from "vitest";
import {
  InvalidLedgerStringError,
  assertCommandId,
  isLedgerString,
  journalCommandId,
  openWindowCommandId,
  printCommandId,
  resolveCommandId,
} from "./ids";

describe("command ids", () => {
  it("builds the plan's stable ids", () => {
    expect(openWindowCommandId("btc-5m", 42)).toBe("open:btc-5m:42");
    expect(printCommandId("coinbase", 1_790_000_000n)).toBe("print:coinbase:1790000000");
    const cid = "00" + "ab".repeat(68);
    expect(resolveCommandId(cid)).toBe(`resolve:${cid}`);
    expect(journalCommandId("accept", "3f2c1e7a-9b1d-4c1e-8f7a-2b9c0d1e2f3a")).toBe("accept:3f2c1e7a-9b1d-4c1e-8f7a-2b9c0d1e2f3a");
  });
  it("enforces the ledger-string charset and 255-char limit", () => {
    expect(isLedgerString("a".repeat(255))).toBe(true);
    expect(isLedgerString("a".repeat(256))).toBe(false);
    expect(() => assertCommandId("probe 3!")).toThrow(/"!"/);
    expect(() => assertCommandId("x.y")).toThrow(InvalidLedgerStringError); // '.' is not allowed
    expect(() => assertCommandId("")).toThrow(/empty/);
    expect(() => resolveCommandId("a".repeat(250))).toThrow(/limit is 255/);
  });
  it("rejects separators and bad numbers inside components", () => {
    expect(() => openWindowCommandId("a:b", 1)).toThrow(/':'/);
    expect(() => openWindowCommandId("s", -1)).toThrow(/non-negative/);
    expect(() => printCommandId("kraken", 1.5)).toThrow(/non-negative integer/);
  });
});
