"use client";

import type { Address } from "@owarine/core/types";
import { keys, usePositions, usePublishedCalls } from "@owarine/markets/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { SectionHeader } from "@/components/chrome";
import { ReadingBoundary } from "@/components/states";
import { ActivityList } from "@/features/activity/ActivityList";
import { takeItem } from "@/features/activity/items";
import type { ActivityFeed } from "@/features/activity/protocol";
import type { MoneyUnits } from "@/features/activity/describe";
import { BetRow } from "@/features/markets/portfolio/BetRow";
import { useChainNowMs } from "@/features/markets/useChainNow";
import type { TakesFeed } from "@/features/takes/protocol";
import { PROFILE } from "./copy";

/** The takes poll is Masayume's (`useTakes.ts`): 20 s, and a take is at most 5 minutes old when it lands. */
const TAKES_STALE_MS = 20_000;
const TAKES_SHOWN = 10;

async function readTakes(address: Address, signal: AbortSignal): Promise<TakesFeed> {
  const response = await fetch(`/api/takes?authors=${encodeURIComponent(address)}&limit=${TAKES_SHOWN}`, { signal });
  if (!response.ok) throw new Error(`takes ${response.status}`);
  return (await response.json()) as TakesFeed;
}

/**
 * Open calls (Portfolio's bet rows) and the seat's recent signed takes. Your own open calls are your seat's live legs;
 * anyone else's are only the calls they published (C13a).
 */
export function ProfileCalls({ address, units, own }: { address: Address; units: MoneyUnits; own: boolean }) {
  const nowMs = useChainNowMs();
  const ownPositions = usePositions(own ? address : null);
  const publishedCalls = usePublishedCalls(address, !own);
  const positions = own ? ownPositions : publishedCalls;
  const queryClient = useQueryClient();
  const takes = useQuery({
    queryKey: ["owarine", "takes", "authors", address],
    queryFn: ({ signal }) => readTakes(address, signal),
    staleTime: TAKES_STALE_MS,
  });
  const takesFeed = useMemo<ActivityFeed | null>(
    () => (takes.data ? { configured: takes.data.configured, items: takes.data.takes.map(takeItem), takes: takes.data.takes } : null),
    [takes.data],
  );

  return (
    <>
      <section className="prf-section" aria-label={PROFILE.calls.title}>
        <SectionHeader index={PROFILE.calls.number} title={PROFILE.calls.title} desc={own ? PROFILE.calls.desc : PROFILE.callsPublishedDesc} className="lb-section-head" />
        <div className="bets-plate">
          <ReadingBoundary
            reading={positions}
            shape="row"
            retry={() => void queryClient.invalidateQueries({ queryKey: own ? keys.positions(address) : keys.published(address, "calls") })}
            isEmpty={(value) => value.length === 0}
            empty={{ why: PROFILE.calls.none }}
          >
            {(value) => (
              <ul className="bets-list">
                {value.map((position) => (
                  <BetRow key={position.marketId} position={position} symbol={units.symbol} nowMs={nowMs} />
                ))}
              </ul>
            )}
          </ReadingBoundary>
        </div>
      </section>

      <section className="prf-section" aria-label={PROFILE.takes.title}>
        <SectionHeader index={PROFILE.takes.number} title={PROFILE.takes.title} desc={PROFILE.takes.desc} className="lb-section-head" />
        <ActivityList feed={takesFeed} failed={takes.isError} units={units} showWho={false} empty={PROFILE.takes.none} />
      </section>
    </>
  );
}
