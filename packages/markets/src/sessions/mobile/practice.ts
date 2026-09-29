import type { MarketsEnv } from "../../env";
import type { WalletSession } from "../../react/wallet-session";
import { signerFromSecretKey } from "../ed25519";
import { SEAT_KEY_BYTES } from "./seat";

/** The seed half of the seat key (the reference's practice wallet stored only this). */
export const PRACTICE_SEED_BYTES = 32;

/**
 * The reference's practice wallet (D-128), now the phone's seat. The name is kept for its call site; it takes the
 * 64-byte seat key (`seed ‖ public key`). A bare 32-byte seed from the reference's store is refused with a clear
 * reason rather than guessed: deriving the public half would need the private key exported, which markets never does.
 * The phone's seat island (C1 lane 1e) stores the full seat key.
 */
export async function practiceWalletSession(secretKey: Uint8Array, _env: Pick<MarketsEnv, "cluster">): Promise<WalletSession> {
  if (secretKey.length === PRACTICE_SEED_BYTES) throw new Error(`expected the ${SEAT_KEY_BYTES}-byte seat key (seed ‖ public key), got a bare seed`);
  const signer = await signerFromSecretKey(secretKey);
  return { address: signer.address, signer, signMessage: (message) => signer.signMessage(message) };
}
