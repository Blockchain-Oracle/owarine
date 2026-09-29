import type { TokenSource } from "./auth";
import { eventFormat } from "./client";
import { LedgerError, isJsCantonError, kindFromCanton } from "./errors";
import type { JsTransaction, JsUpdateEnvelope, Offset, OffsetCheckpoint, Party, TransactionShape } from "./types";

/**
 * The `/v2/updates` WebSocket, resumable from a cursor.
 *
 * Auth rides in `Sec-WebSocket-Protocol`: `jwt.token.<t>` plus `daml.ws.auth`. `daml.ws.auth` is
 * ALWAYS sent, even with no token: Canton 3.5.17 echoes it back unrequested, and Node's built-in
 * WebSocket (undici) then throws an uncatchable TypeError if the client offered no protocols.
 *
 * Messages are handled strictly in order; the cursor advances only after a handler resolves, so a
 * reconnect (after an error, a server close, or a token re-grant) resumes exactly after the last
 * handled transaction or checkpoint. A handler that throws stops the socket and replays from the
 * cursor after a backoff; it is never skipped.
 *
 * Closing: Canton does not answer the client's close frame (measured: `close` fires ~60 s later with
 * 1006), so `close()` detaches immediately and does not wait for the handshake.
 */

export interface WebSocketLike {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onerror: ((ev: unknown) => void) | null;
  onclose: ((ev: { code?: number; reason?: string }) => void) | null;
}
export type WebSocketCtor = new (url: string, protocols: string[]) => WebSocketLike;

export type StreamState = "connecting" | "open" | "reconnecting" | "closed";

export interface UpdateStreamOptions {
  baseUrl: string;
  auth: TokenSource;
  parties: Party[];
  templateIds?: string[];
  /** Default LEDGER_EFFECTS (the projector's shape: creates and exercises, witnessed). */
  shape?: TransactionShape;
  includeCreatedEventBlob?: boolean;
  /** Resume point: the last offset already handled (0 = from ledger begin). */
  beginExclusive: Offset;
  onTransaction: (tx: JsTransaction) => void | Promise<void>;
  /** Offset checkpoints (emitted at most every 75 s on the node); the cursor advances after it. */
  onCheckpoint?: (cp: OffsetCheckpoint) => void | Promise<void>;
  onState?: (state: StreamState, detail?: string) => void;
  /** `fatal` errors stop the stream (bad request, permission, pruned offset). */
  onError?: (err: LedgerError, fatal: boolean) => void;
  backoffBaseMs?: number;
  backoffMaxMs?: number;
  WebSocket?: WebSocketCtor;
  random?: () => number;
}

export interface UpdateStream {
  /** The last offset whose handler completed. */
  readonly cursor: Offset;
  /** Stop. Resolves once any in-flight handler has finished. */
  close(): Promise<void>;
  /** Resolves when the stream stops (closed by us or a fatal error). */
  readonly done: Promise<void>;
}

const FATAL = new Set(["invalid", "permission", "not-found", "rejected", "schema"]);

export function streamUpdates(o: UpdateStreamOptions): UpdateStream {
  const Found = o.WebSocket ?? (globalThis as unknown as { WebSocket?: WebSocketCtor }).WebSocket;
  if (!Found) throw new Error("no WebSocket implementation: Node >= 22 provides one; or pass `WebSocket`");
  const Ctor: WebSocketCtor = Found;
  const url = o.baseUrl.replace(/\/+$/, "").replace(/^http/, "ws") + "/v2/updates";
  const random = o.random ?? Math.random;
  const baseMs = o.backoffBaseMs ?? 500;
  const maxMs = o.backoffMaxMs ?? 30_000;
  const request = (begin: Offset) => ({
    beginExclusive: begin,
    updateFormat: {
      includeTransactions: {
        transactionShape: o.shape ?? "TRANSACTION_SHAPE_LEDGER_EFFECTS",
        eventFormat: eventFormat({
          parties: o.parties,
          ...(o.templateIds ? { templateIds: o.templateIds } : {}),
          ...(o.includeCreatedEventBlob ? { includeCreatedEventBlob: true } : {}),
        }),
      },
    },
  });

  let cursor = o.beginExclusive;
  let stopped = false;
  let gen = 0;
  let ws: WebSocketLike | null = null;
  let tokenInUse: string | undefined;
  let failures = 0;
  let chain: Promise<void> = Promise.resolve();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let refreshTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnecting = false;
  let resolveDone!: () => void;
  const done = new Promise<void>((r) => (resolveDone = r));

  const unsubscribe = o.auth.onRegrant((t) => {
    if (!stopped && t !== tokenInUse) void reconnect("token re-granted", 0);
  });

  function detach(): void {
    gen++;
    const old = ws;
    ws = null;
    if (!old) return;
    old.onopen = old.onmessage = old.onerror = old.onclose = null;
    try {
      old.close(1000, "reconnect");
    } catch {
      /* already closing */
    }
  }

  function stop(): void {
    if (stopped) return;
    stopped = true;
    unsubscribe();
    if (timer) clearTimeout(timer);
    if (refreshTimer) clearTimeout(refreshTimer);
    detach();
    o.onState?.("closed");
    void chain.then(resolveDone, resolveDone);
  }

  function backoff(): number {
    const exp = Math.min(maxMs, baseMs * 2 ** Math.min(failures, 16));
    return Math.floor(exp / 2 + random() * (exp / 2));
  }

  async function reconnect(reason: string, delayMs?: number): Promise<void> {
    if (stopped || reconnecting) return;
    reconnecting = true;
    detach();
    o.onState?.("reconnecting", reason);
    const wait = delayMs ?? backoff();
    failures++;
    await chain.catch(() => {});
    await new Promise<void>((r) => (timer = setTimeout(r, wait)));
    timer = null;
    reconnecting = false;
    if (!stopped) await connect();
  }

  function fail(err: LedgerError, fatal: boolean): void {
    o.onError?.(err, fatal);
    if (fatal) stop();
    else void reconnect(err.message);
  }

  function scheduleRefresh(): void {
    if (refreshTimer) clearTimeout(refreshTimer);
    const at = o.auth.refreshAt();
    if (at === undefined) return;
    refreshTimer = setTimeout(() => void o.auth.token().catch(() => {}), Math.max(1_000, at - Date.now() + 50));
  }

  function handle(myGen: number, env: JsUpdateEnvelope): Promise<void> {
    const u = env.update;
    if (!u) return Promise.resolve();
    return (chain = chain.then(async () => {
      if (myGen !== gen || stopped) return;
      if ("Transaction" in u) {
        const tx = u.Transaction.value;
        if (tx.offset <= cursor) return; // replayed on resume
        await o.onTransaction(tx);
        cursor = tx.offset;
      } else if ("OffsetCheckpoint" in u) {
        const cp = u.OffsetCheckpoint.value;
        if (cp.offset <= cursor) return;
        await o.onCheckpoint?.(cp);
        cursor = cp.offset;
      }
      failures = 0;
    }).catch((e: unknown) => {
      if (myGen !== gen) return;
      const err = e instanceof LedgerError ? e : new LedgerError({ kind: "unknown", path: "/v2/updates", message: `handler failed: ${String(e)}`, cause: e });
      fail(err, false);
    }));
  }

  async function connect(): Promise<void> {
    if (stopped) return;
    o.onState?.("connecting");
    let token: string | undefined;
    try {
      token = await o.auth.token();
    } catch (e) {
      fail(e instanceof LedgerError ? e : new LedgerError({ kind: "auth", path: "/v2/updates", message: String(e) }), false);
      return;
    }
    tokenInUse = token;
    scheduleRefresh();
    const myGen = ++gen;
    const protocols = token === undefined ? ["daml.ws.auth"] : [`jwt.token.${token}`, "daml.ws.auth"];
    const sock = new Ctor(url, protocols);
    ws = sock;
    sock.onopen = () => {
      if (myGen !== gen) return;
      o.onState?.("open");
      sock.send(JSON.stringify(request(cursor)));
    };
    sock.onmessage = (ev) => {
      if (myGen !== gen) return;
      let msg: unknown;
      try {
        msg = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      if (isJsCantonError(msg)) {
        const kind = kindFromCanton(undefined, msg);
        const err = new LedgerError({ kind, path: "/v2/updates", canton: msg, message: `/v2/updates: ${msg.code}: ${msg.cause}` });
        if (kind === "auth") {
          o.auth.invalidate(token);
          o.onError?.(err, false);
          void reconnect("auth", 0);
        } else fail(err, FATAL.has(kind));
        return;
      }
      void handle(myGen, msg as JsUpdateEnvelope);
    };
    sock.onerror = () => {
      /* followed by onclose */
    };
    sock.onclose = (ev) => {
      if (myGen !== gen || stopped) return;
      void reconnect(`closed ${ev.code ?? ""} ${ev.reason ?? ""}`.trim());
    };
  }

  void connect();
  return {
    get cursor() {
      return cursor;
    },
    close: async () => {
      stop();
      await done;
    },
    done,
  };
}
