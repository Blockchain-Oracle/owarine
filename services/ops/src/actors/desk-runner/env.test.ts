import { describe, expect, it } from "vitest";
import { clusterOf, readDeskRunnerEnv } from "./env";

const env = (vars: Record<string, string>) => vars as NodeJS.ProcessEnv;

describe("the desk runner's network (C8i): a Canton desk is on this deployment's network", () => {
  it("follows ops' own Canton network, so it runs the desks the web writes under that network", () => {
    expect(clusterOf(env({ NEXT_PUBLIC_CANTON_NETWORK: "localnet" }))).toBe("localnet");
    expect(clusterOf(env({ NEXT_PUBLIC_CANTON_NETWORK: "testnet" }))).toBe("testnet");
    expect(clusterOf(env({ DESK_CLUSTER: "devnet", NEXT_PUBLIC_CANTON_NETWORK: "localnet" }))).toBe("devnet");
  });

  it("never falls back to mainnet: with nothing set it is DevNet, like every other agent in ops", () => {
    expect(clusterOf(env({}))).toBe("devnet");
    expect(clusterOf(env({ DESK_CLUSTER: "mainnet-beta" }))).toBe("devnet");
  });

  it("honours DESK_MODEL_STUB on a LocalNet deployment without a separate DESK_CLUSTER", () => {
    const local = readDeskRunnerEnv(env({ NEXT_PUBLIC_CANTON_NETWORK: "localnet", DESK_MODEL_STUB: "ACT_NOW" }));
    expect(local.cluster).toBe("localnet");
    expect(local.modelStub).toBe("ACT_NOW");
  });

  it("never reads the stub on any other network", () => {
    for (const net of ["devnet", "testnet", "mainnet"]) {
      expect(readDeskRunnerEnv(env({ NEXT_PUBLIC_CANTON_NETWORK: net, DESK_MODEL_STUB: "ACT_NOW" })).modelStub).toBeUndefined();
    }
    expect(readDeskRunnerEnv(env({ NEXT_PUBLIC_CANTON_NETWORK: "localnet", DESK_MODEL_STUB: "YES" })).modelStub).toBeUndefined();
  });
});
