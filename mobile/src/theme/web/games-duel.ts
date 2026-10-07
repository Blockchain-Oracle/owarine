import type { ThemeName } from "../index";

/**
 * web's duel at 402 px, per theme (duel.css): the tier choice, the searching plate and its breath, the spinner, the
 * settled-card washes, the verdict edges, the ladder's medals and prize chips, the result modal's stat wells. The
 * plates themselves are surface-1 on the hairline, read from `useTheme().color`.
 */
const DARK = {
  tierOnBg: "rgba(250, 0, 255, 0.08)",
  searchingBorder: "rgba(250, 0, 255, 0.35)", searchingBorderPeak: "rgba(250, 0, 255, 0.7)", searchingBg: "rgba(250, 0, 255, 0.06)", searchingGlow: "rgba(250, 0, 255, 0.22)",
  spinnerTrack: "rgba(250, 0, 255, 0.3)",
  errorBorder: "rgba(250, 0, 255, 0.34)", refusalBorder: "rgba(250, 0, 255, 0.34)", refusalBg: "rgba(250, 0, 255, 0.07)",
  verdictWon: "rgba(61, 220, 90, 0.45)", verdictLost: "rgba(255, 90, 82, 0.4)",
  liveGlow: "rgba(250, 0, 255, 1)",
  medal1: "#E9E76E", medal2: "#D6D6D4", medal3: "#A46250", medalInk: "#0A0A0A", medal3Ink: "#FFFFFF",
  chipBorder: "rgba(255, 255, 255, 0.12)", chipBg: "rgba(255, 255, 255, 0.05)", chipOnBorder: "rgba(250, 0, 255, 0.45)", chipOnBg: "rgba(250, 0, 255, 0.14)",
  statBg: "rgba(0, 0, 0, 0.3)", lockedGlow: "rgba(250, 0, 255, 0.55)",
};

const LIGHT: typeof DARK = {
  tierOnBg: "rgba(250, 0, 255, 0.08)",
  searchingBorder: "rgba(250, 0, 255, 0.35)", searchingBorderPeak: "rgba(250, 0, 255, 0.7)", searchingBg: "rgba(250, 0, 255, 0.06)", searchingGlow: "rgba(250, 0, 255, 0.22)",
  spinnerTrack: "rgba(250, 0, 255, 0.3)",
  errorBorder: "rgba(250, 0, 255, 0.34)", refusalBorder: "rgba(250, 0, 255, 0.34)", refusalBg: "rgba(250, 0, 255, 0.07)",
  verdictWon: "rgba(7, 138, 46, 0.45)", verdictLost: "rgba(210, 52, 60, 0.4)",
  liveGlow: "rgba(250, 0, 255, 1)",
  medal1: "#BB371D", medal2: "#31302C", medal3: "#A65C46", medalInk: "#F2F2F2", medal3Ink: "#0A0A0A",
  chipBorder: "rgba(10, 10, 10, 0.12)", chipBg: "rgba(10, 10, 10, 0.04)", chipOnBorder: "rgba(250, 0, 255, 0.45)", chipOnBg: "rgba(250, 0, 255, 0.14)",
  statBg: "rgba(10, 10, 10, 0.06)", lockedGlow: "rgba(250, 0, 255, 0.55)",
};

export type DuelTokens = typeof DARK;
export const duelTokens = (name: ThemeName): DuelTokens => (name === "dark" ? DARK : LIGHT);
