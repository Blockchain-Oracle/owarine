import { setStreamFactory } from "@owarine/markets/runtime";
import { AppState } from "react-native";
import EventSource from "react-native-sse";
import { makeStreamFactory } from "./sse-source";

/**
 * The phone's SSE for the read runtime's streams: React Native has no `EventSource`, so `react-native-sse` stands in,
 * through `makeStreamFactory` (errors go to the runtime's backoff; the socket closes in the background). Registered
 * at boot (`app/_layout.tsx`), before any screen subscribes.
 */
const RECONNECT_AFTER_END_MS = 2_000;

setStreamFactory(makeStreamFactory((url) => new EventSource<"spot" | "ladder">(url, { pollingInterval: RECONNECT_AFTER_END_MS }) as never, AppState));
