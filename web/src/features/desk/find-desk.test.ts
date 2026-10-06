import { describe, expect, it, vi } from "vitest";
import { findDesk, type DeskQueries } from "./desk.server";

/** C5d: `/dev/desk`'s fixture id reached Postgres' uuid column and answered 500; a key that is neither names no desk. */
const store = () => ({ getDeskById: vi.fn(async () => null), getDeskByOwner: vi.fn(async () => null) }) as unknown as DeskQueries & { getDeskById: ReturnType<typeof vi.fn> };

describe("findDesk", () => {
  it("never asks the store for a key that is not a uuid", async () => {
    const s = store();
    expect(await findDesk(s, "desk-fixture-ailabs", false)).toBeNull();
    expect(s.getDeskById).not.toHaveBeenCalled();
  });

  it("looks a uuid up by id", async () => {
    const s = store();
    await findDesk(s, "0b3f1c2e-8a4d-4e5f-9a6b-7c8d9e0f1a2b", false);
    expect(s.getDeskById).toHaveBeenCalledWith("0b3f1c2e-8a4d-4e5f-9a6b-7c8d9e0f1a2b");
  });
});
