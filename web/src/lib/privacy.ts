"use client";

import { useSyncExternalStore } from "react";
import type { FluentName } from "@/lib/art/fluent";

/**
 * Privacy mode (UGLYCASH's balance sticker): one switch that hides every money figure on screen behind a sticker, for
 * trading on a train. Canton already keeps your positions off everyone else's ledger; this keeps them off the screen.
 * Per device, persisted; the app shares it through its localStorage polyfill (mobile/src/polyfills.ts).
 */
const KEY = "owarine.privacy";

export const PRIVACY_STICKERS = ["shushingFace", "seeNoEvilMonkey", "ninja", "locked", "eyes"] as const satisfies readonly FluentName[];
export type PrivacySticker = (typeof PRIVACY_STICKERS)[number];

export interface PrivacyState {
  on: boolean;
  sticker: PrivacySticker;
}

const DEFAULT: PrivacyState = { on: false, sticker: "shushingFace" };

function read(): PrivacyState {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw) as Partial<PrivacyState>;
    const sticker = PRIVACY_STICKERS.includes(parsed.sticker as PrivacySticker) ? (parsed.sticker as PrivacySticker) : DEFAULT.sticker;
    return { on: parsed.on === true, sticker };
  } catch {
    return DEFAULT;
  }
}

let state: PrivacyState | null = null;
const listeners = new Set<() => void>();

function current(): PrivacyState {
  state ??= read();
  return state;
}

function write(next: PrivacyState): void {
  state = next;
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: the switch still holds for this session */
  }
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setPrivacy(on: boolean): void {
  write({ ...current(), on });
}

export function togglePrivacy(): void {
  write({ ...current(), on: !current().on });
}

export function setPrivacySticker(sticker: PrivacySticker): void {
  write({ ...current(), sticker });
}

/** The live privacy state; server render and first paint see it off, so figures never flash hidden→shown. */
export function usePrivacy(): PrivacyState {
  return useSyncExternalStore(subscribe, current, () => DEFAULT);
}
