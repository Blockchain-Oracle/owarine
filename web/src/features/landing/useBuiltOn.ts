"use client";

import { diagnosis, err, ok, type Reading } from "@owarine/core";
import type { TickerSymbol } from "@owarine/core/market";
import { useReadingQuery } from "@owarine/markets/react";
import { indexConfigured, indexGet } from "@/lib/index-read";
import { BUILT_ON_FROM_SEC, builtOnTally, printedSource, type BuiltOnSource, type MixRow, type SourceTally } from "./built-on";

/** The mix moves by one Window a close; five minutes of freshness is honest for a count on a story page. */
const STALE_MS = 5 * 60_000;
const GC_MS = 30 * 60_000;
/** Newest terminal Windows read per name when looking for the latest one a source closed (a token lane interleaves). */
const PROOF_SCAN = 12;
/** Names asked per source for that Window. */
const PROOF_NAMES = 3;

export interface BuiltOn {
  /** One entry per source that closed a Window, in the band's order. */
  tally: SourceTally[];
  /** The newest Window each source closed, for its "print proof" link; absent when none was found. */
  proof: Partial<Record<BuiltOnSource, string>>;
}

interface ProofRow {
  market: string;
  symbol?: string | null;
  expiry_sec: string;
  print_source?: string | null;
  prints?: Record<string, { source: number } | undefined> | null;
}

/** The names a source's proof link is looked for on: the first few it closed Windows on. */
const proofNames = (t: SourceTally): TickerSymbol[] => [...t.names, ...t.baskets].slice(0, PROOF_NAMES);

async function readBuiltOn(): Promise<Reading<BuiltOn>> {
  if (!indexConfigured()) return err(diagnosis("indexer-down", "no indexer configured"));
  const rows = await indexGet<MixRow>(`status/prints?from=${BUILT_ON_FROM_SEC}`);
  const tally = builtOnTally(rows);
  // Each name's newest resolved Windows are read once, however many sources share it (TSLA on RedStone and on Jupiter).
  const names = [...new Set(tally.flatMap(proofNames))];
  const lists = await Promise.all(names.map(async (s) => [s, await indexGet<ProofRow>(`markets?symbol=${s}&state=resolved&limit=${PROOF_SCAN}`).catch((): ProofRow[] => [])] as const));
  const byName = new Map(lists);
  const proof: BuiltOn["proof"] = {};
  for (const t of tally) {
    const hits = proofNames(t)
      .flatMap((s) => byName.get(s) ?? [])
      .filter((row) => printedSource(row.symbol ?? null, row.prints?.["1"]?.source ?? null, row.print_source) === t.source);
    hits.sort((a, b) => Number(b.expiry_sec) - Number(a.expiry_sec));
    if (hits[0]) proof[t.source] = hits[0].market;
  }
  return ok({ tally, proof }, Date.now());
}

/** The landing's "Built on" figures: one print-mix read and a few one-page Window reads, cached, never polled. */
export function useBuiltOn(): Reading<BuiltOn> | null {
  return useReadingQuery(["owarine", "landing", "built-on", BUILT_ON_FROM_SEC], readBuiltOn, { staleTimeMs: STALE_MS, gcTimeMs: GC_MS, needs: [] });
}
