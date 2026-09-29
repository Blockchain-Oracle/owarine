/**
 * Boot checks (Next `instrumentation`): the Node-only part is imported under `NEXT_RUNTIME === "nodejs"`, so the edge
 * bundle never pulls in `node:fs` or the ledger client.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") await import("./instrumentation-node");
}
