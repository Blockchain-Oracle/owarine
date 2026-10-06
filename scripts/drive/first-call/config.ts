/**
 * `first-call.ts` configuration (C2z): which network, which web, which ops, which parties file. Pure: argv, env and the
 * home directory come in, a config or a reason comes out, so the DevNet path is unit-tested without touching Noders
 * (`config.test.ts`).
 *
 *   local   an unauthenticated sandbox (`LEDGER_AUTH_MODE=none`), the web on :3120, ops on :8727, the parties file the
 *           bootstrap wrote (`AGARI_PARTIES_FILE`, default ~/.config/agari/canton/parties.json). `--ops-pid` lets the
 *           stale step freeze ops (SIGSTOP) for its whole life and thaw it after (SIGCONT).
 *   devnet  Noders: the platform user's token (`LEDGER_AUTH_MODE=password`, the `LEDGER_OIDC_*` names from
 *           ~/.config/agari/canton/devnet.env), an https web, the parties file `bootstrap-devnet.ts` wrote
 *           (~/.config/agari/canton/parties.devnet.json). Ops runs on Coolify, or on this Mac with the web on
 *           http://localhost (C4g): the stale step runs only with `--ops-stopped` (ops stopped by hand first), never by
 *           signalling a process.
 */
import { join, relative, resolve } from "node:path";

export type Network = "local" | "devnet";
export const STEPS = ["main", "void", "stale"] as const;
export type Step = (typeof STEPS)[number];

export interface FirstCallConfig {
  network: Network;
  /** The web origin the seats call (`/api/seat`, `/api/ledger/*`, `/api/view`). */
  web: string;
  /** Ops' base URL for `/health`; null when it is not reachable from here. */
  ops: string | null;
  partiesPath: string;
  /** The real lane the main market trades on (ops rolls, prints, quotes, resolves and settles it). */
  lane: string;
  /** Seat A's stake on the main market, in credits (the demo's "100 Up at 62" is 62). */
  stakeCredits: number;
  /** Local only: ops' pid, frozen with SIGSTOP for the stale step. */
  opsPid: number | null;
  /** DevNet: the operator stopped pm-ops before this run. */
  opsStopped: boolean;
  steps: ReadonlySet<Step>;
  stage: string;
}

type Env = Record<string, string | undefined>;

/**
 * A web on this machine: until there is a domain, this Mac's `next start` stands in for Coolify against DevNet (C4g).
 * Loopback is a secure context in a browser, so the seat key works there as it does on https.
 */
const LOOPBACK_HTTP = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

const valueOf = (argv: readonly string[], name: string): string | undefined => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const expandHome = (p: string, home: string) => resolve(p.replace(/^~(?=\/|$)/, home));

export function firstCallConfig(argv: readonly string[], env: Env, o: { home: string; repo: string }): FirstCallConfig | { error: string } {
  const network = (valueOf(argv, "--network") ?? "local") as Network;
  if (network !== "local" && network !== "devnet") return { error: `--network must be local or devnet (got ${network})` };

  const mode = env.LEDGER_AUTH_MODE ?? "none";
  const ledgerUrl = env.LEDGER_JSON_API_URL ?? "";
  if (network === "local" && mode !== "none") return { error: "--network local runs against an unauthenticated sandbox: LEDGER_AUTH_MODE=none" };
  if (network === "devnet") {
    if (mode !== "password") return { error: "--network devnet needs the platform user's token: LEDGER_AUTH_MODE=password and the LEDGER_OIDC_* names (tsx --env-file=~/.config/agari/canton/devnet.env)" };
    if (!/^https:\/\//.test(ledgerUrl)) return { error: "--network devnet needs an https LEDGER_JSON_API_URL" };
  }

  const web = (valueOf(argv, "--web") ?? env.AGARI_WEB_ORIGIN ?? (network === "local" ? "http://localhost:3120" : env.NEXT_PUBLIC_APP_ORIGIN ?? "")).replace(/\/+$/, "");
  if (!web) return { error: "--network devnet needs the web origin: --web https://<web domain> (or NEXT_PUBLIC_APP_ORIGIN)" };
  if (network === "devnet" && !web.startsWith("https://") && !LOOPBACK_HTTP.test(web)) return { error: "--network devnet calls the hosted web over https (or this machine's own web on http://localhost)" };

  const opsArg = valueOf(argv, "--ops") ?? (network === "local" ? "http://127.0.0.1:8727" : undefined);
  const ops = opsArg ? opsArg.replace(/\/+$/, "") : null;

  const defaultParties = join(o.home, ".config", "agari", "canton", network === "local" ? "parties.json" : "parties.devnet.json");
  const partiesPath = expandHome(valueOf(argv, "--parties") ?? (network === "local" ? env.AGARI_PARTIES_FILE : undefined) ?? defaultParties, o.home);
  if (!relative(o.repo, partiesPath).startsWith("..")) return { error: "the parties file lives outside the repo (party ids never go into Git)" };

  const pidArg = valueOf(argv, "--ops-pid");
  const opsPid = pidArg === undefined ? null : Number(pidArg);
  if (opsPid !== null && (!Number.isInteger(opsPid) || opsPid <= 1)) return { error: "--ops-pid must be a process id" };
  if (network === "devnet" && opsPid !== null) return { error: "--ops-pid is local only: on DevNet stop pm-ops in Coolify, then pass --ops-stopped" };

  const only = valueOf(argv, "--only");
  const picked = only ? only.split(",").map((s) => s.trim()).filter(Boolean) : [...STEPS];
  const unknown = picked.filter((s) => !(STEPS as readonly string[]).includes(s));
  if (unknown.length) return { error: `--only takes ${STEPS.join(",")} (got ${unknown.join(",")})` };

  const stakeCredits = Number(valueOf(argv, "--stake") ?? "62");
  if (!Number.isFinite(stakeCredits) || stakeCredits <= 0) return { error: "--stake must be a positive number of credits" };

  return {
    network, web, ops, partiesPath, lane: valueOf(argv, "--lane") ?? "BTC-1m", stakeCredits, opsPid,
    opsStopped: argv.includes("--ops-stopped"), steps: new Set(picked as Step[]), stage: valueOf(argv, "--stage") ?? "C2z",
  };
}

/** The row prefix names the network, so a local rehearsal row can never be read as a DevNet row. */
export const rowPrefix = (network: Network) => (network === "local" ? "first-call, local rehearsal: " : "first-call, DevNet: ");

/** Why the stale step cannot run with ops stopped here, or null when it can. */
export function staleBlocker(c: Pick<FirstCallConfig, "network" | "opsPid" | "opsStopped">): string | null {
  if (c.network === "local") return c.opsPid === null ? "pass --ops-pid <ops pid> so the drive can freeze ops for the stale window" : null;
  return c.opsStopped ? null : "ops is running on Coolify: stop pm-ops, then run `first-call.ts --network devnet --only stale --ops-stopped`";
}
