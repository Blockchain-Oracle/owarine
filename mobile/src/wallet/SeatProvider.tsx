import type { WalletSession } from "@agari/markets/react";
import { seatSession } from "@agari/markets/sessions/mobile";
import { router } from "expo-router";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { WalletShellContext, type WalletShell, type WalletShellState } from "@/providers/wallet/wallet-shell-context";
import { DEMO_TERMS_KEY } from "~/lib/keys";
import { storage } from "~/lib/storage";
import { createSeatKey, loadSeatKey, resetSeatKey } from "./seat-key-store";

/**
 * The server's half of a seat: a ledger party leased to this key over a signed canonical text. Not live yet (the
 * Canton adapter lands in C4), so the phone says so instead of pretending a lease exists.
 */
export type SeatLease = { status: "not-live" };

export interface SeatActions {
  /** The demo-credits terms were accepted on this install (the gate every seat passes). */
  termsAccepted: boolean;
  acceptTerms(): void;
  /** Loads this phone's seat key, or creates one; refuses until the terms are accepted. */
  takeSeat(): Promise<void>;
  /** Forgets the seat key for good; the next seat is a new key. */
  resetSeat(): Promise<void>;
  lease: SeatLease;
}

const READY_EMPTY: WalletShellState = { status: "ready", connecting: false, address: null, wallet: null };
const LEASE: SeatLease = { status: "not-live" };

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
  const inFlight = useRef<Promise<void> | null>(null);

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
        setState({ status: "ready", connecting: false, address: wallet.address, wallet });
      } catch (error) {
        setState((s) => ({ ...s, status: "ready", connecting: false }));
        throw error;
      } finally {
        inFlight.current = null;
      }
    })();
    inFlight.current = run;
    return run;
  }, []);

  const resetSeat = useCallback(async () => {
    await resetSeatKey();
    setState(READY_EMPTY);
  }, []);

  const shell = useMemo<WalletShell>(
    () => ({
      ...state,
      openPicker: () => router.push("/connect"),
      openAccount: () => router.push("/account"),
      // A seat has nothing to disconnect from: the only way out is a reset, reached from the account sheet's confirm.
      disconnect: resetSeat,
    }),
    [state, resetSeat],
  );
  const seat = useMemo<SeatActions>(() => ({ termsAccepted, acceptTerms, takeSeat, resetSeat, lease: LEASE }), [termsAccepted, acceptTerms, takeSeat, resetSeat]);

  return (
    <WalletShellContext.Provider value={shell}>
      <SeatContext.Provider value={seat}>{children}</SeatContext.Provider>
    </WalletShellContext.Provider>
  );
}
