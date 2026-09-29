"use client";

import type { Address } from "@agari/core/types";
import type { SeatSigner } from "@agari/markets/sessions";
import { useMemo } from "react";
import { useWalletShell } from "./wallet-shell-context";

/**
 * The desk's live-leg session (D-126, re-meant for Canton). The reference re-wrapped the connected wallet for Solana
 * mainnet; on Canton the live desk is a Canton desk whose live leg is gated on C7b (plan "Adapted rows"), so a seat is
 * refused here with the reason before anything is asked of it. Practice desks, approvals, Check now and sharing are
 * signed texts and never need this.
 *
 * The names stay (`MAINNET_*`, `useMainnetWalletSession`) because the desk's hooks and the phone's shim import them.
 */
export const MAINNET_CHAIN = "canton:mainnet";
/** Where the desk's live-leg reads will go (the app's own ledger routes, C7b); the C1 desk reader never fetches it. */
export const MAINNET_RPC_PATH = "/api/ledger";

export type MainnetWalletSession =
  | { kind: "ready"; address: Address; signer: SeatSigner; rpcUrl: string }
  | { kind: "restoring" }
  | { kind: "no-wallet" }
  | { kind: "unsupported"; address: Address; why: string };

const WHY = "The desk's live leg on Canton is not live yet (C1 stub). Practice desks, approvals, Check now and sharing still work.";

export function useMainnetWalletSession(): MainnetWalletSession {
  const shell = useWalletShell();
  const address = shell.status === "ready" ? shell.address : null;
  return useMemo<MainnetWalletSession>(() => {
    if (shell.status === "restoring") return { kind: "restoring" };
    if (address === null) return { kind: "no-wallet" };
    return { kind: "unsupported", address, why: WHY };
  }, [shell.status, address]);
}
