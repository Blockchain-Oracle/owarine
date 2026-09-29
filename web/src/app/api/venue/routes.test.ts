import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("/api/venue routes without a projection", () => {
  beforeEach(() => vi.stubEnv("DATABASE_URL", ""));
  afterEach(() => vi.unstubAllEnvs());

  it("facts: not deployed, said as a diagnosis and never cached", async () => {
    const { GET } = await import("./facts/route");
    const res = await GET();
    expect(res.status).toBe(503);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(((await res.json()) as { diagnosis: { kind: string } }).diagnosis.kind).toBe("not-deployed");
  });

  it("markets: a malformed id is refused before any read", async () => {
    const { GET } = await import("./markets/[id]/route");
    const res = await GET(new NextRequest("http://localhost/api/venue/markets/nope"), { params: Promise.resolve({ id: "not base58 0OIl" }) });
    expect(res.status).toBe(400);
  });

  it("clock: always answers the server's time, with no offset it could not read", async () => {
    const { GET } = await import("./clock/route");
    const before = Date.now();
    const body = (await (await GET()).json()) as { serverMs: number; offset: number | null };
    expect(body.serverMs).toBeGreaterThanOrEqual(before);
    expect(body.offset).toBeNull();
  });
});
