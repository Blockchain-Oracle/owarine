import { createAudioPlayer, type AudioPlayer } from "expo-audio";

/**
 * The trading sound map on the phone (web lib/sound/trade.ts): the same Kenney CC0 cues (assets/sounds/SOURCES.md),
 * two players per cue so a quick second tap overlaps the first, the same persisted mute (the app's localStorage
 * polyfill), every load or play failure swallowed. Haptics pair with these at the call site (components/kit/haptics).
 */
export type TradeSound =
  | "tap"
  | "open-up"
  | "open-down"
  | "close-win"
  | "close-loss"
  | "profit-tick"
  | "sheet-open"
  | "sheet-close"
  | "key"
  | "swipe-confirm"
  | "success"
  | "toggle"
  | "error";

const SOURCES: Record<TradeSound, number> = {
  tap: require("../../../assets/sounds/trade/tap.mp3"),
  "open-up": require("../../../assets/sounds/trade/open-up.mp3"),
  "open-down": require("../../../assets/sounds/trade/open-down.mp3"),
  "close-win": require("../../../assets/sounds/trade/close-win.mp3"),
  "close-loss": require("../../../assets/sounds/trade/close-loss.mp3"),
  "profit-tick": require("../../../assets/sounds/trade/profit-tick.mp3"),
  "sheet-open": require("../../../assets/sounds/trade/sheet-open.mp3"),
  "sheet-close": require("../../../assets/sounds/trade/sheet-close.mp3"),
  key: require("../../../assets/sounds/trade/key.mp3"),
  "swipe-confirm": require("../../../assets/sounds/trade/swipe-confirm.mp3"),
  success: require("../../../assets/sounds/trade/success.mp3"),
  toggle: require("../../../assets/sounds/trade/toggle.mp3"),
  error: require("../../../assets/sounds/trade/error.mp3"),
};

const GAIN: Partial<Record<TradeSound, number>> = { tap: 0.45, key: 0.4, "profit-tick": 0.35, toggle: 0.5 };
const MUTE_KEY = "owarine.sound.muted";
const POOL = 2;
const pools = new Map<TradeSound, { players: AudioPlayer[]; next: number }>();

function muted(): boolean {
  try {
    return globalThis.localStorage?.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function playTrade(name: TradeSound): void {
  if (muted()) return;
  try {
    let entry = pools.get(name);
    if (!entry) {
      entry = { players: Array.from({ length: POOL }, () => createAudioPlayer(SOURCES[name])), next: 0 };
      pools.set(name, entry);
    }
    const player = entry.players[entry.next % POOL]!;
    entry.next += 1;
    player.volume = 0.7 * (GAIN[name] ?? 0.8);
    void player.seekTo(0);
    player.play();
  } catch {
    /* never let a sound break the flow */
  }
}

export function setTradeMuted(next: boolean): void {
  try {
    globalThis.localStorage?.setItem(MUTE_KEY, next ? "1" : "0");
  } catch {
    /* session only */
  }
}
