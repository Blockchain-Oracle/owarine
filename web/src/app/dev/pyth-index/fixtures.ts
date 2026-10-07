/**
 * Canned readings for `/dev/pyth-index` (S20, D-125): the OpenAI hub's figure bar as it reads today, with the venue's
 * key refused the valuation index, and as it reads once a key that may read the index answers. Figures are shaped on
 * the 2026-09-22 catalogue read (OPENAI token $1,127.38, mark 15.1 % under it) and the 11 % token-to-index gap the
 * plan measured; none is a live read.
 */
import type { EventMarket } from "@owarine/core/types";
import type { MarketCardData } from "@/features/markets/lanes/MarketCardView";
import { absentWhy, type IndexState } from "@/features/ticker-hub/index-state";
import { TICKER_HUB } from "@/features/ticker-hub/copy";
import type { PreIpoFactsView } from "@/features/ticker-hub/usePreIpoFacts";
import type { PythIndexRow } from "@/features/ticker-hub/usePythIndex";
import { fixtureMarketId } from "../fixture-ids";
import { fixtureWindow } from "../fixture-window";
import { CLOCK } from "../session/market-session-fixtures";

const TOKEN_E8 = 1_127_380_000_000n;
const MARK_E8 = 979_478_000_000n;
const INDEX_E8 = 1_015_657_000_000n;
const READ_SEC = 1_790_100_000;

const bps = (tokenE8: bigint, referenceE8: bigint) => Number(((tokenE8 - referenceE8) * 10_000n) / referenceE8);

export const OPENAI_FACTS: PreIpoFactsView = {
  tokenPriceE8: TOKEN_E8,
  markPriceE8: MARK_E8,
  premiumBps: bps(TOKEN_E8, MARK_E8),
  ageSec: 8,
  fresh: true,
  move: { windowSec: 7_180, samples: 718, rangeBps: 131, changeBps: -42 },
  holders: 1_842,
  holdersMonthAgo: 1_722,
  week: "2026-09-21",
};

export const OPENAI_INDEX: PythIndexRow = {
  indexE8: INDEX_E8,
  publishTimeSec: READ_SEC,
  ageSec: 1,
  fresh: true,
  tokenPriceE8: TOKEN_E8,
  premiumBps: bps(TOKEN_E8, INDEX_E8),
};

/** The token price as the tab's price stream would carry it. */
export const OPENAI_SPOT_E8 = TOKEN_E8;

/** Today's probe answer (C8j.2, 30 Sep; again on this lane's sandbox, 6 Oct): the key is refused the index group. */
export const OPENAI_DENIED: IndexState = {
  kind: "absent",
  why: absentWhy({ state: "denied", status: 403, checkedAtSec: READ_SEC, reason: "pyth-indices" }),
  gate: TICKER_HUB.valuation.gate,
  checkedAtSec: READ_SEC,
};
export const OPENAI_READABLE: IndexState = { kind: "readable", row: OPENAI_INDEX };

/** The OPENAIV 24/7 Window (60 m) as it would trade once listed: opened at the index, 0.3 % above it now. */
export const OPENAIV_WINDOW: EventMarket = fixtureWindow({
  marketId: fixtureMarketId(0x56_0930),
  asset: "OPENAIV",
  lane: "token",
  intervalSec: 3_600,
  expirySec: CLOCK.weekendSat + 3_600,
  decimals: 6,
  openingPriceRaw: INDEX_E8,
  printSource: "attested",
});
const NOW_E8 = (INDEX_E8 * 1_003n) / 1_000n;
export const OPENAIV_CARD: MarketCardData = {
  points: Array.from({ length: 24 }, (_, i) => ({ timeSec: CLOCK.weekendSat - 1_440 + i * 60, valueRaw: INDEX_E8 + ((NOW_E8 - INDEX_E8) * BigInt(i)) / 23n })),
  latestRaw: NOW_E8,
  upCents: 52,
  downCents: 50,
  hydrating: false,
};
