import { diagnosis } from "@agari/core/types";
import { joinSeatLink, type LedgerCallResult, type SeatLeaseView } from "@agari/markets";
import { keys, type WalletSession } from "@agari/markets/react";
import { seatSession } from "@agari/markets/sessions/mobile";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { SeatLeaseContext, type SeatLeaseState } from "@/providers/wallet/seat-lease-context";
import { useSeatLeaseController } from "@/providers/wallet/useSeatLeaseController";
import { WalletShellContext, type WalletShell, type WalletShellState } from "@/providers/wallet/wallet-shell-context";
import { marketsEnv } from "~/lib/env";
import { DEMO_TERMS_KEY } from "~/lib/keys";
import { storage } from "~/lib/storage";
import { SEAT } from "./seat-copy";
import { createSeatKey, loadSeatKey, resetSeatKey } from "./seat-key-store";

/**
 * The server's half of a seat: a ledger party leased to this key over a signed canonical text (`/api/seat`, proven by
 * the signed seat header, since the phone has no cookie). Web's lease controller, shared as is.
 */
export type SeatLease = SeatLeaseState;

export interface SeatActions {
  /** The demo-credits terms were accepted on this install (the gate every seat passes). */
  termsAccepted: boolean;
  acceptTerms(): void;
  /**
   * Loads this phone's seat key, or creates one, and leases it a party; refuses until the terms are accepted. It resolves
   * with the lease's answer: a leased party, or `pool-full` (the key is kept, and the lease controller keeps asking); a
   * refusal or a network that is not taking seats throws.
   */
  takeSeat(): Promise<SeatLeaseView | null>;
  /**
   * Lets the lease go (the server drains the party; a phone joined to another device's seat only leaves it), then
   * forgets the seat key for good; the next seat is a new key.
   */
  resetSeat(): Promise<void>;
  lease: SeatLease;
}

const READY_EMPTY: WalletShellState = { status: "ready", connecting: false, address: null, wallet: null };

const SeatContext = createContext<SeatActions | null>(null);

export function useSeat(): SeatActions {
  const ctx = useContext(SeatContext);
  if (!ctx) throw new Error("useSeat needs the SeatProvider above it");
  return ctx;
}

/** The markets seam for a seat key: its base58 address, and its signer as both `signer` and `signMessage`. */
async function sessionOf(secretKey: Uint8Array): Promise<WalletSession> {
  try {
    const seat = await seatSession(secretKey);
    return { address: seat.address, signer: seat, signMessage: (message) => seat.signMessage(message) };
  } finally {
    secretKey.fill(0);
  }
}

/**
 * The phone's seat (plan, iOS section step 2): fills web's own WalletShellContext, so every web hook that reads the
 * wallet (useWalletSession, signed texts, push, UserSessionProvider) runs unchanged with a seat in it. There are no
 * wallet kinds: a seat is one key on this phone. A stored seat is restored silently at launch; a new one is created
 * only by `takeSeat`, after the demo-credits terms (`DEMO_TERMS_KEY`) were accepted.
 */
export function SeatProvider({ children }: { children: ReactNode }) {
  const [termsAccepted, setTermsAccepted] = useState(() => storage.getBoolean(DEMO_TERMS_KEY) === true);
  const [state, setState] = useState<WalletShellState>(() => (termsAccepted ? { ...READY_EMPTY, status: "restoring" } : READY_EMPTY));
  const inFlight = useRef<Promise<SeatLeaseView | null> | null>(null);
  const lease = useSeatLeaseController({ signer: state.wallet?.signer ?? null, cluster: marketsEnv.cluster });
  const { leaseWith, release } = lease;

  useEffect(() => {
    if (!termsAccepted) return;
    let cancelled = false;
    loadSeatKey()
      .then((key) => (key ? sessionOf(key) : null))
      .then(
        (wallet) => { if (!cancelled) setState(wallet ? { status: "ready", connecting: false, address: wallet.address, wallet } : READY_EMPTY); },
        () => { if (!cancelled) setState(READY_EMPTY); },
      );
    return () => {
      cancelled = true;
    };
    // Restore once per launch; takeSeat and resetSeat set the state themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const acceptTerms = useCallback(() => {
    storage.set(DEMO_TERMS_KEY, true);
    setTermsAccepted(true);
  }, []);

  const takeSeat = useCallback(() => {
    if (inFlight.current) return inFlight.current;
    // The flag is re-read from storage, not from state: the gate that sets it may have run in this same tick.
    if (storage.getBoolean(DEMO_TERMS_KEY) !== true) return Promise.reject(new Error("Accept the demo-credits terms before taking a seat."));
    setState((s) => ({ ...s, connecting: true }));
    const run = (async () => {
      try {
        const wallet = await sessionOf((await loadSeatKey()) ?? (await createSeatKey()));
        // The lease is asked for on this explicit tap only; a full pool keeps asking by itself (the controller).
        const view = await leaseWith(wallet.signer ?? { address: wallet.address, signMessage: wallet.signMessage });
        setState({ status: "ready", connecting: false, address: wallet.address, wallet });
        if (view?.kind === "refused") throw new Error(view.diagnosis.technical);
        if (view?.kind === "not-live") throw new Error(view.reason);
        return view;
      } catch (error) {
        setState((s) => ({ ...s, status: "ready", connecting: false }));
        throw error;
      } finally {
        inFlight.current = null;
      }
    })();
    inFlight.current = run;
    return run;
  }, [leaseWith]);

  const queryClient = useQueryClient();
  /**
   * The seat link (iOS step 2b): this phone's key (made now if it has none, after the demo-credits terms) signs the
   * join for the code another device shows, and uses that device's seat. A refused join forgets a key made for it.
   */
  const joinSeat = useCallback(
    async (code: string): Promise<LedgerCallResult<SeatLeaseView>> => {
      if (storage.getBoolean(DEMO_TERMS_KEY) !== true) return { ok: false, status: null, diagnosis: diagnosis("signer-required", SEAT.link.termsFirst) };
      const stored = await loadSeatKey();
      const wallet = await sessionOf(stored ?? (await createSeatKey()));
      const signer = wallet.signer ?? { address: wallet.address, signMessage: wallet.signMessage };
      const joined = await joinSeatLink(signer, code, marketsEnv.cluster);
      if (joined.ok && joined.value.kind === "leased") {
        setState({ status: "ready", connecting: false, address: wallet.address, wallet });
        queryClient.setQueryData<SeatLeaseView>(keys.seatLease(), joined.value);
      } else if (!stored) await resetSeatKey();
      return joined;
    },
    [queryClient],
  );

  const resetSeat = useCallback(async () => {
    await release();
    await resetSeatKey();
    setState(READY_EMPTY);
  }, [release]);

  const shell = useMemo<WalletShell>(
    () => ({
      ...state,
      openPicker: () => router.push("/connect"),
      openAccount: () => router.push("/account"),
      // A seat has nothing to disconnect from: the only way out is a reset, reached from the account sheet's confirm.
      disconnect: resetSeat,
      joinSeat,
    }),
    [state, resetSeat, joinSeat],
  );
  const seat = useMemo<SeatActions>(() => ({ termsAccepted, acceptTerms, takeSeat, resetSeat, lease }), [termsAccepted, acceptTerms, takeSeat, resetSeat, lease]);

  return (
    <WalletShellContext.Provider value={shell}>
      <SeatLeaseContext.Provider value={lease}>
        <SeatContext.Provider value={seat}>{children}</SeatContext.Provider>
      </SeatLeaseContext.Provider>
    </WalletShellContext.Provider>
  );
}
