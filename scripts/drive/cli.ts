// The small argv and key-file helpers the kept drive scripts share (they lived in the Solana-era deploy/ops-cluster.ts,
// deleted with the Anchor deploy scripts in C1). Server-only; a secret is never printed.

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const arg = (name: string, fallback: string) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1]! : fallback);
export const flag = (name: string) => process.argv.includes(name);
export const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;

/**
 * An operator role's 64-byte ed25519 key (seed ‖ public key) from `AGARI_KEYS_DIR` (default `~/.config/agari/devnet`),
 * the file layout `services/ops/src/runtime/keys.ts` reads. Off-ledger signatures only: on Canton a role acts on the
 * ledger as a party through `@agari/ledger`, never with this key.
 */
export function roleSecret(role: string): Uint8Array {
  const path = join(process.env.AGARI_KEYS_DIR || join(homedir(), ".config", "agari", "devnet"), `${role}.json`);
  const bytes = readJson<number[]>(path);
  if (!Array.isArray(bytes) || bytes.length !== 64) throw new Error(`${path} is not a 64-byte ed25519 key`);
  return Uint8Array.from(bytes);
}
