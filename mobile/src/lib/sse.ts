import { setStreamFactory } from "@agari/markets/runtime";
import EventSource from "react-native-sse";

/**
 * The phone's SSE for the read runtime's streams (ops `/prices/stream` and the venue's `/ladders/stream`): React Native
 * has no `EventSource`, so `react-native-sse` stands in, adapted to the runtime's `StreamSource`. It reconnects on its
 * own (`pollingInterval`), so its errors never say "closed"; only an explicit close does.
 */
const RECONNECT_MS = 5_000;

setStreamFactory((url) => {
  const source = new EventSource<"spot" | "ladder">(url, { pollingInterval: RECONNECT_MS });
  return {
    listen: (event, handler) => source.addEventListener(event as "spot" | "ladder", (e) => handler(String((e as { data?: string | null }).data ?? ""))),
    onError: (handler) => {
      source.addEventListener("error", () => handler(false));
      source.addEventListener("close", () => handler(true));
    },
    close: () => {
      source.removeAllEventListeners();
      source.close();
    },
  };
});
