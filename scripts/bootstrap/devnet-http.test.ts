/**
 * The DevNet checks and the preflight against a fake Keycloak and a fake participant over real HTTP (C2y): the whole
 * auth path of `@agari/ledger` (password grant, bearer header, 401 handling) runs as it will against Noders.
 */
import { mkdtempSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createLedgerClient, passwordGrant } from "@agari/ledger";
import { CANTON_ROLES } from "../../services/ops/src/runtime/keys";
import { verifyPackages, verifyParties } from "./devnet-checks";
import { hintFor, parseDevnetParties } from "./devnet-parties";
import { runPreflight } from "./preflight";
import { fakeDar } from "./zip.fixture";

const USERNAME = "abu-hackcanton";
const PASSWORD = "correct-horse-battery";
const SUB = "5c1f0e3a-ledger-user";
const PKG = "cd".repeat(32);
const id = (hint: string, n: number) => `${hint}::1220${n.toString(16).padStart(64, "0")}`;

const partiesJson = {
  network: "devnet",
  parties: Object.fromEntries(CANTON_ROLES.map((r, i) => [r, id(hintFor(r), i + 1)])),
  users: { alice: id("pm-alice", 100), bob: id("pm-bob", 101), outsider: id("pm-outsider", 102), "seat-1": id("pm-seat-1", 201), "seat-2": id("pm-seat-2", 202) },
};
const file = parseDevnetParties(JSON.stringify(partiesJson), { seats: 2 }).file;
const allParties = [...Object.values(partiesJson.parties), ...Object.values(partiesJson.users)];

/** What the fake node saw and how it behaves. */
const node = {
  grants: 0,
  live: new Set<string>(),
  singleSession: false,
  hosted: new Set<string>(),
  actAs: new Set<string>(),
  enumerations: [] as string[],
  partyLookupsForbidden: false,
};

function jwt(n: number): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const iat = 1_790_000_000 + n;
  return `${b64({ alg: "RS256" })}.${b64({ sub: SUB, iat, exp: iat + 10_800, aud: "https://canton.network.global", n })}.sig`;
}

function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  res.writeHead(status, { "content-type": "application/json", ...headers });
  res.end(JSON.stringify(body));
}

const cantonError = (code: string, cause: string) => ({ code, cause, correlationId: null, traceId: "0af7651916cd43dd8448eb211c80319c", context: {}, resources: [], errorCategory: 11, grpcCodeValue: 5, retryInfo: null, definiteAnswer: null });

async function handle(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url!, "http://x");
  const body = await new Promise<string>((r) => {
    let s = "";
    req.on("data", (c) => (s += c));
    req.on("end", () => r(s));
  });
  if (req.method === "POST" && url.pathname === "/realms/hackcanton/protocol/openid-connect/token") {
    const form = new URLSearchParams(body);
    if (form.get("grant_type") !== "password" || form.get("username") !== USERNAME || form.get("password") !== PASSWORD) {
      return send(res, 401, { error: "invalid_grant", error_description: "Invalid user credentials" });
    }
    const token = jwt(++node.grants);
    if (node.singleSession) node.live.clear();
    node.live.add(token);
    return send(res, 200, { access_token: token, expires_in: 10_800, refresh_token: "offline-refresh", token_type: "Bearer" });
  }
  if (req.method === "OPTIONS") {
    res.writeHead(204, { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, content-type", "access-control-allow-methods": "GET, POST" });
    return res.end();
  }
  if (url.pathname === "/v2/version") return send(res, 200, { version: "3.5.18", features: {} }, { "access-control-allow-origin": "*" });
  const auth = req.headers.authorization?.replace(/^Bearer /, "");
  if (!auth || !node.live.has(auth)) return send(res, 401, cantonError("UNAUTHENTICATED", "invalid token"));
  if (url.pathname === "/v2/users" || (url.pathname === "/v2/parties" && !url.searchParams.get("filter-party"))) {
    node.enumerations.push(url.pathname);
    return send(res, 403, cantonError("PERMISSION_DENIED", "no"));
  }
  if (url.pathname === "/v2/authenticated-user") return send(res, 200, { user: { id: SUB, primaryParty: partiesJson.parties.venue, isDeactivated: false } });
  if (url.pathname === `/v2/users/${SUB}/rights`) {
    return send(res, 200, { rights: [...node.actAs].map((party) => ({ kind: { CanActAs: { value: { party } } } })) });
  }
  if (url.pathname.startsWith("/v2/parties/")) {
    if (node.partyLookupsForbidden) return send(res, 403, cantonError("PERMISSION_DENIED", "admin only"));
    const party = decodeURIComponent(url.pathname.slice("/v2/parties/".length));
    return node.hosted.has(party) ? send(res, 200, { partyDetails: [{ party, isLocal: true, identityProviderId: "" }] }) : send(res, 404, cantonError("PARTY_NOT_FOUND", "unknown"));
  }
  if (url.pathname === "/v2/state/connected-synchronizers") {
    return send(res, 200, { connectedSynchronizers: [{ synchronizerAlias: "global", synchronizerId: `global-domain::1220${"e".repeat(64)}`, permission: "PARTICIPANT_PERMISSION_SUBMISSION" }] });
  }
  if (url.pathname === "/v2/packages") return send(res, 200, { packageIds: [PKG, "ff".repeat(32)] });
  if (url.pathname === `/v2/packages/${PKG}/status`) return send(res, 200, { packageStatus: "PACKAGE_STATUS_REGISTERED" });
  return send(res, 404, cantonError("NOT_FOUND", url.pathname));
}

let server: Server;
let base: string;
let env: Record<string, string>;

beforeAll(async () => {
  server = createServer((req, res) => void handle(req, res));
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  env = {
    // The schema wants https for the realm; the test's fetch rewrites it to the fake server.
    LEDGER_OIDC_TOKEN_URL: "https://auth.example.test/realms/hackcanton/protocol/openid-connect/token",
    LEDGER_OIDC_CLIENT_ID: "hackcanton-client",
    LEDGER_OIDC_USERNAME: USERNAME,
    LEDGER_OIDC_PASSWORD: PASSWORD,
  };
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));
beforeEach(() => {
  Object.assign(node, { grants: 0, singleSession: false, partyLookupsForbidden: false, enumerations: [] });
  node.live = new Set();
  node.hosted = new Set(allParties);
  node.actAs = new Set(allParties);
});

/** Real fetch, with the realm's https URL pointed at the fake server. */
const viaFake: typeof fetch = (input, init) => {
  const u = String(input instanceof Request ? input.url : input).replace("https://auth.example.test", base);
  return fetch(u, init);
};

describe("devnet preflight over HTTP", () => {
  it("passes every check on a well-behaved node and prints no secret", async () => {
    const rows = await runPreflight({ baseUrl: base, origin: "https://agari.example", env, parties: file, fetch: viaFake });
    const byCheck = Object.fromEntries(rows.map((r) => [r.check, r]));
    expect(rows.map((r) => r.outcome)).toEqual(Array(rows.length).fill("pass"));
    expect(byCheck["GET /v2/version (no token)"]!.detail).toBe("Canton 3.5.18");
    expect(byCheck["token grant"]!.detail).toMatch(/lifetime 10800 s \(3\.00 h\)/);
    expect(byCheck["ledger user"]!.detail).toBe(`user ${SUB}; primary party pm-venue::…`);
    expect(byCheck["ledger user rights"]!.detail).toMatch(/act-as over 13 of our 13 parties/);
    expect(byCheck["connected synchronizer"]!.detail).toMatch(/^global: global-domain::1220e+ \(PARTICIPANT_PERMISSION_SUBMISSION\)$/);
    expect(node.grants).toBe(2); // the first session and the concurrent-session probe
    expect(node.enumerations).toEqual([]);
    const printed = JSON.stringify(rows);
    for (const secret of [PASSWORD, USERNAME, "offline-refresh", jwt(1), jwt(2), "1220000000"]) expect(printed).not.toContain(secret);
  });

  it("names K-035 option B when the realm keeps one session per login", async () => {
    node.singleSession = true;
    const rows = await runPreflight({ baseUrl: base, origin: "https://agari.example", env, fetch: viaFake });
    const row = rows.find((r) => r.check === "concurrent sessions")!;
    expect(row.outcome).toBe("fail");
    expect(row.detail).toMatch(/option B .* is forced/);
  });

  it("without credentials checks only the public endpoints", async () => {
    const rows = await runPreflight({ baseUrl: base, origin: "https://agari.example", env: {}, fetch: viaFake });
    expect(rows.slice(0, 2).map((r) => r.outcome)).toEqual(["pass", "pass"]);
    expect(rows.slice(2).every((r) => r.outcome === "skip")).toBe(true);
    expect(node.grants).toBe(0);
  });

  it("reports a refused grant without echoing the credential", async () => {
    const rows = await runPreflight({ baseUrl: base, origin: "https://agari.example", env: { ...env, LEDGER_OIDC_PASSWORD: "wrong-password" }, fetch: viaFake });
    const row = rows.find((r) => r.check === "token grant")!;
    expect(row.outcome).toBe("fail");
    expect(row.detail).toMatch(/401 invalid_grant/);
    expect(JSON.stringify(rows)).not.toContain("wrong-password");
  });
});

describe("devnet party and package checks over HTTP", () => {
  const client = () =>
    createLedgerClient(
      { baseUrl: base, auth: passwordGrant({ tokenUrl: env.LEDGER_OIDC_TOKEN_URL!, clientId: "c", username: USERNAME, password: PASSWORD, scope: "openid daml_ledger_api" }, { fetch: viaFake }), maxAttempts: 1 },
      { fetch: viaFake },
    );

  it("checks each party by id, never enumerating, and fails a party without act-as or unknown to the node", async () => {
    node.actAs.delete(partiesJson.users["seat-2"]);
    node.hosted.delete(partiesJson.parties.lp!);
    const rows = await verifyParties(client(), file, { rightsOf: SUB });
    expect(rows[0]).toMatchObject({ check: "ledger user rights", outcome: "pass" });
    const fails = rows.filter((r) => r.outcome === "fail").map((r) => r.check);
    expect(fails).toEqual(["party lp (pm-lp::…)", "party seat-2 (pm-seat-2::…)"]);
    expect(rows.find((r) => r.check.startsWith("party seat-2"))!.detail).toMatch(/cannot act as it/);
    expect(rows.filter((r) => r.outcome === "pass")).toHaveLength(12);
    expect(node.enumerations).toEqual([]);
    expect(node.grants).toBe(1); // one grant for the whole run (single-flight)
  });

  it("treats admin-only party details as a note when the rights prove act-as", async () => {
    node.partyLookupsForbidden = true;
    const rows = await verifyParties(client(), file, { rightsOf: SUB });
    expect(rows.slice(1).every((r) => r.outcome === "warn")).toBe(true);
  });

  it("matches each built DAR's main package id against /v2/packages", async () => {
    const dir = mkdtempSync(join(tmpdir(), "c2y-dar-"));
    const good = join(dir, "abu-pm-main-0.5.0.dar");
    const stale = join(dir, "abu-pm-tickets-0.2.0.dar");
    writeFileSync(good, fakeDar("abu-pm-main", "0.5.0", PKG));
    writeFileSync(stale, fakeDar("abu-pm-tickets", "0.2.0", "01".repeat(32)));
    const rows = await verifyPackages(client(), [
      { name: "abu-pm-main", version: "0.5.0", path: good },
      { name: "abu-pm-tickets", version: "0.2.0", path: stale },
      { name: "abu-pm-games", version: "0.2.0", path: undefined },
    ]);
    expect(rows.map((r) => [r.check, r.outcome])).toEqual([
      ["package abu-pm-main 0.5.0", "pass"],
      ["package abu-pm-tickets 0.2.0", "fail"],
      ["package abu-pm-games 0.2.0", "fail"],
    ]);
    expect(rows[0]!.detail).toBe(`id ${PKG.slice(0, 12)}… PACKAGE_STATUS_REGISTERED`);
    expect(rows[1]!.detail).toMatch(/not on the participant/);
  });
});
