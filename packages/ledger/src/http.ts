import type { TokenSource } from "./auth";
import { LedgerError, errorFromResponse } from "./errors";

export interface HttpDeps {
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  /** Wall clock in epoch ms, for deadlines (tests pass a fake that `sleep` advances). */
  now?: () => number;
}

export interface TransportConfig {
  baseUrl: string;
  auth: TokenSource;
  timeoutMs: number;
  maxAttempts: number;
  /** Exponential backoff base and cap (full jitter). */
  backoffBaseMs?: number;
  backoffMaxMs?: number;
}

export interface RequestOptions {
  query?: Record<string, string | number | boolean | undefined>;
  /** A JSON body, or a function of the attempt number (1-based) for per-attempt fields. */
  json?: unknown | ((attempt: number) => unknown);
  /** Raw bytes (DAR upload). */
  bytes?: Uint8Array;
  timeoutMs?: number;
  /** `false` disables retries (non-idempotent calls such as party allocation). */
  retry?: boolean;
  signal?: AbortSignal;
  /** Observes each failed attempt before a retry (for logs and metrics). */
  onRetry?: (err: LedgerError, attempt: number, delayMs: number) => void;
  /** Awaited after a failed attempt and before its retry is sent; must not throw. */
  beforeRetry?: (err: LedgerError, attempt: number) => Promise<void>;
}

export interface Transport {
  readonly baseUrl: string;
  readonly auth: TokenSource;
  request<T>(method: "GET" | "POST", path: string, opts?: RequestOptions): Promise<T>;
}

export function createTransport(cfg: TransportConfig, deps: HttpDeps = {}): Transport {
  const doFetch = deps.fetch ?? globalThis.fetch;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const random = deps.random ?? Math.random;
  const baseUrl = cfg.baseUrl.replace(/\/+$/, "");
  const baseMs = cfg.backoffBaseMs ?? 250;
  const maxMs = cfg.backoffMaxMs ?? 5_000;

  function backoff(attempt: number, hint: number | undefined): number {
    const exp = Math.min(maxMs, baseMs * 2 ** (attempt - 1));
    const jittered = Math.floor(random() * exp);
    return Math.max(jittered, hint ?? 0);
  }

  async function once<T>(method: "GET" | "POST", path: string, url: string, opts: RequestOptions, attempt: number, token: string | undefined): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (token !== undefined) headers.Authorization = `Bearer ${token}`;
    let body: string | Uint8Array | undefined;
    if (opts.bytes !== undefined) {
      headers["Content-Type"] = "application/octet-stream";
      body = opts.bytes;
    } else if (opts.json !== undefined) {
      headers["Content-Type"] = "application/json";
      const value = typeof opts.json === "function" ? (opts.json as (a: number) => unknown)(attempt) : opts.json;
      body = JSON.stringify(value);
    }
    const timeout = AbortSignal.timeout(opts.timeoutMs ?? cfg.timeoutMs);
    const signal = opts.signal ? AbortSignal.any([timeout, opts.signal]) : timeout;
    let res: Response;
    try {
      res = await doFetch(url, { method, headers, ...(body === undefined ? {} : { body: body as NonNullable<RequestInit["body"]> }), signal });
    } catch (e) {
      if (opts.signal?.aborted) throw e;
      const isTimeout = timeout.aborted || (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError"));
      throw new LedgerError({
        kind: isTimeout ? "timeout" : "network",
        path,
        message: isTimeout ? `${path}: no response within ${opts.timeoutMs ?? cfg.timeoutMs} ms` : `${path}: ${describe(e)}`,
        cause: e,
      });
    }
    const text = await res.text();
    if (!res.ok) throw errorFromResponse(path, res.status, res.headers.get("content-type") ?? "", text);
    if (text.length === 0) return {} as T;
    try {
      return JSON.parse(text) as T;
    } catch (e) {
      throw new LedgerError({ kind: "unknown", status: res.status, path, message: `${path}: response is not JSON`, cause: e });
    }
  }

  return {
    baseUrl,
    auth: cfg.auth,
    async request<T>(method: "GET" | "POST", path: string, opts: RequestOptions = {}): Promise<T> {
      const url = baseUrl + path + queryString(opts.query);
      const maxAttempts = opts.retry === false ? 1 : cfg.maxAttempts;
      let reauthed = false;
      for (let attempt = 1; ; attempt++) {
        const token = await cfg.auth.token();
        try {
          return await once<T>(method, path, url, opts, attempt, token);
        } catch (e) {
          if (!(e instanceof LedgerError)) throw e;
          // One immediate re-grant per request on 401; the token source collapses concurrent ones.
          if (e.status === 401 && token !== undefined && !reauthed) {
            reauthed = true;
            cfg.auth.invalidate(token);
            attempt--;
            continue;
          }
          if (!e.retryable || attempt >= maxAttempts) throw e;
          const delay = backoff(attempt, e.retryAfterMs);
          opts.onRetry?.(e, attempt, delay);
          if (opts.beforeRetry) await opts.beforeRetry(e, attempt);
          await sleep(delay);
        }
      }
    },
  };
}

function queryString(q: RequestOptions["query"]): string {
  if (!q) return "";
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined) params.set(k, String(v));
  const s = params.toString();
  return s ? `?${s}` : "";
}

function describe(e: unknown): string {
  if (e instanceof Error) {
    const cause = (e as Error & { cause?: unknown }).cause;
    return cause instanceof Error ? `${e.message} (${cause.message})` : e.message;
  }
  return String(e);
}
