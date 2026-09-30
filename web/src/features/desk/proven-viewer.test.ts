import { describe, expect, it, vi } from "vitest";

/** C13a: a desk's owner view (private notes, live mandate state) needs the seat's proof, never a typed `?viewer=`. */
const OWNER = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin";
const OTHER = "US517G5965aydkZ46HS38QLi7UQiSojurfbQfKCELFx";
const caller = vi.fn<() => Promise<string | null>>();
vi.mock("@/lib/auth/seat-caller.server", () => ({ seatCaller: () => caller() }));

const { provenViewer } = await import("./auth.server");
const req = (viewer: string | null) => new Request(`http://localhost/api/desk/${OWNER}${viewer === null ? "" : `?viewer=${viewer}`}`);

describe("provenViewer", () => {
  it("is the viewer only when the caller's seat proves it", async () => {
    caller.mockResolvedValue(OWNER);
    expect(await provenViewer(req(OWNER))).toBe(OWNER);
  });

  it("a typed owner address without the owner's proof is a visitor", async () => {
    for (const who of [null, OTHER]) {
      caller.mockResolvedValue(who);
      expect(await provenViewer(req(OWNER))).toBeNull();
    }
  });

  it("no viewer, or a malformed one, is a visitor", async () => {
    caller.mockResolvedValue(OWNER);
    expect(await provenViewer(req(null))).toBeNull();
    expect(await provenViewer(req("not-an-address"))).toBeNull();
  });
});
