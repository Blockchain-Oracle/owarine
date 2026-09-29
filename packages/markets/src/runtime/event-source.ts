/**
 * The one door the read runtime's streams (spot, the venue ladder) open SSE through. The browser's `EventSource` by
 * default; the phone registers `react-native-sse` at boot (`setStreamFactory`), whose object has no `readyState` or
 * `onerror`, so both are adapted to this small shape: named events in, an error that says whether the stream gave up.
 */

export interface StreamSource {
  listen(event: string, handler: (data: string) => void): void;
  /** `closed`: the source gave up and will not reconnect by itself; false: it is retrying on its own. */
  onError(handler: (closed: boolean) => void): void;
  close(): void;
}

export type StreamFactory = (url: string) => StreamSource;

let factory: StreamFactory | null = null;

/** Replaces the default (`globalThis.EventSource`); the phone passes a `react-native-sse` adapter. Null restores it. */
export function setStreamFactory(next: StreamFactory | null): void {
  factory = next;
}

function browserStream(url: string): StreamSource | null {
  const Source = (globalThis as { EventSource?: typeof EventSource }).EventSource;
  if (typeof Source === "undefined") return null;
  const source = new Source(url);
  return {
    listen: (event, handler) => source.addEventListener(event, (e) => handler(String((e as MessageEvent).data ?? ""))),
    onError: (handler) => {
      source.onerror = () => handler(source.readyState === Source.CLOSED);
    },
    close: () => source.close(),
  };
}

/** A stream on `url`, or null where this runtime has no SSE at all (a server process, a test). */
export function openStream(url: string): StreamSource | null {
  return factory ? factory(url) : browserStream(url);
}
