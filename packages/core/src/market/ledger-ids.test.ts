import { describe, expect, it } from "vitest";
import { isAddress, isMarketId } from "../types";
import { marketIdFromDaml, seriesIdFromDaml } from "./ledger-ids";

describe("ledger ids", () => {
  it("pins marketIdFromDaml: base58(sha256('agari/market-id/v1:' + text)), unchanged from C4a's appMarketId", () => {
    expect(marketIdFromDaml("BTC-300:12")).toBe("GAMChwcLrzqMGpUs32NDt6LKNTQ5DzbcSQKcThGk9Qmb");
    expect(isMarketId(marketIdFromDaml("BTC-300:12"))).toBe(true);
    expect(marketIdFromDaml("BTC-300:13")).not.toBe(marketIdFromDaml("BTC-300:12"));
  });

  it("pins seriesIdFromDaml under its own domain tag", () => {
    expect(seriesIdFromDaml("BTC-300")).toBe("6nW79H2CfVZiDVxHZMLEMvyBbPpyZwjvH2kCR5DFdSFd");
    expect(isAddress(seriesIdFromDaml("BTC-300"))).toBe(true);
    expect(seriesIdFromDaml("BTC-300")).not.toBe(marketIdFromDaml("BTC-300"));
  });

  it("refuses empty text", () => {
    expect(() => marketIdFromDaml("")).toThrow();
    expect(() => seriesIdFromDaml("")).toThrow();
  });
});
