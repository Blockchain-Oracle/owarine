import type { ThemeName } from "../index";

/**
 * web's duel at 402 px, per theme (duel.css): the tier choice, the searching plate and its breath, the spinner, the
 * settled-card washes, the verdict edges, the ladder's medals and prize chips, the result modal's stat wells. The
 * plates themselves are surface-1 on the hairline, read from `useTheme().color`.
 */
const DARK = {
  tierOnBg: "rgba(228, 226, 78, 0.08)",
  searchingBorder: "rgba(228, 226, 78, 0.35)", searchingBorderPeak: "rgba(228, 226, 78, 0.7)", searchingBg: "rgba(228, 226, 78, 0.06)", searchingGlow: "rgba(228, 226, 78, 0.22)",
  spinnerTrack: "rgba(228, 226, 78, 0.3)",
  errorBorder: "rgba(228, 226, 78, 0.34)", refusalBorder: "rgba(228, 226, 78, 0.34)", refusalBg: "rgba(228, 226, 78, 0.07)",
  verdictWon: "rgba(61, 214, 140, 0.45)", verdictLost: "rgba(255, 92, 97, 0.4)",
  liveGlow: "rgba(228, 226, 78, 1)",
  medal1: "#E9E76E", medal2: "#D6D6D4", medal3: "#A46250", medalInk: "#100F0F", medal3Ink: "#FFFFFF",
  chipBorder: "rgba(255, 255, 255, 0.12)", chipBg: "rgba(255, 255, 255, 0.05)", chipOnBorder: "rgba(228, 226, 78, 0.45)", chipOnBg: "rgba(228, 226, 78, 0.14)",
  statBg: "rgba(0, 0, 0, 0.3)", lockedGlow: "rgba(228, 226, 78, 0.55)",
};

const LIGHT: typeof DARK = {
  tierOnBg: "rgba(228, 226, 78, 0.08)",
  searchingBorder: "rgba(228, 226, 78, 0.35)", searchingBorderPeak: "rgba(228, 226, 78, 0.7)", searchingBg: "rgba(228, 226, 78, 0.06)", searchingGlow: "rgba(228, 226, 78, 0.22)",
  spinnerTrack: "rgba(228, 226, 78, 0.3)",
  errorBorder: "rgba(228, 226, 78, 0.34)", refusalBorder: "rgba(228, 226, 78, 0.34)", refusalBg: "rgba(228, 226, 78, 0.07)",
  verdictWon: "rgba(14, 138, 87, 0.45)", verdictLost: "rgba(210, 52, 60, 0.4)",
  liveGlow: "rgba(228, 226, 78, 1)",
  medal1: "#BB371D", medal2: "#31302C", medal3: "#A65C46", medalInk: "#F5F4EF", medal3Ink: "#100F0F",
  chipBorder: "rgba(16, 15, 15, 0.12)", chipBg: "rgba(16, 15, 15, 0.04)", chipOnBorder: "rgba(228, 226, 78, 0.45)", chipOnBg: "rgba(228, 226, 78, 0.14)",
  statBg: "rgba(16, 15, 15, 0.06)", lockedGlow: "rgba(228, 226, 78, 0.55)",
};

export type DuelTokens = typeof DARK;
export const duelTokens = (name: ThemeName): DuelTokens => (name === "dark" ? DARK : LIGHT);
