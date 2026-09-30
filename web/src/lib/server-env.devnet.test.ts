import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseLedgerEnv } from "@agari/ledger";
import { checkWebServerEnv, seatParties } from "./server-env";

/**
 * C2y: the web on Noders DevNet. The same variables as locally, with `LEDGER_AUTH_MODE=password` and the parties file
 * `scripts/bootstrap-devnet.ts` writes (K-026 shape, `network: "devnet"`).
 */
const p = (n: string, i: number) => `${n}::1220${i.toString(16).padStart(64, "0")}`;

function devnetParties(): string {
  const path = join(mkdtempSync(join(tmpdir(), "parties-devnet-")), "parties.devnet.json");
  const roles = ["venue", "resolver", "oracle-coinbase", "oracle-kraken", "oracle-bitstamp", "auditor", "lp", "agent-runner"];
  writeFileSync(path, JSON.stringify({
    network: "devnet",
    createdAtMs: 1,
    parties: Object.fromEntries(roles.map((r, i) => [r, p(`pm-${r}`, i + 1)])),
    users: { alice: p("pm-alice", 100), bob: p("pm-bob", 101), outsider: p("pm-outsider", 102), "seat-1": p("pm-seat-1", 201), "seat-2": p("pm-seat-2", 202) },
    policyVersion: 1,
  }));
  return path;
}

const devnetEnv = () => ({
  DATABASE_URL: "postgres://pm:pm@db:5432/pm",
  AGARI_SEAT_COOKIE_SECRET: "c".repeat(32),
  OPS_INTERNAL_URL: "http://ops:8080",
  OPS_INTERNAL_SECRET: "s".repeat(32),
  AGARI_PARTIES_FILE: devnetParties(),
  LEDGER_JSON_API_URL: "https://ledger-api-json.participant.example.test",
  LEDGER_AUTH_MODE: "password",
  LEDGER_OIDC_TOKEN_URL: "https://auth.example.test/realms/r/protocol/openid-connect/token",
  LEDGER_OIDC_CLIENT_ID: "client",
  LEDGER_OIDC_USERNAME: "user",
  LEDGER_OIDC_PASSWORD: "a-password-value",
});

describe("the web's DevNet configuration (C2y)", () => {
  it("boots with token auth and the DevNet parties file", () => {
    const env = devnetEnv();
    const { problems } = checkWebServerEnv(env);
    expect(problems).toEqual([]);
    expect(parseLedgerEnv(env).LEDGER_AUTH_MODE).toBe("password");
    const parties = seatParties(checkWebServerEnv(env).env!);
    expect(parties.venue).toBe(p("pm-venue", 1));
    expect(parties.agentRunner).toBe(p("pm-agent-runner", 8));
    expect(parties.oracles).toHaveLength(3);
    expect(parties.seats).toEqual([p("pm-seat-1", 201), p("pm-seat-2", 202)]);
  });

  it("names a missing credential variable, never a value", () => {
    const env: Record<string, string | undefined> = devnetEnv();
    delete env.LEDGER_OIDC_PASSWORD;
    const { problems } = checkWebServerEnv(env);
    expect(problems.some((x) => x.startsWith("LEDGER_OIDC_PASSWORD"))).toBe(true);
    expect(problems.join(" ")).not.toContain("user");
  });
});
