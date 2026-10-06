import type { AutoscaleInfo, IPriceLine } from "lightweight-charts";
import { describe, expect, it } from "vitest";
import { autoscaleWith, drawnOf, isOneTickMore, NOTHING_DRAWN, syncReferenceLine } from "./chart-sync";

type Provider = (original: () => AutoscaleInfo | null) => AutoscaleInfo | null;

/** A stand-in for the line series: records the lines it holds and the autoscale provider last applied. */
function fakeSeries() {
  const lines: FakeLine[] = [];
  let provider: Provider | null = null;
  return {
    lines,
    range: (minValue: number, maxValue: number) => provider?.(() => ({ priceRange: { minValue, maxValue } })) ?? null,
    applyOptions: (options: { autoscaleInfoProvider?: Provider }) => {
      provider = options.autoscaleInfoProvider ?? provider;
    },
    removePriceLine: (line: IPriceLine) => {
      lines.splice(lines.indexOf(line as unknown as FakeLine), 1);
    },
    create(price: number, title: string): IPriceLine {
      const line = new FakeLine(price, title);
      lines.push(line);
      return line as unknown as IPriceLine;
    },
  };
}

class FakeLine {
  constructor(
    public price: number,
    public title: string,
  ) {}
  applyOptions(options: { price?: number; title?: string }) {
    this.price = options.price ?? this.price;
    this.title = options.title ?? this.title;
  }
}

const sync = (series: ReturnType<typeof fakeSeries>, line: IPriceLine | null, price: number | null, title = "opening print") =>
  syncReferenceLine(series as never, line, price, title, (p, t) => series.create(p, t));

describe("syncReferenceLine (a mounted chart keeps no other market's opening print)", () => {
  it("moves the one line to the new market's print when the hero switches Windows", () => {
    const series = fakeSeries();
    let line = sync(series, null, 64_210.5); // BTC-1m opened
    line = sync(series, line, 2_431.25); // the hero moves to ETH-1m
    expect(series.lines).toHaveLength(1);
    expect(series.lines[0]?.price).toBe(2_431.25);
  });

  it("removes the line while the new market's print is pending, rather than leaving the old market's", () => {
    const series = fakeSeries();
    let line = sync(series, null, 64_210.5);
    line = sync(series, line, null);
    expect(line).toBeNull();
    expect(series.lines).toHaveLength(0);
    // ...and draws it once the print lands.
    sync(series, line, 2_431.25);
    expect(series.lines.map((l) => l.price)).toEqual([2_431.25]);
  });

  it("follows a changed label (opening print → prev close)", () => {
    const series = fakeSeries();
    const line = sync(series, null, 100, "open");
    sync(series, line, 100, "prev close");
    expect(series.lines[0]?.title).toBe("prev close");
  });

  it("keeps only the current print in the autoscale range, so the old asset's level cannot flatten the new chart", () => {
    const series = fakeSeries();
    const line = sync(series, null, 64_210.5);
    sync(series, line, 2_431.25);
    expect(series.range(2_400, 2_450)?.priceRange).toEqual({ minValue: 2_400, maxValue: 2_450 });
    expect(series.range(2_440, 2_450)?.priceRange).toEqual({ minValue: 2_431.25, maxValue: 2_450 });
    autoscaleWith(series as never, null);
    expect(series.range(2_440, 2_450)?.priceRange).toEqual({ minValue: 2_440, maxValue: 2_450 });
  });
});

describe("isOneTickMore (append only a live tick of the series already drawn)", () => {
  const btc = [{ time: 100 }, { time: 101 }, { time: 102 }];

  it("appends the next tick of the same series", () => {
    expect(isOneTickMore(drawnOf(btc), [...btc, { time: 103 }])).toBe(true);
  });

  it("redraws another market's points even when they number exactly one more", () => {
    const eth = [{ time: 160 }, { time: 161 }, { time: 162 }, { time: 163 }];
    expect(isOneTickMore(drawnOf(btc), eth)).toBe(false);
  });

  it("redraws when the extra point is not later than the last drawn", () => {
    expect(isOneTickMore(drawnOf(btc), [{ time: 100 }, { time: 101 }, { time: 101.5 }, { time: 102 }])).toBe(false);
  });

  it("redraws from nothing", () => {
    expect(isOneTickMore(NOTHING_DRAWN, [{ time: 100 }])).toBe(false);
  });
});
