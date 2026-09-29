"use client";

import type { Address } from "@agari/core/types";
import { useMemo } from "react";
import { useWalletShell } from "./wallet-shell-context";

/**
 * The desk's live-leg session (D-126 on Canton, C8f K-090). The reference re-wrapped the connected wallet for Solana
 * mainnet; on Canton the live desk is a `DeskMandate` owned by the leased seat, and its owner writes go through the
 * app's routes (`/api/ledger/desk/*`) as that seat. So a held seat that can sign IS the session: nothing else is asked.
 *
 * The names stay (`MAINNET_*`, `useMainnetWalletSession`) because the desk's hooks and the phone's shim import them.
 */
export const MAINNET_CHAIN = "canton:mainnet";
/** The desk's live-leg reads and writes: the app's own ledger routes. */
export const MAINNET_RPC_PATH = "/api/ledger";

export type MainnetWalletSession =
  | { kind: "ready"; address: Address; signer: { readonly address: Address }; rpcUrl: string }
  | { kind: "restoring" }
  | { kind: "no-wallet" }
  | { kind: "unsupported"; address: Address; why: string };

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
