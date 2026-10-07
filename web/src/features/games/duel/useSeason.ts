"use client";

import type { PrizeTier } from "@owarine/core/games";
import { useEffect, useState } from "react";

/** The wire from `/api/games/season`, with the escrow's money as bigint. */
export interface SeasonView {
  id: string;
  name: string;
  endsAt: string;
  prizeSplit: readonly PrizeTier[];
  minStakedDuels: number;
  eligibilityNote: string;
  prizePool: { totalUnits: number; currency: string };
  escrow: {
    address: string;
    balanceBase: bigint;
    depositedBase: bigint;
    distributed: boolean;
    decimals: number;
    symbol: string;
  } | null;
}

interface Wire {
  season: (Omit<SeasonView, "escrow"> & { prizeSplit: PrizeTier[] }) | null;
  escrow: { address: string; balanceBase: string; depositedBase: string; distributed: boolean; decimals: number; symbol: string } | null;
}

/** A failed read is retried this often; until then the page says the season is unread, never that there is none. */
const RETRY_MS = 30_000;

export interface SeasonRead {
  /** `undefined` until the route answers, `null` when the operator named no season. */
  season: SeasonView | null | undefined;
  /** The last read failed (network or a non-JSON answer): whether a season exists is unknown. */
  failed: boolean;
}

/**
 * The season — Flicky's `fetchSeason`, with the escrow read beside the config. A failed read is not "no season"
 * (C9e): it is said as unread and retried.
 */
export function useSeasonRead(): SeasonRead {
  const [read, setRead] = useState<SeasonRead>({ season: undefined, failed: false });
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = () =>
      fetch("/api/games/season")
        .then((r) => {
          if (!r.ok) throw new Error(`season ${r.status}`);
          return r.json() as Promise<Wire>;
        })
        .then((wire) => {
          if (cancelled) return;
          if (!wire.season) return setRead({ season: null, failed: false });
          setRead({
            failed: false,
            season: {
              ...wire.season,
              escrow: wire.escrow ? { ...wire.escrow, balanceBase: BigInt(wire.escrow.balanceBase), depositedBase: BigInt(wire.escrow.depositedBase) } : null,
            },
          });
        })
        .catch(() => {
          if (cancelled) return;
          setRead((prev) => ({ season: prev.season ?? undefined, failed: true }));
          timer = setTimeout(() => void load(), RETRY_MS);
        });
    void load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);
  return read;
}

/** The season alone, for the banner: `undefined` while unread (loading or failed), `null` when there is none. */
export function useSeason(): SeasonView | null | undefined {
  return useSeasonRead().season;
}

/** Which intro the ladder may say, from what was actually read: never "no season" while unread. */
export type SeasonIntroKey = "introLoading" | "introUnread" | "intro" | "introSeason" | "introSeasonUnescrowed";

export function seasonIntroKey({ season, failed }: SeasonRead): SeasonIntroKey {
  if (season === undefined) return failed ? "introUnread" : "introLoading";
  if (season === null) return "intro";
  return season.escrow ? "introSeason" : "introSeasonUnescrowed";
}
