import type { ThemeName } from "../index";

/**
 * web's §01 live-windows rail as the browser computes it at 402 px, per theme: the lane tabs (ui/tabs `line` list),
 * the ticker picker (`.asset-tabs.tkp`), the market card and every `.mc-*` block (yosuku part-06/16, the light
 * re-inks in part-14 and market-card.css), the pending slot (`.market-card-pending`, ticker-picker.css) and the pager.
 * Read off useagari.xyz. Where web's light rules leave a dark-canvas white alpha in place (the card's hairlines), the
 * computed value is kept: that is what a phone shows.
 */
const DARK = {
  ink: "#FFFFFF", inkSecondary: "#A3A3A3", inkMuted: "#7A7A7A", gray600: "#575757", gray200: "#E6E4E4", signal: "#FA00FF",
  profit: "#3DDC5A", loss: "#FF5A52",
  // .market-card / .mc-head / .mc-foot hairlines
  cardBg: "rgba(255, 255, 255, 0.012)", cardBorder: "rgba(255, 255, 255, 0.06)", cardRule: "rgba(255, 255, 255, 0.05)",
  // .market-card-pending
  pendingBg: "rgba(255, 255, 255, 0.008)", pendingBorder: "rgba(255, 255, 255, 0.06)",
  pendingRing: "rgba(250, 0, 255, 0.45)", pendingRingOut: "rgba(250, 0, 255, 0)",
  // .mc-kind
  kindBorder: "rgba(250, 0, 255, 0.45)",
  // .mc-spark
  sparkWash: "rgba(255, 255, 255, 0.02)", sparkWashEnd: "rgba(0, 0, 0, 0)", strikeFill: "rgba(250, 0, 255, 0.4)", strikeTickBg: "rgba(10, 10, 10, 0.7)",
  // .mc-strip and its ramp
  stripBg: "rgba(0, 0, 0, 0)", stripRule: "rgba(255, 255, 255, 0.05)", stripInk: "#575757",
  rampBar: "rgba(255, 255, 255, 0.08)", rampFrom: "#FA00FF", rampTo: "#FFFFFF",
  // .mc-side
  upBg: "rgba(61, 220, 90, 0.08)", upBorder: "rgba(61, 220, 90, 0.32)", downBg: "rgba(255, 90, 82, 0.08)", downBorder: "rgba(255, 90, 82, 0.32)",
  // .mc-room
  roomBg: "rgba(255, 255, 255, 0.015)", roomBorder: "rgba(255, 255, 255, 0.06)", roomInk: "rgba(255, 255, 255, 0.55)",
  // .pager
  pagerRule: "rgba(255, 255, 255, 0.1)",
};

const LIGHT: typeof DARK = {
  ink: "#0A0A0A", inkSecondary: "#5E5E5E", inkMuted: "#7A7A7A", gray600: "#888888", gray200: "#262626", signal: "#FA00FF",
  profit: "#078A2E", loss: "#D21F1F",
  cardBg: "#FFFFFF", cardBorder: "rgba(255, 255, 255, 0.06)", cardRule: "rgba(255, 255, 255, 0.05)",
  pendingBg: "rgba(10, 10, 10, 0.015)", pendingBorder: "rgba(10, 10, 10, 0.16)",
  pendingRing: "rgba(250, 0, 255, 0.45)", pendingRingOut: "rgba(250, 0, 255, 0)",
  kindBorder: "rgba(250, 0, 255, 0.45)",
  sparkWash: "rgba(255, 255, 255, 0.02)", sparkWashEnd: "rgba(0, 0, 0, 0)", strikeFill: "rgba(250, 0, 255, 0.4)", strikeTickBg: "rgba(255, 255, 255, 0.85)",
  stripBg: "rgba(10, 10, 10, 0.035)", stripRule: "rgba(10, 10, 10, 0.08)", stripInk: "#888888",
  rampBar: "rgba(10, 10, 10, 0.1)", rampFrom: "#FA00FF", rampTo: "#EEEDAD",
  upBg: "rgba(61, 220, 90, 0.08)", upBorder: "rgba(61, 220, 90, 0.32)", downBg: "rgba(255, 90, 82, 0.08)", downBorder: "rgba(255, 90, 82, 0.32)",
  roomBg: "rgba(10, 10, 10, 0.035)", roomBorder: "rgba(10, 10, 10, 0.08)", roomInk: "rgba(10, 10, 10, 0.62)",
  pagerRule: "rgba(10, 10, 10, 0.12)",
};

export type LanesTokens = typeof DARK;
export const lanesTokens = (name: ThemeName): LanesTokens => (name === "dark" ? DARK : LIGHT);

/** `.mc-cadence` is Noto Serif JP 500 (fonts.ts loads it under this key; theme/type.ts names only the 700 stamp). */
/** The cadence tag's face: Inter Bold, upright (K-403; it was an italic serif word). */
export const SERIF_MEDIUM = "Inter_700";
