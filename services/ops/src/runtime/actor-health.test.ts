import { describe, expect, it, vi } from "vitest";
import { runActor } from "./actor";

/** C4d L4: `/health` is public; a failed pass is named there by a reference, and only the log has the ledger's text. */
describe("a failed pass on /health", () => {
  it("says 'pass failed' with a reference, and logs the full text under it", async () => {
    const lines: string[] = [];
    const secret = "INVALID_ARGUMENT: party seat-7::1220f00dfeed not hosted on participant";
    const { stop, beat } = runActor({ name: "c4d-health-probe", log: (l) => lines.push(l), dryRun: false, everyMs: 10_000, pass: async () => { throw new Error(secret); } });
    await vi.waitFor(() => expect(beat.failures).toBeGreaterThan(0));
    stop();
    expect(beat.lastWhy).toMatch(/^pass failed \(ref [0-9a-f]{8}\)$/);
    expect(beat.lastWhy).not.toContain("1220f00dfeed");
    const logged = lines.find((l) => l.startsWith(beat.lastWhy));
    expect(logged).toContain(secret);
  });
});
