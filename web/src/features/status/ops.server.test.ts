import { afterEach, describe, expect, it, vi } from "vitest";
import { heartbeatOf, readOpsHealth } from "./ops.server";

const beat = (actor: string, failures: number) => ({ actor, everyMs: 5_000, startedMs: 0, lastOkMs: 1, lastWhy: "why", failures, detail: {} });
const answer = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

describe("readOpsHealth", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps the body of a 503 /health so the failing actor can be named", async () => {
    vi.stubGlobal("fetch", answer(503, { ok: false, nowMs: 2, actors: [beat("projector", 0), beat("prestocks-spot", 4)] }));
    const read = await readOpsHealth("http://ops");
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value.ok).toBe(false);
    expect(heartbeatOf(read.value, "projector")?.failures).toBe(0);
    expect(heartbeatOf(read.value, "prestocks-spot")?.failures).toBe(4);
  });

  it("still fails on any other error status", async () => {
    vi.stubGlobal("fetch", answer(500, { error: "boom" }));
    expect((await readOpsHealth("http://ops")).ok).toBe(false);
  });
});
