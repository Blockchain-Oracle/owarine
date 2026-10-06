"use client";

import { SectionHeader } from "@/components/chrome";
import { NewsFeed } from "@/features/news/NewsFeed";
import { newsQuietLine, newsReading } from "@/features/news/news-reading";

const DEV = {
  title: "News wire",
  intro: "The wire's three empty states from canned route answers (C9e): a quiet wire, a server with no Finnhub key, and a provider that could not be read. Then the live wire.",
  live: "Live — this deployment's /api/news",
} as const;

const CASES = [
  { label: "Quiet: the provider answered with no headlines", body: { articles: [], error: "no live headlines" } },
  { label: "No Finnhub key on this server", body: { articles: [], error: "news provider not configured" } },
  { label: "Finnhub could not be read", body: { articles: [], error: "news unavailable" } },
] as const;

export default function DevNewsPage() {
  return (
    <div className="mx-auto flex w-full max-w-(--content-reading) flex-col gap-6 px-gutter py-8">
      <SectionHeader index="00" title={DEV.title} />
      <p className="type-body text-ink-secondary">{DEV.intro}</p>
      {CASES.map((c) => (
        <section key={c.label} className="flex flex-col gap-2" aria-label={c.label}>
          <p className="type-caption text-ink-secondary">{c.label}</p>
          <p className="news-quiet">{newsQuietLine(newsReading(200, c.body, 0))}</p>
        </section>
      ))}
      <SectionHeader index="01" title={DEV.live} />
      <NewsFeed />
    </div>
  );
}
