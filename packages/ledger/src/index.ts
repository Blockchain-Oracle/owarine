/**
 * `@agari/ledger`: the server-only JSON Ledger API v2 client (Canton 3.5.x).
 *
 * Server-only by contract, not by `import "server-only"`: ops is plain Node, so the guard lives in
 * the web tier (`web/src/lib/ledger.server.ts`). Never import this package from client code: it
 * reads the ledger credential from the environment.
 */
export const LEDGER_PACKAGE = "@agari/ledger" as const;

export * from "./auth";
export * from "./client";
export * from "./env";
export * from "./errors";
export * from "./ids";
export * from "./types";
export * from "./units";
export * from "./updates";
