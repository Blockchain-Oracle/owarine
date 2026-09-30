import { NextRequest } from "next/server";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type RouteModules = [typeof import("./facts/route"), typeof import("./markets/[id]/route"), typeof import("./clock/route")];
let routes: RouteModules;

// The route graph is imported once, cold, before the tests: on a loaded machine that import alone has taken minutes, so it
// gets its own budget and each test times only the route it calls.
describe("/api/venue routes without a projection", { timeout: 30_000 }, () => {
  beforeAll(async () => {
    routes = await Promise.all([import("./facts/route"), import("./markets/[id]/route"), import("./clock/route")]);
  }, 600_000);
  beforeEach(() => vi.stubEnv("DATABASE_URL", ""));
  afterEach(() => vi.unstubAllEnvs());

  it("facts: not deployed, said as a diagnosis and never cached", async () => {
    const { GET } = routes[0];
    const res = await GET();
    expect(res.status).toBe(503);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(((await res.json()) as { diagnosis: { kind: string } }).diagnosis.kind).toBe("not-deployed");
  });

  it("markets: a malformed id is refused before any read", async () => {
    const { GET } = routes[1];
    const res = await GET(new NextRequest("http://localhost/api/venue/markets/nope"), { params: Promise.resolve({ id: "not base58 0OIl" }) });
    expect(res.status).toBe(400);
  });

  it("clock: always answers the server's time, with no offset it could not read", async () => {
    const { GET } = routes[2];
    const before = Date.now();
    const body = (await (await GET()).json()) as { serverMs: number; offset: number | null };
    expect(body.serverMs).toBeGreaterThanOrEqual(before);
    expect(body.offset).toBeNull();
  });
});
