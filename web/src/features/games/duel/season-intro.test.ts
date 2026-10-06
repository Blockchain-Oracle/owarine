import { describe, expect, it } from "vitest";
import { GAMES } from "../copy";
import { seasonIntroKey, type SeasonView } from "./useSeason";

/** C9e: the ladder never says "there is no season" before it has read one, and never promises an unescrowed pool. */
const season = (escrow: SeasonView["escrow"]): SeasonView => ({
  id: "s1", name: "Season 1", endsAt: "2026-10-06T10:13:39.000Z", prizeSplit: [], minStakedDuels: 1, eligibilityNote: "", prizePool: { totalUnits: 100, currency: "credits" }, escrow,
});

describe("seasonIntroKey", () => {
  it("says nothing about a season while loading, and says unread when the read failed", () => {
    expect(seasonIntroKey({ season: undefined, failed: false })).toBe("introLoading");
    expect(seasonIntroKey({ season: undefined, failed: true })).toBe("introUnread");
    expect(GAMES.rankPage.introLoading).not.toMatch(/no season/);
  });

  it("says there is no season only when the operator named none", () => {
    expect(seasonIntroKey({ season: null, failed: false })).toBe("intro");
  });

  it("promises a pool in a contract only when the ledger's escrow was read", () => {
    const escrow = { address: "GKoD", balanceBase: 500_000_000n, depositedBase: 500_000_000n, distributed: false, decimals: 6, symbol: "credits" };
    expect(seasonIntroKey({ season: season(escrow), failed: false })).toBe("introSeason");
    expect(seasonIntroKey({ season: season(null), failed: false })).toBe("introSeasonUnescrowed");
  });
});
