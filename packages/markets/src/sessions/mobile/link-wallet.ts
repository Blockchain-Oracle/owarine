import type { Address } from "@agari/core/types";
import type { WalletSession } from "../../react/wallet-session";
import { cantonNotLive, notDeployedError } from "../../stub/not-deployed";
import type { SeatSigner } from "../seat-signer";

/**
 * The reference's deeplink wallets (Phantom, Solflare) and Mobile Wallet Adapter. They sign Solana transactions, which
 * a Canton seat never does, so the names are kept as typed stubs for the phone's wallet island until lane 1e replaces
 * it with the seat drawer: connecting refuses with the not-deployed reason, and nothing is opened or signed.
 */
export type LinkWalletName = "phantom" | "solflare";

/** The app's side of a hand-off: open the wallet's link, resolve with the query of the redirect back into the app. */
export interface LinkPort {
  roundTrip(url: string, method: string): Promise<URLSearchParams>;
  redirectFor(method: string): string;
}

/** What a connected link wallet kept across launches. */
export interface LinkWalletState {
  wallet: LinkWalletName;
  address: Address;
  session: string;
  dappSecretKey: string;
  walletEncryptionKey: string;
}

export class WalletLinkError extends Error {
  constructor(readonly code: string, message: string) {
    super(code === "4001" ? "User rejected the request." : message);
    this.name = "WalletLinkError";
  }
}

/** A byte-level wallet's transaction signer (the reference's MWA and deeplink hand-off). */
export type SignWireTransactions = (wire: Uint8Array[], abortSignal?: AbortSignal) => Promise<Uint8Array[]>;

const NOT_ON_CANTON = cantonNotLive("external Solana wallets (the seat signs instead)");
const refuse = (): Promise<never> => Promise.reject(notDeployedError(NOT_ON_CANTON));

export async function connectLinkWallet(_wallet: LinkWalletName, _port: LinkPort, _appUrl: string, _cluster: string): Promise<LinkWalletState> {
  return refuse();
}

export function linkWalletSession(state: LinkWalletState, _port: LinkPort): WalletSession {
  return { address: state.address, signer: bytesSigner(state.address, refuse), signMessage: refuse };
}

export async function disconnectLinkWallet(_state: LinkWalletState, _port: LinkPort): Promise<void> {}

/** A signer over a byte-level wallet: its signatures refuse, because a seat never signs a Solana transaction. */
export function bytesSigner(address: Address, _signWire: SignWireTransactions): SeatSigner {
  return { address, signMessage: refuse };
}
