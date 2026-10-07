import type { ThemeName } from "../../index";

/**
 * web's Room sheet (styles/room.css, room-thread.css, room-switch.css) and its hub trigger (markets-hero.css `.mh-room`),
 * per theme. The sheet follows the theme: the reference's dark radial ground, or Yosuku's light card.
 */
const DARK = {
  /** radial-gradient(130% 90% at 50% -10%, #141313, #0b0a0a 46%, #070606) */
  sheetStops: ["#141313", "#0B0A0A", "#070606"] as readonly [string, string, string],
  ink: "#FFFFFF",
  ink90: "rgba(255, 255, 255, 0.9)",
  ink62: "rgba(255, 255, 255, 0.62)",
  ink50: "rgba(255, 255, 255, 0.5)",
  ink45: "rgba(255, 255, 255, 0.45)",
  ink40: "rgba(255, 255, 255, 0.4)",
  ink35: "rgba(255, 255, 255, 0.35)",
  ink10: "rgba(255, 255, 255, 0.1)",
  hairline: "rgba(255, 255, 255, 0.1)",
  rule: "rgba(255, 255, 255, 0.08)",
  inset: "rgba(255, 255, 255, 0.02)",
  lossRule: "rgba(255, 92, 97, 0.22)",
  lossFill: "rgba(255, 92, 97, 0.08)",
  triggerInk: "rgba(255, 255, 255, 0.45)",
  triggerMeta: "rgba(255, 255, 255, 0.2)",
};

const LIGHT: typeof DARK = {
  sheetStops: ["#FAFAF7", "#FAFAF7", "#FAFAF7"],
  ink: "rgb(30, 27, 27)",
  ink90: "rgba(30, 27, 27, 0.9)",
  ink62: "rgba(30, 27, 27, 0.62)",
  ink50: "rgba(30, 27, 27, 0.5)",
  ink45: "rgba(30, 27, 27, 0.45)",
  ink40: "rgba(30, 27, 27, 0.4)",
  ink35: "rgba(30, 27, 27, 0.35)",
  ink10: "rgba(30, 27, 27, 0.1)",
  hairline: "rgba(16, 15, 15, 0.11)",
  rule: "rgba(16, 15, 15, 0.08)",
  inset: "rgba(16, 15, 15, 0.025)",
  lossRule: "rgba(210, 52, 60, 0.22)",
  lossFill: "rgba(210, 52, 60, 0.08)",
  triggerInk: "rgba(16, 15, 15, 0.62)",
  triggerMeta: "rgba(16, 15, 15, 0.4)",
};

/** The signal washes the sheet uses in both themes. */
export const ROOM_SIGNAL = {
  scrim: "rgba(0, 0, 0, 0.7)",
  glow: "rgba(228, 226, 78, 0.25)",
  hairline: "rgba(228, 226, 78, 0.7)",
  clear: "rgba(228, 226, 78, 0)",
  markBorder: "rgba(228, 226, 78, 0.3)",
  markFill: "rgba(228, 226, 78, 0.08)",
  markGlow: "rgba(228, 226, 78, 0.5)",
  halo: "rgba(228, 226, 78, 0.28)",
  iconBorder: "rgba(228, 226, 78, 0.35)",
  mineBorder: "rgba(228, 226, 78, 0.28)",
  mineFill: "rgba(228, 226, 78, 0.07)",
  switchOn: "rgba(228, 226, 78, 0.16)",
  focus: "rgba(228, 226, 78, 0.45)",
} as const;

export type RoomTokens = typeof DARK;
export const roomTokens = (name: ThemeName): RoomTokens => (name === "dark" ? DARK : LIGHT);

/** `.room-avatar`: the address's hue as a 22 % disc with its ink (lighter on dark, deeper on light). */
export function roomAvatar(name: ThemeName, hue: number): { fill: string; ink: string } {
  return { fill: `hsla(${hue}, 45%, 50%, 0.22)`, ink: name === "dark" ? `hsl(${hue}, 55%, 72%)` : `hsl(${hue}, 60%, 32%)` };
}
