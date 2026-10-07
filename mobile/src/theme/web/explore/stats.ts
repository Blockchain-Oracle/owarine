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
  profitBorder: "rgba(61, 220, 90, 0.25)",
  profitFill7: "rgba(61, 220, 90, 0.07)",
  profitFill5: "rgba(61, 220, 90, 0.05)",
  profitInk80: "rgba(61, 220, 90, 0.8)",
  profitGlow: "rgba(61, 220, 90, 0.35)",
  profitClear: "rgba(61, 220, 90, 0)",
  /** --gray-700: the eyebrow's dash. */
  dash: "#3A3A3A",
  /** part-04 .crop and .page-hero's bottom rule (literal white mixes, unthemed on web). */
  crop: "rgba(255, 255, 255, 0.18)",
  pageRule: "rgba(255, 255, 255, 0.06)",
  /** pulseDot's ring. */
  dotRing: "rgba(250, 0, 255, 0.45)",
};

const LIGHT: typeof DARK = {
  card: "#FAFAF7",
  cardTop: "#F4FAF5",
  hairline: "rgba(30, 27, 27, 0.11)",
  divider: "rgba(30, 27, 27, 0.08)",
  grid: "rgba(30, 27, 27, 0.06)",
  rowPressed: "rgba(30, 27, 27, 0.03)",
  profitBorder: "rgba(7, 138, 46, 0.25)",
  profitFill7: "rgba(7, 138, 46, 0.07)",
  profitFill5: "rgba(7, 138, 46, 0.05)",
  profitInk80: "rgba(7, 138, 46, 0.8)",
  profitGlow: "rgba(7, 138, 46, 0.35)",
  profitClear: "rgba(7, 138, 46, 0)",
  dash: "#DCDCDC",
  crop: "rgba(255, 255, 255, 0.18)",
  pageRule: "rgba(255, 255, 255, 0.06)",
  dotRing: "rgba(250, 0, 255, 0.45)",
};

export type StatsTokens = typeof DARK;
export const statsTokens = (name: ThemeName): StatsTokens => (name === "dark" ? DARK : LIGHT);
