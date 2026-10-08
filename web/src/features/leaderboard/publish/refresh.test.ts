import { beforeEach, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({ invalidate: vi.fn(), mutations: [] as Array<{ onSettled: () => void }> }));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: hooks.invalidate }),
  useMutation: (options: { onSettled: () => void }) => { hooks.mutations.push(options); return {}; },
}));
vi.mock("@owarine/markets", () => ({ ledgerRequest: vi.fn() }));
vi.mock("@/features/stats/useTraction", () => ({ TRACTION_KEY: ["owarine", "traction"] }));
const { usePublishCall } = await import("./usePublications");

beforeEach(() => { vi.clearAllMocks(); hooks.mutations.length = 0; });
it("refreshes public activity and profiles as well as rankings after publishing or retracting", () => {
  usePublishCall("seat-address");
  expect(hooks.mutations).toHaveLength(2);
  for (const mutation of hooks.mutations) {
    hooks.invalidate.mockClear();
    mutation.onSettled();
    for (const key of [["owarine", "leaderboard"], ["owarine", "traction"], ["owarine", "social"], ["owarine", "markets", "published"]]) {
      expect(hooks.invalidate).toHaveBeenCalledWith({ queryKey: key });
    }
  }
});
