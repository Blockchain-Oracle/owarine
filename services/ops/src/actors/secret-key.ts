import { parseSecretKey } from "@owarine/markets/sessions";

/**
 * A role key from the environment: a 64-byte Solana keypair, as the Solana CLI JSON array or base58
 * (`~/.config/owarine/devnet/<role>.json`). Missing or malformed means scan-and-report, never a guessed signer.
 */
export function readSecretKey(value: string | undefined): Uint8Array | null {
  if (!value) return null;
  try {
    return parseSecretKey(value);
  } catch {
    return null;
  }
}
