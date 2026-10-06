import { describe, expect, it } from "vitest";
import { NEWS } from "./copy";
import { newsQuietLine, newsReading } from "./news-reading";

/** C9e: a wire with no provider key, or one that failed, never reads as a quiet wire. */
describe("newsReading", () => {
  it("says the wire waits on its key when the server has none", () => {
    const reading = newsReading(200, { articles: [], error: "news provider not configured" }, 1);
    expect(reading.ok).toBe(false);
    expect(newsQuietLine(reading)).toBe(NEWS.unconfigured);
    expect(NEWS.unconfigured).toContain("Finnhub key");
    expect(NEWS.unconfigured).not.toMatch(/[A-Z]+_[A-Z_]+/);
  });

  it("says the provider could not be read, and that a quiet wire is quiet", () => {
    expect(newsQuietLine(newsReading(200, { articles: [], error: "news unavailable" }, 1))).toBe(NEWS.unreadable);
    expect(newsQuietLine(newsReading(502, null, 1))).toBe(NEWS.unreadable);
    const quiet = newsReading(200, { articles: [], error: "no live headlines" }, 1);
    expect(quiet.ok).toBe(true);
    expect(newsQuietLine(quiet)).toBe(NEWS.quiet);
  });
});
