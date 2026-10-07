import type { TraderRanking } from "@owarine/core/projection";
import type { Address } from "@owarine/core/types";
import { describe, expect, it } from "vitest";
import { topByEither } from "./tape";

const row = (owner: string, pnl: bigint, stake: bigint): TraderRanking => ({
  owner: owner as Address, pnlBase: pnl, roiBps: Number((pnl * 10_000n) / stake), winRatePct: 50, tradeCount: 1, settledTrades: 1, bestStreak: 1, volumeBase: stake,
});

describe("topByEither", () => {
  it("keeps the ROI leader that a PnL cut would drop", () => {
    // 500 traders earning 1,000 on 100,000 (1 %), then one earning 10 on 1 (1,000 %); the board ranks by PnL first.
    const rankings = [...Array.from({ length: 500 }, (_, i) => row(`w${i}`, 1_000n, 100_000n)), row("small", 10n, 1n)];
    const kept = topByEither(rankings, 50);
    expect(kept.map((r) => r.owner)).toContain("small");
    expect(kept).toHaveLength(51);
    // Kept in the PnL order the board serves.
    expect(kept.at(-1)!.owner).toBe("small");
    expect(kept[0]!.owner).toBe("w0");
  });
  it("is the PnL top when the two tops coincide", () => {
    const rankings = Array.from({ length: 80 }, (_, i) => row(`w${i}`, BigInt(1_000 - i), 1_000n));
    expect(topByEither(rankings, 50).map((r) => r.owner)).toEqual(rankings.slice(0, 50).map((r) => r.owner));
  });
});
