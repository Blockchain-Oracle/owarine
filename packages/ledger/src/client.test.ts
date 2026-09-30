import { describe, expect, it, vi } from "vitest";
import { noAuth, passwordGrant } from "./auth";
import { createLedgerClient, eventFormat } from "./client";
import { LedgerError, errorFromResponse, parseRetryInfo } from "./errors";

// Bodies captured from a Canton 3.5.17 sandbox on 2026-09-29 (party ids shortened).
const DUPLICATE = {
  code: "DUPLICATE_COMMAND",
  cause: "Command submission already exists.",
  correlationId: null,
  traceId: "9e8dd71fcd18d2ef4ad96baafa834534",
  context: {
    participant: "sandbox",
    changeId: "ChangeId(agari-ops,probe-1,Set(probeA::1220))",
    completion_offset: "12",
    accepted: "true",
    category: "10",
    tid: "9e8dd71fcd18d2ef4ad96baafa834534",
    definite_answer: "true",
    existingSubmissionId: "Some(s1)",
  },
  resources: [],
  errorCategory: 10,
  grpcCodeValue: 6,
  retryInfo: null,
  definiteAnswer: null,
};
const INVALID_TOKEN = {
  code: "INVALID_TOKEN",
  cause: "The submitted request is missing a user-id",
  correlationId: null,
  traceId: "a49a",
  context: { definite_answer: "false", category: "8" },
  resources: [],
  errorCategory: 8,
  grpcCodeValue: 3,
  retryInfo: null,
  definiteAnswer: null,
};
const TRANSIENT = { ...INVALID_TOKEN, code: "SERVER_IS_SHUTTING_DOWN", errorCategory: 1, retryInfo: "1 second" };

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const TX = { updateId: "u1", commandId: "c1", effectiveAt: "", events: [], offset: 12, synchronizerId: "s", recordTime: "" };

function client(fetch: (url: string, init: RequestInit) => Promise<Response>, auth = noAuth()) {
  return createLedgerClient(
    { baseUrl: "http://ledger.test/", auth, userId: "agari-ops", maxAttempts: 4 },
    { fetch: fetch as unknown as typeof globalThis.fetch, sleep: async () => {}, random: () => 0 },
  );
}

describe("error mapping", () => {
  it("maps real Canton bodies to typed errors", () => {
    const dup = errorFromResponse("/p", 409, "application/json", JSON.stringify(DUPLICATE));
    expect(dup).toMatchObject({ kind: "duplicate", code: "DUPLICATE_COMMAND", errorCategory: 10, definiteAnswer: true, traceId: DUPLICATE.traceId });
    expect(dup.duplicateCompletionOffset).toBe(12);
    expect(dup.diagnosis).toBe("send-unknown");
    expect(errorFromResponse("/p", 400, "application/json", JSON.stringify(INVALID_TOKEN)).kind).toBe("auth");
    const t = errorFromResponse("/p", 503, "application/json", JSON.stringify(TRANSIENT));
    expect([t.kind, t.retryable, t.retryAfterMs, t.diagnosis]).toEqual(["unavailable", true, 1000, "rpc-down"]);
  });
  it("413 suggests paging; 400 text/plain is a schema error", () => {
    const big = errorFromResponse("/v2/state/active-contracts", 413, "application/json", "{}");
    expect(big.kind).toBe("too-large");
    expect(big.message).toMatch(/activeContractsPage/);
    const schema = errorFromResponse("/p", 400, "text/plain", "Invalid value for: body (Missing required field at 'commands')");
    expect([schema.kind, schema.retryable]).toEqual(["schema", false]);
  });
  it("parses retryInfo units", () => {
    expect(parseRetryInfo("500 milliseconds")).toBe(500);
    expect(parseRetryInfo("2 seconds")).toBe(2000);
    expect(parseRetryInfo("1 minute")).toBe(60_000);
    expect(parseRetryInfo(null)).toBeUndefined();
  });
});

describe("submitAndWaitForTransaction", () => {
  it("retries 503/timeouts under the SAME commandId with a fresh submissionId", async () => {
    const bodies: { commands: Record<string, unknown> }[] = [];
    const paths: string[] = [];
    let n = 0;
    const c = client(async (url, init) => {
      const path = new URL(url).pathname;
      paths.push(path);
      // Before its first resend the client pins the ledger end (the in-flight wait's completion floor).
      if (path.endsWith("ledger-end")) return json(200, { offset: 7 });
      bodies.push(JSON.parse(String(init.body)));
      n++;
      if (n === 1) return new Response("upstream", { status: 503 });
      if (n === 2) throw Object.assign(new Error("socket hang up"), { name: "TypeError" });
      return json(200, { transaction: TX });
    });
    const r = await c.submitAndWaitForTransaction({ actAs: ["alice::1220"], commandId: "open:btc-5m:1", commands: [] });
    expect(r).toMatchObject({ attempts: 3, recovered: false });
    expect(new Set(bodies.map((b) => b.commands.commandId))).toEqual(new Set(["open:btc-5m:1"]));
    expect(new Set(bodies.map((b) => b.commands.submissionId)).size).toBe(3);
    expect(bodies[0]!.commands.userId).toBe("agari-ops"); // no token: userId is sent
    expect(paths.filter((p) => p.endsWith("ledger-end"))).toHaveLength(1); // pinned once, then kept
  });

  it("does not retry a definite rejection", async () => {
    const fetch = vi.fn(async () => json(400, INVALID_TOKEN));
    await expect(client(fetch).submitAndWaitForTransaction({ actAs: ["a"], commandId: "c", commands: [] })).rejects.toMatchObject({ kind: "auth" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("recovers a DUPLICATE_COMMAND from completions and update-by-id", async () => {
    const calls: string[] = [];
    const c = client(async (url) => {
      const path = new URL(url).pathname;
      calls.push(path);
      if (path.endsWith("submit-and-wait-for-transaction")) return json(409, DUPLICATE);
      if (path.endsWith("ledger-end")) return json(200, { offset: 15 });
      if (path.endsWith("completions")) {
        return json(200, [
          { completionResponse: { Completion: { value: { commandId: "c1", status: { code: 0, message: "" }, updateId: "u1", userId: "agari-ops", actAs: ["a"], submissionId: "s1", offset: 12 } } } },
          { completionResponse: { Completion: { value: { commandId: "c1", status: { code: 6, message: "DUPLICATE_COMMAND(10,9e8d)" }, userId: "agari-ops", actAs: ["a"], submissionId: "s2", offset: 12 } } } },
        ]);
      }
      if (path.endsWith("update-by-id")) return json(200, { update: { Transaction: { value: TX } } });
      return json(404, {});
    });
    const r = await c.submitAndWaitForTransaction({ actAs: ["a"], commandId: "c1", commands: [] });
    expect(r).toMatchObject({ recovered: true, submissionId: "s1", transaction: { updateId: "u1" } });
    expect(calls).toEqual([
      "/v2/commands/submit-and-wait-for-transaction",
      "/v2/state/ledger-end",
      "/v2/commands/completions",
      "/v2/updates/update-by-id",
    ]);
  });

  it("refuses an invalid commandId before sending", async () => {
    const fetch = vi.fn();
    await expect(client(fetch).submitAndWaitForTransaction({ actAs: ["a"], commandId: "bad id!", commands: [] })).rejects.toThrow(/commandId/);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("auth over HTTP", () => {
  it("omits userId with a token and re-grants once on 401", async () => {
    let grants = 0;
    const tokenFetch = vi.fn(async () => json(200, { access_token: `T${++grants}`, expires_in: 10_800 }));
    const auth = passwordGrant(
      { tokenUrl: "https://kc/token", clientId: "c", username: "u@x", password: "pw-123", scope: "s" },
      { fetch: tokenFetch as unknown as typeof globalThis.fetch },
    );
    const seen: (string | null)[] = [];
    const c = client(async (_u, init) => {
      const h = init.headers as Record<string, string>;
      seen.push(h.Authorization ?? null);
      if (seen.length === 1) return new Response("", { status: 401 });
      return json(200, { transaction: TX, ...(init.body ? { echo: JSON.parse(String(init.body)) } : {}) });
    }, auth);
    const r = (await c.submitAndWaitForTransaction({ actAs: ["a"], commandId: "c", commands: [] })) as unknown as { transaction: unknown };
    expect(r.transaction).toBeDefined();
    expect(seen).toEqual(["Bearer T1", "Bearer T2"]);
    expect(grants).toBe(2);
  });

  it("uploadDar and allocateParty refuse to run against an authenticated node", async () => {
    const auth = passwordGrant({ tokenUrl: "https://kc/token", clientId: "c", username: "u", password: "p", scope: "s" });
    const c = client(vi.fn(), auth);
    await expect(c.uploadDar(new Uint8Array([1]))).rejects.toBeInstanceOf(LedgerError);
    await expect(c.allocateParty("alice")).rejects.toThrow(/Console/);
  });
});

describe("activeContracts paging", () => {
  it("pins the offset from ledger-end, sends it on every page, and follows nextPageToken", async () => {
    const bodies: Record<string, unknown>[] = [];
    const entry = (cid: string) => ({ contractEntry: { JsActiveContract: { createdEvent: { contractId: cid }, synchronizerId: "s", reassignmentCounter: 0 } } });
    const c = client(async (url, init) => {
      if (url.endsWith("/v2/state/ledger-end")) return json(200, { offset: 40 });
      const b = JSON.parse(String(init.body)) as Record<string, unknown>;
      bodies.push(b);
      return b.pageToken
        ? json(200, { activeContracts: [entry("c3")], activeAtOffset: 40, nextPageToken: null })
        : json(200, { activeContracts: [entry("c1"), entry("c2")], activeAtOffset: 40, nextPageToken: "p2" });
    });
    const r = await c.activeContracts({ parties: ["a"], maxPageSize: 2 });
    expect(r.contracts.map((x) => x.createdEvent.contractId)).toEqual(["c1", "c2", "c3"]);
    expect(bodies[0]).toMatchObject({ activeAtOffset: 40, maxPageSize: 2 });
    expect(bodies[0]).not.toHaveProperty("pageToken");
    expect(bodies[1]).toMatchObject({ activeAtOffset: 40, pageToken: "p2", maxPageSize: 2 });
  });
});

describe("eventFormat", () => {
  it("is a wildcard with neither templates nor interfaces", () => {
    const f = eventFormat({ parties: ["p"] });
    expect(f.filtersByParty?.p?.cumulative).toEqual([{ identifierFilter: { WildcardFilter: { value: { includeCreatedEventBlob: false } } } }]);
  });
  it("asks for the interface view of a CIP-56 Holding (C7b)", () => {
    const id = "#splice-api-token-holding-v1:Splice.Api.Token.HoldingV1:Holding";
    const f = eventFormat({ parties: ["p"], interfaceIds: [id] });
    expect(f.filtersByParty?.p?.cumulative).toEqual([
      { identifierFilter: { InterfaceFilter: { value: { interfaceId: id, includeInterfaceView: true, includeCreatedEventBlob: false } } } },
    ]);
  });
  it("combines templates and interfaces cumulatively", () => {
    const f = eventFormat({ parties: ["p", "q"], templateIds: ["#a:M:T"], interfaceIds: ["#b:M:I"], includeCreatedEventBlob: true });
    expect(f.filtersByParty?.q?.cumulative).toHaveLength(2);
    expect(f.filtersByParty?.p?.cumulative?.[0]).toEqual({ identifierFilter: { TemplateFilter: { value: { templateId: "#a:M:T", includeCreatedEventBlob: true } } } });
  });
});
