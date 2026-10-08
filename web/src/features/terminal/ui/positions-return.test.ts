import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { LivePnlView } from "@owarine/markets/react";
import type { TerminalPosition } from "../useTerminalTrade";
import { PositionsList, totalsOf, UnrealizedCard } from "./PositionsPanel";
import { ViewPositionPill } from "./Chrome";
import { subjectOfPosition } from "./sheets/PositionSheets";

const opening = vi.hoisted(() => vi.fn(() => ({ ok: true, value: 8_159_803_000_000n })));
vi.mock("@owarine/markets/react", () => ({ useOpeningPrice: opening }));
vi.mock("@/components/kit", () => ({ Odometer: ({ value, decimals, kind }: { value: number; decimals: number; kind: string }) => createElement("span", null, `${value.toFixed(decimals)}${kind === "pct" ? "%" : ""}`) }));
const now = Math.floor(Date.now() / 1000);
const p: TerminalPosition = { id: "test", mode: "demo", marketId: "held-btc", asset: "BTC", spotSymbol: "BTC", intervalSec: 120, side: "up", balanceUpRaw: 76_000_000n, balanceDownRaw: 0n, costBasisBase: 45_020_000n, decimals: 6, entrySpot: 81_598.03, linePrice: null, openedAtMs: 0, expirySec: now + 120, trailStop: null, paper: null, exit: null };
const quote: LivePnlView = { exitBase: p.costBasisBase, fillableLots: 76n, heldLots: 76n, upPriceTicks: 592, downPriceTicks: null, locked: false, costBasisBase: p.costBasisBase, pnlBase: 0n, fairTicks: 622, shiftTicks: 0, live: true, spotE8: null };
const render = (v?: LivePnlView) => renderToStaticMarkup(createElement(PositionsList, { positions: [p], book: new Map(v ? [[p.id, v]] : []), nowSec: now, onAdd: vi.fn(), onReduce: vi.fn(), onShare: vi.fn() }));

describe("position return presentation", () => {
  it("renders an unavailable quote as a dash and a recovery status, not 0%", () => {
    const html = render();
    expect(html).toContain("Live price unavailable");
    expect(html).not.toContain("0.0%");
    expect(html).toContain("—");
  });
  it("renders a genuine break-even quote and labels a stale quote", () => {
    expect(render(quote)).toContain("0.0%");
    expect(render({ ...quote, live: false })).toContain("Last quote · reconnecting");
  });
  it("does not mislabel missing data as a locked market in the aggregate", () => {
    const html = renderToStaticMarkup(createElement(UnrealizedCard, { totals: totalsOf([p], new Map(), now), count: 1, onCloseAll: vi.fn(), closingAll: false }));
    expect(html).toContain("Live return unavailable");
    expect(html).not.toContain("Locked");
    expect(html).not.toContain("0.00%");
  });
  it("does not count expired valuations in current ROI totals", () => {
    expect(totalsOf([{ ...p, expirySec: now }], new Map([[p.id, quote]]), now)).toEqual({ pnl: 0, cost: 0, unpriced: 1 });
  });
  it("reads the held round's line independently of the active chart round", () => {
    render(quote);
    expect(opening).toHaveBeenLastCalledWith("held-btc");
  });
  it("does not include stale quotes in current aggregate returns", () => {
    expect(totalsOf([p], new Map([[p.id, { ...quote, live: false }]]), now)).toEqual({ pnl: 0, cost: 0, unpriced: 1 });
  });
  it("keeps the phone summary neutral when it has no valuation", () => {
    const html = renderToStaticMarkup(createElement(ViewPositionPill, { count: 1, roiPct: null, onOpen: vi.fn() }));
    expect(html).toContain("—");
    expect(html).not.toContain("0.0%");
  });
  it("does not publish a fabricated break-even share card", () => {
    expect(subjectOfPosition(p, null, 81_600)).toBeNull();
    expect(subjectOfPosition(p, { ...quote, locked: true, fillableLots: 0n }, 81_600)).toBeNull();
    expect(subjectOfPosition(p, { ...quote, live: false }, 81_600)).toBeNull();
    expect(subjectOfPosition(p, quote, 81_600)?.pnl).toBe(0);
  });
});
