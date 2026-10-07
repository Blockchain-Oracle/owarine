"use client";

import { useCallback, useMemo, useState } from "react";
import { KNOWN_WALLETS, SEAT_CONNECTOR, type KnownWallet } from "./copy";

/** One way to be seated, shaped as a RainbowKit listed wallet so the connect ladder keeps its rows (plan §F). */
export interface SeatConnector {
  id: string;
  name: string;
  icon: string;
}

export type DiscoveredWallet = SeatConnector;
export type ConnectOutcome = "connected" | "failed" | "aborted";

/** RainbowKit's `rk-recent` for this app: the connector last used, kept after a reset so it can say "Recent". */
const RECENT_KEY = "agari.seat.recent";

function readRecent(): string | null {
  try {
    return window.localStorage.getItem(RECENT_KEY);
  } catch {
    return null;
  }
}

function writeRecent(id: string): void {
  try {
    window.localStorage.setItem(RECENT_KEY, id);
  } catch {
    // Blocked storage only costs the "Recent" tag.
  }
}

export interface WalletChoices {
  /** Connectors that work in this browser now, the recent one first (RainbowKit's "Installed"): the guest seat. */
  installed: ReadonlyArray<{ wallet: DiscoveredWallet; recent: boolean }>;
  /** Connectors offered but not available here (Masayume's "Browser" group). Empty until a wallet connector lands. */
  browser: readonly KnownWallet[];
  connect(wallet: DiscoveredWallet): Promise<ConnectOutcome>;
}

/** The connect modal's data: the seat connectors (plan §F), shaped as RainbowKit listed wallets. */
export function useWalletChoices(takeSeat: () => Promise<boolean>): WalletChoices {
  const [recent, setRecent] = useState<string | null>(readRecent);

  const installed = useMemo(() => [{ wallet: SEAT_CONNECTOR, recent: recent === SEAT_CONNECTOR.id }], [recent]);

  const connect = useCallback(
    async (wallet: DiscoveredWallet): Promise<ConnectOutcome> => {
      if (wallet.id !== SEAT_CONNECTOR.id) return "failed";
      if (!(await takeSeat())) return "failed";
      writeRecent(wallet.id);
      setRecent(wallet.id);
      return "connected";
    },
    [takeSeat],
  );

  return { installed, browser: KNOWN_WALLETS, connect };
}
