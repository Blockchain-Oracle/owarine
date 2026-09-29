import type { MainnetWalletSession } from "@/providers/wallet/mainnet-signer";
import { useMemo } from "react";
import { useWalletShell } from "@/providers/wallet/wallet-shell-context";
import { SITE_URL } from "~/lib/env";

/**
 * Stands in for web/src/providers/wallet/mainnet-signer.ts on the phone. On Canton (C8f, K-090) the live desk is the
 * leased seat's `DeskMandate` and its owner writes go through the app's routes as that seat, so a held seat that can
 * sign is the session, exactly as on the web.
 */
export const MAINNET_CHAIN = "canton:mainnet";
/** Absolute on a phone: the app's ledger routes at the site's origin. */
export const MAINNET_RPC_PATH = `${SITE_URL}/api/ledger`;

export type { MainnetWalletSession };

const WHY = "Take a seat that can sign to run a live desk. Practice desks, approvals, Check now and sharing still work.";

export function useMainnetWalletSession(): MainnetWalletSession {
  const shell = useWalletShell();
  const address = shell.status === "ready" ? shell.address : null;
  const held = shell.status === "ready" && shell.wallet !== null;
  return useMemo<MainnetWalletSession>(() => {
    if (shell.status === "restoring") return { kind: "restoring" };
    if (address === null) return { kind: "no-wallet" };
    if (!held) return { kind: "unsupported", address, why: WHY };
    return { kind: "ready", address, signer: { address }, rpcUrl: MAINNET_RPC_PATH };
  }, [shell.status, address, held]);
}
