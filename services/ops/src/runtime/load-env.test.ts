import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadEnvFiles } from "./load-env";

describe("ops env files", () => {
  const dir = mkdtempSync(join(tmpdir(), "ops-env-"));
  const ops = join(dir, "ops.env");
  const root = join(dir, "root.env");
  writeFileSync(ops, "ALPACA_KEY_ID=from-ops\nFINNHUB_API_KEY=from-ops\n");
  writeFileSync(root, "ALPACA_KEY_ID=from-root\nPYTH_API_KEY=from-root\n");

  it("takes missing variables, the ops file before the root one, and never overrides the environment", () => {
    const env: NodeJS.ProcessEnv = { FINNHUB_API_KEY: "explicit", PYTH_API_KEY: "" };
    const loaded = loadEnvFiles([ops, join(dir, "missing.env"), root], env);
    expect(env).toEqual({ ALPACA_KEY_ID: "from-ops", FINNHUB_API_KEY: "explicit", PYTH_API_KEY: "" });
    // Names only, and a missing file is skipped.
    expect(loaded).toEqual([{ path: ops, taken: ["ALPACA_KEY_ID"] }, { path: root, taken: [] }]);
  });
});
