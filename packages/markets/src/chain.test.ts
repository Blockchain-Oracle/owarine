import { describe, expect, it } from "vitest";
import { networkLabel } from "./chain";
import { parseMarketsEnv } from "./env";
import { configureMarkets } from "./runtime/read-runtime";

/**
 * C4f, found by C11b: on a LocalNet build The Call read "CANTON DEVNET" and the web's welcome "This is Canton DevNet".
 * The label is the configured network's, with DevNet the default only when nothing else is configured.
 */
describe("networkLabel", () => {
  it("is DevNet before anything is configured and the build names no network", () => {
    const before = process.env.NEXT_PUBLIC_CANTON_NETWORK;
    delete process.env.NEXT_PUBLIC_CANTON_NETWORK;
    try {
      expect(networkLabel()).toBe("Canton DevNet");
    } finally {
      if (before !== undefined) process.env.NEXT_PUBLIC_CANTON_NETWORK = before;
    }
  });

  it("names the network the runtime was configured for (web NEXT_PUBLIC_*, phone EXPO_PUBLIC_*)", () => {
    configureMarkets(parseMarketsEnv({ cluster: "localnet" }));
    expect(networkLabel()).toBe("Canton LocalNet");
    configureMarkets(parseMarketsEnv({ cluster: "devnet" }));
    expect(networkLabel()).toBe("Canton DevNet");
    configureMarkets(parseMarketsEnv({ cluster: "testnet" }));
    expect(networkLabel()).toBe("Canton TestNet");
  });
});
