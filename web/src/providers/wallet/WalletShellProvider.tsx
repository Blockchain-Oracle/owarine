"use client";

import { joinSeatLink, type SeatLeaseView } from "@owarine/markets";
import { keys, type WalletSession as MarketsWalletSession } from "@owarine/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { webEnv } from "@/lib/env";
import { AccountModal } from "./AccountModal";
import { SeatLeaseContext } from "./seat-lease-context";
import { SeatLeaseDialog } from "./SeatLeaseDialog";
import { hasSeatMarker, loadSeat, resetSeat, seatSigner, takeSeat, type StoredSeat } from "./seat-client";
import { useSeatLeaseController } from "./useSeatLeaseController";
import { WalletPicker } from "./WalletPicker";
import { WalletShellContext, type WalletShell } from "./wallet-shell-context";

const subscribeNothing = () => () => undefined;

/**
 * Owns the seat (plan §2, §4): the browser's non-extractable ed25519 seat key, which is the app's connected account,
 * and its lease on a Canton party (`/api/seat`, an HttpOnly cookie).
 *
 * - **Server render and hydration:** the state is always "ready, disconnected", so "Take a seat" is in the first paint
 *   on both sides.
 * - **After hydration:** "restoring" only while a browser that holds a seat (`owarine.seat`) reads its key back from
 *   IndexedDB, a few milliseconds. A browser without one is ready at once.
 * - A seat and its lease are only ever taken on an explicit click, never on page load (the lease rule, plan §4). A
 *   returning browser reads its lease (which renews it); a lapsed one is offered again from the account menu.
 * - "Reset seat" lets the lease go first (the server drains the party), then forgets the key. On a browser that joined
 *   another device's seat (the seat link), the server takes only this key off the seat.
 */
export function WalletShellProvider({ children }: { children: ReactNode }) {
  const hydrated = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const remembered = useSyncExternalStore(subscribeNothing, hasSeatMarker, () => false);
  const [seat, setSeat] = useState<StoredSeat | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  /** The reader just asked for a seat and the lease did not land: the lease dialog says why (pool full, refused). */
  const [asked, setAsked] = useState(false);

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
  const signer = useMemo(() => (seat === null ? null : seatSigner(seat)), [seat]);
  const lease = useSeatLeaseController({ signer, cluster: webEnv.markets.cluster });

  const wallet = useMemo<MarketsWalletSession | null>(() => {
    if (seat === null || signer === null) return null;
    return { address: seat.address, signer, signMessage: signer.signMessage };
  }, [seat, signer]);

  const { leaseWith, release } = lease;
  const take = useCallback(async (): Promise<boolean> => {
    setConnecting(true);
    try {
      // A browser that already holds a key (its lease lapsed) keeps it: the same address asks again.
      // The modal keeps its "Taking a seat" step until the lease answers; the seat is shown held after that.
      const next = seat ?? (await takeSeat());
      const view = await leaseWith(seatSigner(next));
      setSeat(next);
      if (view?.kind !== "leased") setAsked(true);
      return true;
    } catch {
      return false;
    } finally {
      setConnecting(false);
    }
  }, [seat, leaseWith]);

  const queryClient = useQueryClient();
  const joinSeat = useCallback(
    async (code: string) => {
      // A browser with no key makes one to join with; if the join is refused, that new key is forgotten again.
      const next = seat ?? (await takeSeat());
      const joined = await joinSeatLink(seatSigner(next), code, webEnv.markets.cluster);
      if (joined.ok && joined.value.kind === "leased") {
        setSeat(next);
        queryClient.setQueryData<SeatLeaseView>(keys.seatLease(), joined.value);
      } else if (seat === null) await resetSeat();
      return joined;
    },
    [seat, queryClient],
  );

  const openPicker = useCallback(() => setPickerOpen(true), []);
  const openAccount = useCallback(() => setAccountOpen(true), []);
  const disconnect = useCallback(async () => {
    setAsked(false);
    await release();
    setSeat(null);
    await resetSeat();
  }, [release]);

  const value = useMemo<WalletShell>(
    () => ({ status: restoring ? "restoring" : "ready", connecting, address, wallet, openPicker, openAccount, disconnect, joinSeat }),
    [restoring, connecting, address, wallet, openPicker, openAccount, disconnect, joinSeat],
  );

  return (
    <WalletShellContext.Provider value={value}>
      <SeatLeaseContext.Provider value={lease}>
        {children}
        <WalletPicker open={pickerOpen} onOpenChange={setPickerOpen} takeSeat={take} held={address !== null} />
        <AccountModal open={accountOpen} onOpenChange={setAccountOpen} address={address} onDisconnect={disconnect} />
        <SeatLeaseDialog asked={asked} onDismiss={() => setAsked(false)} />
      </SeatLeaseContext.Provider>
    </WalletShellContext.Provider>
  );
}
