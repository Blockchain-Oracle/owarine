/**
 * Canned readings for `/dev/basket` (S19): the AI Labs basket's Window trading and paused, its feed row, and the
 * hub.
 */
import { BASKET_INDEX_BASE_E8, BASKETS } from "@owarine/core/market";
import type { EventMarket, LaneSet } from "@owarine/core/types";
import type { MarketCardData } from "@/features/markets/lanes/MarketCardView";
import type { PreIpoFactsView } from "@/features/ticker-hub/usePreIpoFacts";
import { fixtureAddress, fixtureMarketId } from "../fixture-ids";
import { fixtureWindow } from "../fixture-window";
import { CLOCK } from "../session/market-session-fixtures";

const VENUE = fixtureAddress("0x7e");
export const AILABS = BASKETS.AILABS;

/** The 24/7 AI Labs Window (Series 920, 60 m): opened at 1,000.00 pts; the index sits 0.42 % above it. */
export const AILABS_OPEN = BASKET_INDEX_BASE_E8;
export const AILABS_NOW = 100_420_000_000n;
export const AILABS_WINDOW: EventMarket = fixtureWindow({
  marketId: fixtureMarketId(0x56_0920),
  asset: "AILABS",
  lane: "token",
  intervalSec: 3_600,
  expirySec: CLOCK.weekendSat + 3_600,
  decimals: 6,
  openingPriceRaw: AILABS_OPEN,
  printSource: "attested",
});
/** The OPENAI 24/7 Window, for the source note beside the basket's: both now name their true source. */
export const OPENAI_WINDOW: EventMarket = fixtureWindow({
  marketId: fixtureMarketId(0x56_0910),
  asset: "OPENAI",
  lane: "token",
  intervalSec: 3_600,
  expirySec: CLOCK.weekendSat + 3_600,
  decimals: 6,
  openingPriceRaw: 112_738_000_000n,
  printSource: "attested",
});

/** Twenty-four minutes of the index drifting up from the open, with both sides quoted. */
function spark(startSec: number, fromRaw: bigint, toRaw: bigint, n = 24): MarketCardData["points"] {
  return Array.from({ length: n }, (_, i) => ({ timeSec: startSec + i * 60, valueRaw: fromRaw + ((toRaw - fromRaw) * BigInt(i)) / BigInt(n - 1) }));
}
const points = spark(CLOCK.weekendSat - 1_440, AILABS_OPEN, AILABS_NOW);
export const AILABS_CARD: MarketCardData = { points, latestRaw: AILABS_NOW, upCents: 54, downCents: 48, hydrating: false };

export const LANES: LaneSet = { venueId: VENUE, lanes: [{ basis: "token", intervalSec: 3_600, label: "", markets: [AILABS_WINDOW], nextStartSec: null }] };
export const NO_LANES: LaneSet = { venueId: VENUE, lanes: [] };

/** The feed's basket row as `/api/prestocks` serves it: the index, its 2 h movement, and each member from its base. */
export const AILABS_FACTS: PreIpoFactsView = {
  kind: "basket",
  indexE8: AILABS_NOW,
  fetchedAtSec: CLOCK.weekendSat,
  ageSec: 4,
  fresh: true,
  move: { windowSec: 7_200, samples: 720, rangeBps: 130, changeBps: 42 },
  members: [
    { symbol: "OPENAI", weightBps: 5_000, tokenPriceE8: 117_628_000_000n, moveBps: 183 },
    { symbol: "ANTHROPIC", weightBps: 5_000, tokenPriceE8: 103_120_000_000n, moveBps: -146 },
  ],
  holders: null,
  holdersMonthAgo: null,
  week: null,
};

