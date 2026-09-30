import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CANTON_ROLES } from "../../runtime/keys";
import { createVenueContext } from "./context";

/** C2y: ops on Noders DevNet reads the same parties file as the web and authenticates with a password grant. */
describe("the venue context on DevNet (C2y)", () => {
  it("builds a token-authenticated client and a session per role from the DevNet parties file", () => {
    const party = (r: string, i: number) => `pm-${r}::1220${i.toString(16).padStart(64, "0")}`;
    const path = join(mkdtempSync(join(tmpdir(), "ops-devnet-")), "parties.devnet.json");
    writeFileSync(path, JSON.stringify({ network: "devnet", createdAtMs: 1, parties: Object.fromEntries(CANTON_ROLES.map((r, i) => [r, party(r, i + 1)])), users: {}, policyVersion: 1 }));
    const ctx = createVenueContext({
      AGARI_PARTIES_FILE: path,
      DRY_RUN: "1",
      LEDGER_JSON_API_URL: "https://ledger-api-json.participant.example.test",
      LEDGER_AUTH_MODE: "password",
      LEDGER_OIDC_TOKEN_URL: "https://auth.example.test/realms/r/protocol/openid-connect/token",
      LEDGER_OIDC_CLIENT_ID: "client",
      LEDGER_OIDC_USERNAME: "ops-user",
      LEDGER_OIDC_PASSWORD: "ops-password-value",
    });
    expect(ctx.client.auth.mode).toBe("password");
    expect(ctx.session("venue")?.party).toBe(party("venue", 1));
    expect(ctx.session("oracle-bitstamp")?.dryRun).toBe(true);
    expect(ctx.summary).toBe("ledger https://ledger-api-json.participant.example.test (password), DRY RUN, parties 8/8");
    expect(ctx.summary).not.toContain("ops-password-value");
  });
});
