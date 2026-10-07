import { parseMarketsEnv } from "@owarine/markets/env";
import { configureMarkets } from "@owarine/markets/runtime";
import { describe, expect, it } from "vitest";
import { tourNetworkNote } from "../terminal/ui/sheets/tour-copy";
import { SHARE } from "./copy";

/** C4f: The Call, the cards' posts and the welcome name the configured network, and a void's line pays what the Daml pays. */
describe("the network the cards and the welcome name (C4f)", () => {
  it("says LocalNet on a LocalNet build, never DevNet", () => {
    configureMarkets(parseMarketsEnv({ cluster: "localnet" }));
    expect(SHARE.call.recordType).toBe("THE CALL · CANTON LOCALNET");
    expect(SHARE.network).toBe("CANTON LOCALNET");
    expect(SHARE.call.tweet("BTC over 85,000", "1m", "0.66", "1.00", "credits", "10:01 UTC")).toContain("on Canton LocalNet.");
    expect(SHARE.trade.tweet("-0.66", "credits", "BTC", "UP", "lost", "0.66", "0.00")).toContain("(Canton LocalNet)");
    expect(tourNetworkNote()).toBe("This is Canton LocalNet: demo credits only, no real money.");
  });

  it("says DevNet where DevNet is configured", () => {
    configureMarkets(parseMarketsEnv({ cluster: "devnet" }));
    expect(SHARE.call.recordType).toBe("THE CALL · CANTON DEVNET");
    expect(tourNetworkNote()).toContain("This is Canton DevNet:");
  });

  it("prints a void as stake and fee returned, never half a contract (K-290)", () => {
    expect(SHARE.trade.voided("10:01 UTC", null)).toBe("VOIDED · STAKE AND FEE RETURNED · 10:01 UTC");
  });
});
