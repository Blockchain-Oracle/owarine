import { describe, expect, it, vi } from "vitest";

/** C4d L5: `POST /api/desk/<owner>/opened` took `{ owner }` from anyone; it now needs the owner's own seat proof. */
const OWNER = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin";
const OTHER = "US517G5965aydkZ46HS38QLi7UQiSojurfbQfKCELFx";
let writer: string | null = null;
const markRecordOpened = vi.fn(async () => undefined);
vi.mock("@/lib/auth/proven-seat.server", () => ({ provenWriter: async () => writer }));
vi.mock("@/features/desk/auth.server", async () => {
  const { NextResponse } = await import("next/server");
  return {
    DESK_ERRORS: { notFound: "not found", notOwner: "not the owner" },
    answer: (b: unknown) => NextResponse.json(b),
    refuse: (status: number, error: string) => NextResponse.json({ error }, { status }),
    readJson: (req: Request) => req.json().catch(() => null),
    loadDesk: async () => ({ store: { markRecordOpened }, desk: { id: "d1", owner: OWNER, recordOpenedAtSec: null }, key: OWNER, keyIsAddress: true }),
  };
});
const { POST } = await import("./route");
const call = () => POST(new Request(`https://site.test/api/desk/${OWNER}/opened`, { method: "POST", body: JSON.stringify({ owner: OWNER }) }), { params: Promise.resolve({ owner: OWNER }) });

describe("desk opened needs the owner's seat (C4d L5)", () => {
  it("a body naming the owner is not enough", async () => {
    for (const who of [null, OTHER]) {
      writer = who;
      expect((await call()).status).toBe(403);
    }
    expect(markRecordOpened).not.toHaveBeenCalled();
  });
  it("the owner's own seat marks the record opened", async () => {
    writer = OWNER;
    expect((await call()).status).toBe(200);
    expect(markRecordOpened).toHaveBeenCalledOnce();
  });
});
