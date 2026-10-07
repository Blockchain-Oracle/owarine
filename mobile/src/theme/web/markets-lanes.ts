import type { ThemeName } from "../index";

/**
 * web's §01 live-windows rail as the browser computes it at 402 px, per theme: the lane tabs (ui/tabs `line` list),
 * the ticker picker (`.asset-tabs.tkp`), the market card and every `.mc-*` block (yosuku part-06/16, the light
 * re-inks in part-14 and market-card.css), the pending slot (`.market-card-pending`, ticker-picker.css) and the pager.
 * Read off useagari.xyz. Where web's light rules leave a dark-canvas white alpha in place (the card's hairlines), the
 * computed value is kept: that is what a phone shows.
 */
const DARK = {
  ink: "#FFFFFF", inkSecondary: "#A19F96", inkMuted: "#76746C", gray600: "#55544E", gray200: "#E2E1DA", signal: "#E4E24E",
  profit: "#3DD68C", loss: "#FF5C61",
  // .market-card / .mc-head / .mc-foot hairlines
  cardBg: "rgba(255, 255, 255, 0.012)", cardBorder: "rgba(255, 255, 255, 0.06)", cardRule: "rgba(255, 255, 255, 0.05)",
  // .market-card-pending
  pendingBg: "rgba(255, 255, 255, 0.008)", pendingBorder: "rgba(255, 255, 255, 0.06)",
  pendingRing: "rgba(228, 226, 78, 0.45)", pendingRingOut: "rgba(228, 226, 78, 0)",
  // .mc-kind
  kindBorder: "rgba(228, 226, 78, 0.45)",
  // .mc-spark
  sparkWash: "rgba(255, 255, 255, 0.02)", sparkWashEnd: "rgba(0, 0, 0, 0)", strikeFill: "rgba(228, 226, 78, 0.4)", strikeTickBg: "rgba(16, 15, 15, 0.7)",
  // .mc-strip and its ramp
  stripBg: "rgba(0, 0, 0, 0)", stripRule: "rgba(255, 255, 255, 0.05)", stripInk: "#55544E",
  rampBar: "rgba(255, 255, 255, 0.08)", rampFrom: "#E4E24E", rampTo: "#FFFFFF",
  // .mc-side
  upBg: "rgba(61, 214, 140, 0.08)", upBorder: "rgba(61, 214, 140, 0.32)", downBg: "rgba(255, 92, 97, 0.08)", downBorder: "rgba(255, 92, 97, 0.32)",
  // .mc-room
  roomBg: "rgba(255, 255, 255, 0.015)", roomBorder: "rgba(255, 255, 255, 0.06)", roomInk: "rgba(255, 255, 255, 0.55)",
  // .pager
  pagerRule: "rgba(255, 255, 255, 0.1)",
};

const LIGHT: typeof DARK = {
  ink: "#100F0F", inkSecondary: "#5C5B55", inkMuted: "#76746C", gray600: "#9C9A91", gray200: "#2B2A27", signal: "#E4E24E",
  profit: "#0E8A57", loss: "#D2343C",
  cardBg: "#FFFFFF", cardBorder: "rgba(255, 255, 255, 0.06)", cardRule: "rgba(255, 255, 255, 0.05)",
  pendingBg: "rgba(16, 15, 15, 0.015)", pendingBorder: "rgba(16, 15, 15, 0.16)",
  pendingRing: "rgba(228, 226, 78, 0.45)", pendingRingOut: "rgba(228, 226, 78, 0)",
  kindBorder: "rgba(228, 226, 78, 0.45)",
  sparkWash: "rgba(255, 255, 255, 0.02)", sparkWashEnd: "rgba(0, 0, 0, 0)", strikeFill: "rgba(228, 226, 78, 0.4)", strikeTickBg: "rgba(255, 255, 255, 0.85)",
  stripBg: "rgba(16, 15, 15, 0.035)", stripRule: "rgba(16, 15, 15, 0.08)", stripInk: "#9C9A91",
  rampBar: "rgba(16, 15, 15, 0.1)", rampFrom: "#E4E24E", rampTo: "#EEEDAD",
  upBg: "rgba(61, 214, 140, 0.08)", upBorder: "rgba(61, 214, 140, 0.32)", downBg: "rgba(255, 92, 97, 0.08)", downBorder: "rgba(255, 92, 97, 0.32)",
  roomBg: "rgba(16, 15, 15, 0.035)", roomBorder: "rgba(16, 15, 15, 0.08)", roomInk: "rgba(16, 15, 15, 0.62)",
  pagerRule: "rgba(16, 15, 15, 0.12)",
};

export type LanesTokens = typeof DARK;
export const lanesTokens = (name: ThemeName): LanesTokens => (name === "dark" ? DARK : LIGHT);

/** `.mc-cadence` is Noto Serif JP 500 (fonts.ts loads it under this key; theme/type.ts names only the 700 stamp). */
/** The cadence tag's face: Mona Sans Expanded, upright (K-402; it was an italic serif word). */
export const SERIF_MEDIUM = "MonaSans_Expanded700";
