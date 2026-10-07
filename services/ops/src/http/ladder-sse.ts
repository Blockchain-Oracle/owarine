/**
 * `GET /ladders/latest` and `GET /ladders/stream` (plan §6): the venue price ladder per quoting Window, the indicative
 * book the ticket walks with core's kernel. Labelled on screen as "the venue's published price ladder (indicative,
 * not a public order book)"; the firm price comes only from `/internal/quotes`. Shape: `ladder-board.ts`.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { toWireLadder, type LadderBoard, type LadderEntry, type WireLadder } from "../actors/market-maker/seat/ladder-board";
import { createCoalescer } from "./coalesce";

const KEEPALIVE_MS = 15_000;
/** One frame per Window per this many ms (≤8 Hz), always ending on its newest ladder. */
export const LADDER_FRAME_GAP_MS = 125;

export const ladderLatestBody = (board: LadderBoard): { ladders: WireLadder[]; asOfMs: number } => ({ ladders: board.all().map(toWireLadder), asOfMs: Date.now() });

export function streamLadders(req: IncomingMessage, res: ServerResponse, board: LadderBoard, headers: Record<string, string>): void {
  res.writeHead(200, { ...headers, "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
  // Node holds the headers until the first write: with no Window quoting that was the 15 s keepalive, so the stream
  // looked hung through Traefik (C4e). Send them now.
  res.flushHeaders();
  const send = (w: WireLadder) => res.write(`event: ladder\ndata: ${JSON.stringify(w)}\n\n`);
  for (const e of board.all()) send(toWireLadder(e));
  const frames = createCoalescer<LadderEntry>((_, e) => send(toWireLadder(e)), LADDER_FRAME_GAP_MS);
  const unsubscribe = board.subscribe((e) => frames.push(e.marketId, e));
  const keepalive = setInterval(() => res.write(": keepalive\n\n"), KEEPALIVE_MS);
  req.on("close", () => {
    clearInterval(keepalive);
    unsubscribe();
    frames.stop();
  });
}
