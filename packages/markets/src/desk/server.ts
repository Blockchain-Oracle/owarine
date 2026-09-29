/**
 * `@agari/markets/desk/server`: the desk barrel plus the operator (`operator.ts`), which reaches the ledger client and
 * so must never enter a browser bundle. Ops and server code import from here; the app imports `@agari/markets/desk`.
 */
export * from "./index";
export * from "./operator";
