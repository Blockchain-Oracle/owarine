/**
 * The drop-a-response proxy (plan "Verification", regressions): forwards one request to the web in full, waits until
 * the web has answered (so the submit has run to its end on the server), then destroys the client's socket without
 * writing a byte. The client sees a killed submit; the ledger saw a complete one. Re-sending the same commandId must
 * then reconcile to the landed transaction, never to a second Leg.
 */
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";

export interface DropProxy {
  url: string;
  /** Requests forwarded whose response was dropped, with the status the web answered. */
  dropped: Array<{ method: string; path: string; status: number }>;
  close: () => Promise<void>;
}

const HOP = new Set(["host", "connection", "content-length", "transfer-encoding", "keep-alive"]);

async function bodyOf(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return Buffer.concat(chunks);
}

export async function startDropProxy(target: string): Promise<DropProxy> {
  const dropped: DropProxy["dropped"] = [];
  const server: Server = createServer(async (req, res) => {
    const body = await bodyOf(req);
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.headers)) if (!HOP.has(k) && typeof v === "string") headers[k] = v;
    try {
      const upstream = await fetch(`${target}${req.url ?? "/"}`, { method: req.method ?? "GET", headers, ...(body.length ? { body } : {}) });
      await upstream.arrayBuffer();
      dropped.push({ method: req.method ?? "GET", path: req.url ?? "/", status: upstream.status });
    } catch {
      dropped.push({ method: req.method ?? "GET", path: req.url ?? "/", status: 0 });
    }
    // The submit is done on the server; the client never hears of it.
    res.socket?.destroy();
  });
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    dropped,
    close: () => new Promise<void>((ok) => server.close(() => ok())),
  };
}
