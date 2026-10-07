import type { ThemeName } from "../../index";

/**
 * `/stats` (and the leaderboard's Live activity, which carries the same card) as web computes it at 402 px:
 * web/src/styles/stats.css --stats-* per theme, the emerald mixes of --profit, and part-04's page-hero chrome.
 */
const DARK = {
  card: "#0F0E0E",
  cardTop: "#111010",
  hairline: "rgba(255, 255, 255, 0.07)",
  divider: "rgba(255, 255, 255, 0.05)",
  grid: "rgba(255, 255, 255, 0.04)",
  rowPressed: "rgba(255, 255, 255, 0.02)",
  /** --profit at 25 / 7 / 5 / 80 / 35 %. */
  profitBorder: "rgba(61, 214, 140, 0.25)",
  profitFill7: "rgba(61, 214, 140, 0.07)",
  profitFill5: "rgba(61, 214, 140, 0.05)",
  profitInk80: "rgba(61, 214, 140, 0.8)",
  profitGlow: "rgba(61, 214, 140, 0.35)",
  profitClear: "rgba(61, 214, 140, 0)",
  /** --gray-700: the eyebrow's dash. */
  dash: "#3B3A37",
  /** part-04 .crop and .page-hero's bottom rule (literal white mixes, unthemed on web). */
  crop: "rgba(255, 255, 255, 0.18)",
  pageRule: "rgba(255, 255, 255, 0.06)",
  /** pulseDot's ring. */
  dotRing: "rgba(228, 226, 78, 0.45)",
};

const LIGHT: typeof DARK = {
  card: "#FAFAF7",
  cardTop: "#F4FAF5",
  hairline: "rgba(30, 27, 27, 0.11)",
  divider: "rgba(30, 27, 27, 0.08)",
  grid: "rgba(30, 27, 27, 0.06)",
  rowPressed: "rgba(30, 27, 27, 0.03)",
  profitBorder: "rgba(14, 138, 87, 0.25)",
  profitFill7: "rgba(14, 138, 87, 0.07)",
  profitFill5: "rgba(14, 138, 87, 0.05)",
  profitInk80: "rgba(14, 138, 87, 0.8)",
  profitGlow: "rgba(14, 138, 87, 0.35)",
  profitClear: "rgba(14, 138, 87, 0)",
  dash: "#D6D4CB",
  crop: "rgba(255, 255, 255, 0.18)",
  pageRule: "rgba(255, 255, 255, 0.06)",
  dotRing: "rgba(228, 226, 78, 0.45)",
};

export type StatsTokens = typeof DARK;
export const statsTokens = (name: ThemeName): StatsTokens => (name === "dark" ? DARK : LIGHT);
