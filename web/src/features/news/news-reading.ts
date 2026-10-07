import { diagnosis, err, ok, type Reading } from "@owarine/core";
import { NEWS } from "./copy";
import { newsPayloadSchema, type Article } from "./protocol";

/**
 * `/api/news`'s answer as a reading (C9e). The route says why a wire is empty: no provider key on this server, a
 * provider that could not be read, or simply no headlines. Only the last is a quiet wire; the first two are said as
 * what they are, never as "quiet".
 */
export const NEWS_UNCONFIGURED = "news provider not configured";
const NEWS_UNREADABLE = new Set(["news unavailable"]);

export function newsReading(status: number, body: unknown, atMs: number): Reading<Article[]> {
  if (status < 200 || status >= 300) return err(diagnosis("unknown", `news route answered ${status}`));
  const parsed = newsPayloadSchema.safeParse(body);
  if (!parsed.success) return err(diagnosis("unknown", "news payload did not parse"));
  if (parsed.data.error === NEWS_UNCONFIGURED) return err(diagnosis("not-deployed", NEWS.unconfigured));
  if (parsed.data.error && NEWS_UNREADABLE.has(parsed.data.error)) return err(diagnosis("unknown", NEWS.unreadable));
  return ok(parsed.data.articles, atMs);
}

/** What an empty or failed wire says: the reason when there is one, else the quiet line. */
export function newsQuietLine(reading: Reading<Article[]> | null): string {
  if (reading && !reading.ok) return reading.error.kind === "not-deployed" ? NEWS.unconfigured : NEWS.unreadable;
  return NEWS.quiet;
}
