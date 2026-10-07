"use client";

import { useSyncExternalStore } from "react";

/**
 * The trading sound map (Tradash's cues: tap, open, close-win, close-loss, profit move), Kenney CC0 effects listed in
 * public/sounds/SOURCES.md. Web Audio with decoded buffers so quick taps overlap instead of cutting each other off;
 * unlocked on the first gesture, one persisted mute, every load or play error swallowed — a missing file must never
 * break a trade. The games keep their own mixer (features/games/audio.ts).
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

const NAMES: readonly TradeSound[] = ["tap", "open-up", "open-down", "close-win", "close-loss", "profit-tick", "sheet-open", "sheet-close", "key", "swipe-confirm", "success", "toggle", "error"];
const GAIN: Partial<Record<TradeSound, number>> = { tap: 0.45, key: 0.4, "profit-tick": 0.35, toggle: 0.5 };
const MUTE_KEY = "owarine.sound.muted";

let ctx: AudioContext | null = null;
let out: GainNode | null = null;
const buffers = new Map<TradeSound, AudioBuffer>();
let muted = readMuted();
const listeners = new Set<() => void>();

function readMuted(): boolean {
  try {
    return globalThis.localStorage?.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Mount once in the shell. Creates the context on the first gesture (autoplay rules) and preloads every cue. */
export function installTradeSounds(): () => void {
  if (typeof window === "undefined") return () => undefined;
  const off = () => {
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  function unlock() {
    off();
    if (ctx || typeof AudioContext === "undefined") return;
    try {
      ctx = new AudioContext();
      out = ctx.createGain();
      out.gain.value = 0.7;
      out.connect(ctx.destination);
      void ctx.resume().catch(() => undefined);
      for (const name of NAMES) void load(name);
    } catch {
      ctx = null;
    }
  }
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
  return off;
}

async function load(name: TradeSound): Promise<void> {
  if (!ctx || buffers.has(name)) return;
  try {
    const res = await fetch(`/sounds/trade/${name}.mp3`);
    if (!res.ok) return;
    buffers.set(name, await ctx.decodeAudioData(await res.arrayBuffer()));
  } catch {
    /* a missing cue stays silent */
  }
}

export function playTrade(name: TradeSound): void {
  if (muted || !ctx || !out) return;
  const buffer = buffers.get(name);
  if (!buffer) return;
  try {
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const g = ctx.createGain();
    g.gain.value = GAIN[name] ?? 0.8;
    src.connect(g).connect(out);
    src.start();
  } catch {
    /* never let a sound break the flow */
  }
}

export function setTradeMuted(next: boolean): void {
  muted = next;
  try {
    globalThis.localStorage?.setItem(MUTE_KEY, next ? "1" : "0");
  } catch {
    /* session only */
  }
  for (const l of listeners) l();
}

export function useTradeMuted(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => muted,
    () => false,
  );
}
