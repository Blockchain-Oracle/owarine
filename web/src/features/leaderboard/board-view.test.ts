import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ok } from "@owarine/core";
import { LeaderboardScreen } from "./LeaderboardScreen";
import { LeaderboardBoard } from "./LeaderboardBoard";
import type { BoardData } from "./protocol";
import { LEADERBOARD } from "./copy";

const selected = vi.hoisted(() => vi.fn(() => null));
vi.mock("./useLeaderboard", () => ({ useLeaderboard: selected, LEADERBOARD_KEY: ["owarine", "leaderboard"] }));
vi.mock("@owarine/markets/react", () => ({ useLanes: () => null }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn() }) }));
vi.mock("@/features/markets/useVenue", () => ({ useVenue: () => ({ venueId: null }) }));
vi.mock("@/features/markets/useChainNow", () => ({ useChainNowMs: () => 1000 }));
vi.mock("@/features/stats", () => ({ useTraction: () => null }));
vi.mock("@/lib/wallet-session", () => ({ useWalletSession: () => ({ address: null }) }));
vi.mock("@/features/markets/hero/asset-mark", () => ({ AssetDisc: () => null }));
vi.mock("@/components/chrome", () => ({ SectionHeader: () => null }));

const data: BoardData = {
  rankings: [],
  meta: { period: "24h", ticker: null, session: null, windowStartMs: 0, windowEndMs: 1000, computedAtMs: 1000, rankedTraders: 0, totalWallets: 0, closedCalls: 0, totalVolumeBase: 0n, complete: true, decimals: 6, symbol: "credits" },
};
const html = () => renderToStaticMarkup(createElement(LeaderboardBoard, { reading: ok(data, 1000), address: null, nextExpirySec: null, nowMs: 1000 }));

describe("leaderboard scope and empty state", () => {
  it("requests a rolling 24-hour board on first load, even outside NYSE hours", () => {
    renderToStaticMarkup(createElement(LeaderboardScreen));
    expect(selected).toHaveBeenCalledWith({ period: "24h", ticker: null });
  });
  it("offers crypto filters alongside stocks", () => {
    const rendered = html();
    expect(rendered).toMatch(/aria-pressed="true"[^>]*>Last 24 hours/);
    expect(rendered).toMatch(/aria-pressed="false"[^>]*>NYSE session/);
    for (const symbol of ["BTC", "ETH", "CC", "TSLA"]) expect(rendered).toContain(`>${symbol}</button>`);
    expect(rendered.indexOf(">BTC</button>")).toBeLessThan(rendered.indexOf(">TSLA</button>"));
  });
  it("distinguishes a confirmed zero from loading, and explains published-only eligibility", () => {
    const rendered = html();
    expect(rendered).toContain('class="big">0</div>');
    expect(rendered).toContain("No settled published calls");
    expect(rendered).toContain("Share a call from Portfolio");
  });
  it("labels weekly, monthly and all-time rows by the selected window", () => {
    for (const [period, text] of [["7d", "last 7 days"], ["30d", "last 30 days"], ["all", "all time"]] as const) {
      const span = { period, sessionDate: null, today: false, live: false };
      expect(LEADERBOARD.field.meta(span)).toContain(text);
      expect(LEADERBOARD.field.strip.center(span)).toContain(text.toUpperCase());
    }
  });
});
