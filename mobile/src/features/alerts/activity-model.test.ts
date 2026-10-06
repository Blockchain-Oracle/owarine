import type { OpenPosition } from "@agari/core/types";
import { describe, expect, it } from "vitest";
import { pickFollowed, VERDICT_WAIT_MS } from "./activity-model";

/**
 * C11b, found at the first settle on the simulator: a settled bet stays in the open list through its verdict wait, so
 * the Live Activity picked it again the moment it had ended, and its two effects set the followed bet back and forth for
 * ever ("Maximum update depth exceeded", the app frozen). An ended Window is never picked again.
 */
const NOW = 1_791_277_080_000;
const bet = (marketId: string, expirySec: number): OpenPosition => ({ marketId, expirySec, balanceUpRaw: 1_000_000n, balanceDownRaw: 0n }) as unknown as OpenPosition;
const settled = bet("w42", NOW / 1000 - 20);
const next = bet("w43", NOW / 1000 + 40);

describe("pickFollowed: an ended Window is never followed again", () => {
  it("follows a settled bet through its verdict wait while it has not ended", () => {
    expect(pickFollowed([settled], NOW)?.marketId).toBe("w42");
    expect(pickFollowed([settled], NOW + VERDICT_WAIT_MS)).toBeNull();
  });

  it("skips it once its activity ended, and takes the next bet", () => {
    const ended = new Set(["w42"]);
    expect(pickFollowed([settled], NOW, ended)).toBeNull();
    expect(pickFollowed([settled, next], NOW, ended)?.marketId).toBe("w43");
  });
});
