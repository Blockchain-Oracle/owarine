/**
 * Ops reads its local env files before anything else runs (C6e). The reference's `ops:start` passed
 * `tsx --env-file-if-exists=../../.env.local`, so a plain `tsx src/main.ts` or a drive launcher (`scripts/drive/ops-local.ts`)
 * started without its keys and the Regular lanes read "closed: no calendar". Importing this module first gives every
 * launcher the same files:
 *
 *   services/ops/.env.local   ops' own keys (ALPACA_*, FINNHUB_API_KEY, PYTH_API_KEY …; gitignored)
 *   .env.local                the repo root's, as the reference's `ops:start` read it
 *
 * A variable already in the environment is never overridden, even when it is empty, and the ops file wins over the root
 * one. `OPS_ENV_FILES=0` turns the loading off (a test or a deploy that injects its own env). Values are never logged;
 * only the file names and the count of variables taken are.
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

export const OPS_ENV_FILES: readonly string[] = [
  fileURLToPath(new URL("../../.env.local", import.meta.url)),
  fileURLToPath(new URL("../../../../.env.local", import.meta.url)),
];

export interface LoadedEnvFile {
  path: string;
  /** Names taken from the file (never values). */
  taken: string[];
}

/** Loads each existing file into `env` without overriding a variable that is already set. Returns what was taken. */
export function loadEnvFiles(paths: readonly string[], env: NodeJS.ProcessEnv = process.env): LoadedEnvFile[] {
  const out: LoadedEnvFile[] = [];
  for (const path of paths) {
    if (!existsSync(path)) continue;
    const parsed = parseEnv(readFileSync(path, "utf8"));
    const taken: string[] = [];
    for (const [name, value] of Object.entries(parsed)) {
      if (name in env) continue;
      env[name] = value;
      taken.push(name);
    }
    out.push({ path, taken });
  }
  return out;
}

export const loadedEnvFiles: LoadedEnvFile[] = process.env.OPS_ENV_FILES === "0" ? [] : loadEnvFiles(OPS_ENV_FILES);
