"use client";

import type { WalletSession as MarketsWalletSession } from "@agari/markets/react";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { AccountModal } from "./AccountModal";
import { hasSeatMarker, loadSeat, resetSeat, seatSigner, takeSeat, type StoredSeat } from "./seat-client";
import { WalletPicker } from "./WalletPicker";
import { WalletShellContext, type WalletShell } from "./wallet-shell-context";

const subscribeNothing = () => () => undefined;

/**
 * Owns the seat (plan §2, §4): the browser's non-extractable ed25519 seat key, which is the app's connected account.
 *
 * - **Server render and hydration:** the state is always "ready, disconnected", so "Take a seat" is in the first paint
 *   on both sides.
 * - **After hydration:** "restoring" only while a browser that holds a seat (`agari.seat`) reads its key back from
 *   IndexedDB, a few milliseconds. A browser without one is ready at once.
 * - A seat is only ever taken on an explicit click, never on page load (the lease rule, plan §4).
 */
export function WalletShellProvider({ children }: { children: ReactNode }) {
  const hydrated = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const remembered = useSyncExternalStore(subscribeNothing, hasSeatMarker, () => false);
  const [seat, setSeat] = useState<StoredSeat | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    let live = true;
    void loadSeat().then((stored) => {
      if (!live) return;
      setSeat((now) => now ?? stored);
      setLoaded(true);
    });
    return () => {
      live = false;
    };
  }, [hydrated]);

  const restoring = hydrated && remembered && !loaded;
  const address = seat?.address ?? null;

  const wallet = useMemo<MarketsWalletSession | null>(() => {
    if (seat === null) return null;
    const signer = seatSigner(seat);
    return { address: seat.address, signer, signMessage: signer.signMessage };
  }, [seat]);

  const take = useCallback(async (): Promise<boolean> => {
    setConnecting(true);
    try {
      setSeat(await takeSeat());
      return true;
    } catch {
      return false;
    } finally {
      setConnecting(false);
    }
  }, []);

  const openPicker = useCallback(() => setPickerOpen(true), []);
  const openAccount = useCallback(() => setAccountOpen(true), []);
  const disconnect = useCallback(async () => {
    setSeat(null);
    await resetSeat();
  }, []);

  const value = useMemo<WalletShell>(
    () => ({ status: restoring ? "restoring" : "ready", connecting, address, wallet, openPicker, openAccount, disconnect }),
    [restoring, connecting, address, wallet, openPicker, openAccount, disconnect],
  );

  return (
    <WalletShellContext.Provider value={value}>
      {children}
      <WalletPicker open={pickerOpen} onOpenChange={setPickerOpen} takeSeat={take} held={address !== null} />
      <AccountModal open={accountOpen} onOpenChange={setAccountOpen} address={address} onDisconnect={disconnect} />
    </WalletShellContext.Provider>
  );
}
