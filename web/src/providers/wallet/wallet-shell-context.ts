"use client";

import type { Address } from "@agari/core/types";
import type { WalletSession as MarketsWalletSession } from "@agari/markets/react";
import { createContext, useContext } from "react";

/**
 * The seat shell's state as every consumer (header, tickets, `useWalletSession`) reads it, with no key or storage
 * import, so only `web/src/providers/wallet` touches the seat key.
 *
 * - `restoring`: a browser that holds a seat is reading its key back from IndexedDB after hydration.
 * - `ready`: everything else, including the server render, hydration and a browser with no seat; `address` and
 *   `wallet` are authoritative.
 */
export type WalletShellStatus = "restoring" | "ready";

export interface WalletShellState {
  status: WalletShellStatus;
  /** A user-initiated "Take a seat" is in flight (the picker shows it). */
  connecting: boolean;
  address: Address | null;
  /** The D-014 seam handed to markets: present only while a seat key that can sign is held. */
  wallet: MarketsWalletSession | null;
}

export interface WalletShellActions {
  /** Opens the seat modal ("Take a seat"). */
  openPicker(): void;
  /** Opens the account modal for the held seat (Masayume's RainbowKit `openAccountModal`). */
  openAccount(): void;
  /** Resets the seat: its key is forgotten for good (the name stays for the phone's shell). */
  disconnect(): Promise<void>;
}

export type WalletShell = WalletShellState & WalletShellActions;

export const DISCONNECTED: WalletShellState = { status: "restoring", connecting: false, address: null, wallet: null };

export const WalletShellContext = createContext<WalletShell>({
  ...DISCONNECTED,
  openPicker: () => undefined,
  openAccount: () => undefined,
  disconnect: async () => undefined,
});

export function useWalletShell(): WalletShell {
  return useContext(WalletShellContext);
}
