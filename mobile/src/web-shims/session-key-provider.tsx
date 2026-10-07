import type { TxOutcome } from "@owarine/core/ports";
import { diagnosis } from "@owarine/core/types";
import type { SubmitterSession } from "@owarine/markets";
import type { ReactNode } from "react";
import { SEAT } from "~/wallet/seat-copy";
import type { EnableOutcome, SessionBusy, SessionKeyActions, SessionKeyView } from "@/features/session/view";
import { useWalletSession } from "@/lib/wallet-session";

/**
 * Stands in for web/src/features/session/SessionKeyProvider.tsx (metro's WEB_SHIMS map), as a no-op. Tap-trading keys
 * are not needed on Canton: a seat already trades in one tap (plan "Allowed deviations"), so the phone keeps no second
 * key. Web's `useTicketRoute` still reads `useSessionKey()`; it gets a view with nothing armed and no vault deployed,
 * so every bet routes from the seat, and every action refuses with the reason instead of signing anything.
 */
interface SessionKeyContextValue {
  view: SessionKeyView;
  session: SubmitterSession | null;
  actions: SessionKeyActions;
  busy: SessionBusy;
  demandSponsor: () => () => void;
}

const refused: TxOutcome = { status: "refused", diagnosis: diagnosis("not-deployed", SEAT.fast.why) };
const refusedEnable: EnableOutcome = { outcome: refused, topUpHash: null, topUpError: null };
const ACTIONS: SessionKeyActions = {
  enable: async () => refusedEnable,
  rekey: async () => refusedEnable,
  revoke: async () => refused,
  topUp: async () => null,
  forget: async () => undefined,
};
const release = () => undefined;

export function SessionKeyProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useSessionKey(): SessionKeyContextValue {
  const { address } = useWalletSession();
  const view: SessionKeyView = {
    status: address ? "not-deployed" : "no-wallet",
    owner: address,
    key: null,
    grant: null,
    deployment: null,
    decimals: 0,
    nowSec: Math.floor(Date.now() / 1000),
    sponsor: null,
    sponsorRefusal: null,
    keyFeeLamports: null,
    vaultAvailableBase: null,
  };
  return { view, session: null, actions: ACTIONS, busy: null, demandSponsor: () => release };
}

export function useSponsorWhileOpen(_open: boolean): void {}
