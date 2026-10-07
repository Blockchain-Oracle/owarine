import type { StreamFactory, StreamSource } from "@owarine/markets/runtime";

/**
 * The phone's SSE adapter for the read runtime (ops `/prices/stream`, the venue's `/ladders/stream`), apart from
 * `react-native-sse` and `AppState` so its lifecycle is tested under vitest (`sse-source.test.ts`). Three rules:
 *
 * - **Errors hand over to the runtime.** react-native-sse 1.2.1 reconnects only after a response that ended; a network
 *   error (XHR status 0: airplane mode, a Wi-Fi switch, a resumed app whose socket died) leaves it dead with no retry,
 *   and it never says so. So every error closes the socket and reports `closed`, and the runtime reopens with its own
 *   exponential backoff (1 s doubling to its cap), which a later event resets.
 * - **Background closes the socket.** While the app is not active the connection is dropped (the runtime is told the
 *   stream is retrying, so prices read "not live"), and it reconnects when the app is active again. A source made while
 *   the app is in the background waits for the foreground before it connects.
 * - A clean end of the response (the server or a proxy closed it) is left to the library's own reconnect.
 */
export interface SseLike {
  addEventListener(type: string, listener: (event: { data?: string | null }) => void): void;
  removeAllEventListeners(): void;
  close(): void;
}

export interface AppStateLike {
  readonly currentState: string;
  addEventListener(type: "change", listener: (state: string) => void): { remove(): void };
}

export function makeStreamFactory(createSse: (url: string) => SseLike, appState: AppStateLike): StreamFactory {
  return (url: string): StreamSource => {
    const named = new Map<string, ((data: string) => void)[]>();
    const errorHandlers: ((closed: boolean) => void)[] = [];
    let sse: SseLike | null = null;
    let done = false;
    const report = (closed: boolean) => errorHandlers.forEach((h) => h(closed));

    const disconnect = () => {
      const current = sse;
      sse = null;
      if (!current) return;
      current.removeAllEventListeners();
      current.close();
    };
    const connect = () => {
      if (done || sse) return;
      const current = createSse(url);
      sse = current;
      for (const [event, handlers] of named) current.addEventListener(event, (e) => handlers.forEach((h) => h(String(e.data ?? ""))));
      current.addEventListener("error", () => {
        if (sse !== current) return;
        // After the library schedules its own retry for this response (same tick), so closing cancels that retry.
        setTimeout(() => {
          if (sse !== current) return;
          disconnect();
          done = true;
          subscription.remove();
          report(true);
        }, 0);
      });
    };

    const subscription = appState.addEventListener("change", (state) => {
      if (done) return;
      if (state === "active") connect();
      else if (sse) {
        disconnect();
        report(false);
      }
    });
    if (appState.currentState === "active") connect();

    return {
      listen: (event, handler) => {
        const list = named.get(event) ?? [];
        list.push(handler);
        named.set(event, list);
        sse?.addEventListener(event, (e) => handler(String(e.data ?? "")));
      },
      onError: (handler) => void errorHandlers.push(handler),
      close: () => {
        done = true;
        subscription.remove();
        disconnect();
      },
    };
  };
}
