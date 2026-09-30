/**
 * `first-call.ts` without a ledger (C2z): the DevNet path's configuration, the drop-a-response proxy over real HTTP,
 * and the row rules. The DevNet drive itself is never run from here; these are the parts that decide what it would do.
 */
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { acceptanceRow } from "../../bootstrap/rows";
import { firstCallConfig, rowPrefix, staleBlocker, type FirstCallConfig } from "./config";
import { startDropProxy } from "./drop-proxy";

const home = "/Users/someone";
const repo = "/Users/someone/dev/hackcanton-pm";
const devnetEnv = {
  LEDGER_AUTH_MODE: "password",
  LEDGER_JSON_API_URL: "https://ledger-api-json.participant.example.invalid",
};
const cfg = (argv: string[], env: Record<string, string | undefined>) => firstCallConfig(argv, env, { home, repo });
const ok = (r: ReturnType<typeof cfg>): FirstCallConfig => {
  if ("error" in r) throw new Error(r.error);
  return r;
};

describe("first-call configuration", () => {
  it("defaults to the local rehearsal: sandbox, web :3120, ops :8727, the local parties file", () => {
    const c = ok(cfg([], {}));
    expect(c).toMatchObject({ network: "local", web: "http://localhost:3120", ops: "http://127.0.0.1:8727", partiesPath: `${home}/.config/agari/canton/parties.json`, lane: "BTC-1m", stage: "C2z" });
    expect([...c.steps]).toEqual(["main", "void", "stale"]);
  });

  it("devnet needs the platform token, an https ledger and an https web", () => {
    expect(cfg(["--network", "devnet", "--web", "https://pm.example.invalid"], { LEDGER_AUTH_MODE: "none", LEDGER_JSON_API_URL: "http://localhost:7525" })).toEqual({ error: expect.stringMatching(/LEDGER_AUTH_MODE=password/) });
    expect(cfg(["--network", "devnet", "--web", "https://pm.example.invalid"], { ...devnetEnv, LEDGER_JSON_API_URL: "http://plain.example.invalid" })).toEqual({ error: expect.stringMatching(/https LEDGER_JSON_API_URL/) });
    expect(cfg(["--network", "devnet"], devnetEnv)).toEqual({ error: expect.stringMatching(/web origin/) });
    expect(cfg(["--network", "devnet", "--web", "http://localhost:3120"], devnetEnv)).toEqual({ error: expect.stringMatching(/https/) });
  });

  it("devnet reads the parties file bootstrap-devnet wrote, and ops is not assumed reachable", () => {
    const c = ok(cfg(["--network", "devnet", "--web", "https://pm.example.invalid/"], { ...devnetEnv, AGARI_PARTIES_FILE: "/data/parties.json" }));
    expect(c.partiesPath).toBe(`${home}/.config/agari/canton/parties.devnet.json`);
    expect(c.web).toBe("https://pm.example.invalid");
    expect(c.ops).toBeNull();
    expect(rowPrefix(c.network)).toBe("first-call, DevNet: ");
  });

  it("never takes a parties file inside the repo, and expands ~", () => {
    expect(cfg(["--parties", `${repo}/parties.json`], {})).toEqual({ error: expect.stringMatching(/outside the repo/) });
    expect(ok(cfg(["--parties", "~/p.json"], {})).partiesPath).toBe(`${home}/p.json`);
  });

  it("signals a process only locally; DevNet stops pm-ops by hand", () => {
    expect(cfg(["--network", "devnet", "--web", "https://pm.example.invalid", "--ops-pid", "4242"], devnetEnv)).toEqual({ error: expect.stringMatching(/local only/) });
    expect(cfg(["--ops-pid", "1"], {})).toEqual({ error: expect.stringMatching(/process id/) });
    const devnet = ok(cfg(["--network", "devnet", "--web", "https://pm.example.invalid"], devnetEnv));
    expect(staleBlocker(devnet)).toMatch(/--only stale --ops-stopped/);
    expect(staleBlocker({ ...devnet, opsStopped: true })).toBeNull();
    expect(staleBlocker(ok(cfg([], {})))).toMatch(/--ops-pid/);
    expect(staleBlocker(ok(cfg(["--ops-pid", "4242"], {})))).toBeNull();
  });

  it("--only picks steps and refuses unknown ones", () => {
    expect([...ok(cfg(["--only", "main,void"], {})).steps]).toEqual(["main", "void"]);
    expect(cfg(["--only", "main,settle"], {})).toEqual({ error: expect.stringMatching(/settle/) });
    expect(cfg(["--network", "mainnet"], {})).toEqual({ error: expect.stringMatching(/local or devnet/) });
  });
});

describe("the drop-a-response proxy", () => {
  let target: Server;
  let url = "";
  const seen: Array<{ method: string; path: string; body: string; origin: string | undefined }> = [];
  beforeAll(async () => {
    target = createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      seen.push({ method: req.method!, path: req.url!, body: Buffer.concat(chunks).toString("utf8"), origin: req.headers.origin });
      await new Promise((r) => setTimeout(r, 50));
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ kind: "confirmed", updateId: "1220ab" }));
    });
    await new Promise<void>((ok) => target.listen(0, "127.0.0.1", ok));
    url = `http://127.0.0.1:${(target.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((ok) => target.close(() => ok())));

  it("forwards the whole request, lets the server answer, and kills the client's response", async () => {
    const proxy = await startDropProxy(url);
    const body = JSON.stringify({ commandId: "8d0f7f5e-2b9a-4c4e-9a52-1f2d3c4b5a69" });
    await expect(fetch(`${proxy.url}/api/ledger/quotes/00ab/accept`, { method: "POST", headers: { "content-type": "application/json", origin: "https://pm.example.invalid" }, body })).rejects.toThrow();
    await proxy.close();
    expect(seen).toEqual([{ method: "POST", path: "/api/ledger/quotes/00ab/accept", body, origin: "https://pm.example.invalid" }]);
    expect(proxy.dropped).toEqual([{ method: "POST", path: "/api/ledger/quotes/00ab/accept", status: 200 }]);
  });
});

describe("rows", () => {
  it("say which network they came from and carry no full party id", () => {
    const row = acceptanceRow({ check: "lease seat A (Alice) and seat B (Bob)", outcome: "pass", detail: "seat A → pm-seat-1::… lease L1", evidence: "POST /api/seat ×2" }, { stage: "C2z", commit: "abc1234", atIso: "2026-09-30T05:00:00.000Z", prefix: rowPrefix("local") });
    expect(row).toBe("| 2026-09-30T05:00:00.000Z | C2z | first-call, local rehearsal: lease seat A (Alice) and seat B (Bob) | — | abc1234 | POST /api/seat ×2 | pass: seat A → pm-seat-1::… lease L1 |");
    expect(row).not.toMatch(/::1220[0-9a-f]{64}/);
  });
});
