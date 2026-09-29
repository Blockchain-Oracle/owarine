/**
 * `GET /ladders/latest` and `GET /ladders/stream` (plan §6): the venue price ladder per quoting Window, the indicative
 * book the ticket walks with core's kernel. Labelled on screen as "the venue's published price ladder (indicative,
 * not a public order book)"; the firm price comes only from `/internal/quotes`. Shape: `ladder-board.ts`.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { toWireLadder, type LadderBoard, type WireLadder } from "../actors/market-maker/seat/ladder-board";

const KEEPALIVE_MS = 15_000;

export const ladderLatestBody = (board: LadderBoard): { ladders: WireLadder[]; asOfMs: number } => ({ ladders: board.all().map(toWireLadder), asOfMs: Date.now() });

export function streamLadders(req: IncomingMessage, res: ServerResponse, board: LadderBoard, headers: Record<string, string>): void {
  res.writeHead(200, { ...headers, "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
  const send = (w: WireLadder) => res.write(`event: ladder\ndata: ${JSON.stringify(w)}\n\n`);
  for (const e of board.all()) send(toWireLadder(e));
  const unsubscribe = board.subscribe((e) => send(toWireLadder(e)));
  const keepalive = setInterval(() => res.write(": keepalive\n\n"), KEEPALIVE_MS);
  req.on("close", () => {
    clearInterval(keepalive);
    unsubscribe();
  });
}
