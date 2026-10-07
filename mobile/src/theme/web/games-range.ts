import type { ThemeName } from "../index";

/**
 * web's Range and Moonshot pages as the browser computes them at 402 px, per theme: the parlay page's frame they sit
 * on (parlay-page.css, parlay-builder.css, parlay-ticket.css), the band control (range-band.css), the aim ladder
 * (moonshot.css) and CapabilityPending (shell.css). The white-alpha steps map to part-14's ink ladder in light.
 * Roles that equal a `useTheme().color` value (ink, the grays, signal, profit, loss) and the games frame's own
 * card ground (`gamesTokens().cardBg / cardBorder`) are read from there.
 */
const DARK = {
  gray300: "#CDCBC3", gray700: "#3B3A37",
  eyebrow: "rgba(228, 226, 78, 0.8)",
  plate: "rgba(23, 22, 22, 0.6)", headRule: "rgba(255, 255, 255, 0.05)", slipEmpty: "rgba(23, 22, 22, 0.2)",
  menuOn: "rgba(255, 255, 255, 0.1)", cpRule: "rgba(255, 255, 255, 0.08)",
  // range-band.css
  bandLabel: "rgba(255, 255, 255, 0.45)", bandMust: "rgba(255, 255, 255, 0.35)", bandBorder: "rgba(255, 255, 255, 0.1)", bandBg: "rgba(255, 255, 255, 0.015)",
  k: "rgba(255, 255, 255, 0.3)", arrow: "rgba(255, 255, 255, 0.2)", trackLine: "rgba(255, 255, 255, 0.1)", spotTick: "rgba(255, 255, 255, 0.8)", spotDot: "#FFFFFF",
  footRule: "rgba(255, 255, 255, 0.07)", footInk: "rgba(255, 255, 255, 0.35)", footV: "rgba(255, 255, 255, 0.65)", wait: "rgba(255, 255, 255, 0.3)",
  presetBorder: "rgba(255, 255, 255, 0.09)", presetInk: "rgba(255, 255, 255, 0.45)", presetOnBorder: "rgba(228, 226, 78, 0.7)", presetOnBg: "rgba(228, 226, 78, 0.08)", presetSpan: "rgba(255, 255, 255, 0.3)",
  centerRule: "rgba(255, 255, 255, 0.08)", centerV: "rgba(255, 255, 255, 0.6)", iconBorder: "rgba(255, 255, 255, 0.1)", iconInk: "rgba(255, 255, 255, 0.55)",
  sidesBorder: "rgba(255, 255, 255, 0.08)", sidesBg: "rgba(255, 255, 255, 0.015)", sideInk: "rgba(255, 255, 255, 0.4)", sideOnBg: "rgba(228, 226, 78, 0.12)",
  thumbFill: "rgba(228, 226, 78, 0.25)", thumbFillDrag: "rgba(228, 226, 78, 0.45)", grip: "rgba(228, 226, 78, 0.8)",
  // parlay-ticket.css
  solverBg: "rgba(255, 255, 255, 0.02)", solverBorder: "rgba(255, 255, 255, 0.05)", modesBorder: "rgba(255, 255, 255, 0.1)", modeOnBg: "rgba(228, 226, 78, 0.15)",
  inputBg: "rgba(255, 255, 255, 0.03)", inputBorder: "rgba(255, 255, 255, 0.08)", inputFocus: "rgba(255, 255, 255, 0.2)",
  placeInk: "#FFFFFF", placeGlow: "rgba(228, 226, 78, 0.25)", placeMutedBg: "rgba(255, 255, 255, 0.06)", placeMutedBorder: "rgba(255, 255, 255, 0.1)",
  lossSoft: "rgba(255, 92, 97, 0.9)", lossHalf: "rgba(255, 92, 97, 0.5)", lossDim: "rgba(255, 92, 97, 0.6)",
  errBg: "rgba(232, 70, 76, 0.1)", errBorder: "rgba(232, 70, 76, 0.2)", txLink: "rgba(61, 214, 140, 0.6)", spin: "rgba(228, 226, 78, 0.6)",
  // parlay-page.css: the slip's cards
  pillBg: "rgba(255, 255, 255, 0.05)", pillWonBg: "rgba(228, 226, 78, 0.15)",
  cardWonBorder: "rgba(228, 226, 78, 0.4)", cardWonBg: "rgba(228, 226, 78, 0.04)", cardLostBorder: "rgba(255, 255, 255, 0.06)", cardLostBg: "rgba(23, 22, 22, 0.3)",
  legRule: "rgba(255, 255, 255, 0.05)", settleBorder: "rgba(228, 226, 78, 0.5)",
  // moonshot.css
  ladderMid: "rgba(255, 255, 255, 0.14)", rungBorder: "rgba(255, 255, 255, 0.09)", rungInk: "rgba(255, 255, 255, 0.45)",
  longOnBorder: "rgba(61, 214, 140, 0.7)", longOnBg: "rgba(61, 214, 140, 0.12)", shortOnBorder: "rgba(255, 92, 97, 0.7)", shortOnBg: "rgba(255, 92, 97, 0.12)",
  hint: "rgba(255, 255, 255, 0.4)",
};

const LIGHT: typeof DARK = {
  gray300: "#42413C", gray700: "#D6D4CB",
  eyebrow: "rgba(228, 226, 78, 0.8)",
  plate: "rgba(255, 255, 255, 0.94)", headRule: "rgba(16, 15, 15, 0.07)", slipEmpty: "rgba(255, 255, 255, 0.94)",
  menuOn: "rgba(16, 15, 15, 0.08)", cpRule: "rgba(16, 15, 15, 0.12)",
  bandLabel: "rgba(16, 15, 15, 0.62)", bandMust: "rgba(16, 15, 15, 0.55)", bandBorder: "rgba(16, 15, 15, 0.12)", bandBg: "rgba(16, 15, 15, 0.02)",
  k: "rgba(16, 15, 15, 0.5)", arrow: "rgba(16, 15, 15, 0.3)", trackLine: "rgba(16, 15, 15, 0.14)", spotTick: "rgba(16, 15, 15, 0.8)", spotDot: "rgba(16, 15, 15, 0.9)",
  footRule: "rgba(16, 15, 15, 0.1)", footInk: "rgba(16, 15, 15, 0.55)", footV: "rgba(16, 15, 15, 0.75)", wait: "rgba(16, 15, 15, 0.5)",
  presetBorder: "rgba(16, 15, 15, 0.12)", presetInk: "rgba(16, 15, 15, 0.62)", presetOnBorder: "rgba(228, 226, 78, 0.7)", presetOnBg: "rgba(228, 226, 78, 0.08)", presetSpan: "rgba(16, 15, 15, 0.5)",
  centerRule: "rgba(16, 15, 15, 0.1)", centerV: "rgba(16, 15, 15, 0.75)", iconBorder: "rgba(16, 15, 15, 0.14)", iconInk: "rgba(16, 15, 15, 0.65)",
  sidesBorder: "rgba(16, 15, 15, 0.1)", sidesBg: "rgba(16, 15, 15, 0.02)", sideInk: "rgba(16, 15, 15, 0.62)", sideOnBg: "rgba(228, 226, 78, 0.12)",
  thumbFill: "rgba(228, 226, 78, 0.25)", thumbFillDrag: "rgba(228, 226, 78, 0.45)", grip: "rgba(228, 226, 78, 0.8)",
  solverBg: "rgba(16, 15, 15, 0.03)", solverBorder: "rgba(16, 15, 15, 0.07)", modesBorder: "rgba(16, 15, 15, 0.11)", modeOnBg: "rgba(228, 226, 78, 0.15)",
  inputBg: "rgba(16, 15, 15, 0.03)", inputBorder: "rgba(16, 15, 15, 0.11)", inputFocus: "rgba(16, 15, 15, 0.22)",
  placeInk: "#FFFFFF", placeGlow: "rgba(228, 226, 78, 0.25)", placeMutedBg: "rgba(16, 15, 15, 0.05)", placeMutedBorder: "rgba(16, 15, 15, 0.11)",
  lossSoft: "rgba(210, 52, 60, 0.9)", lossHalf: "rgba(210, 52, 60, 0.5)", lossDim: "rgba(210, 52, 60, 0.6)",
  errBg: "rgba(232, 70, 76, 0.1)", errBorder: "rgba(232, 70, 76, 0.2)", txLink: "rgba(14, 138, 87, 0.6)", spin: "rgba(228, 226, 78, 0.6)",
  pillBg: "rgba(16, 15, 15, 0.05)", pillWonBg: "rgba(228, 226, 78, 0.15)",
  cardWonBorder: "rgba(228, 226, 78, 0.4)", cardWonBg: "rgba(228, 226, 78, 0.06)", cardLostBorder: "rgba(16, 15, 15, 0.07)", cardLostBg: "rgba(255, 255, 255, 0.94)",
  legRule: "rgba(16, 15, 15, 0.07)", settleBorder: "rgba(228, 226, 78, 0.5)",
  ladderMid: "rgba(16, 15, 15, 0.16)", rungBorder: "rgba(16, 15, 15, 0.12)", rungInk: "rgba(16, 15, 15, 0.62)",
  longOnBorder: "rgba(14, 138, 87, 0.7)", longOnBg: "rgba(14, 138, 87, 0.12)", shortOnBorder: "rgba(210, 52, 60, 0.7)", shortOnBg: "rgba(210, 52, 60, 0.12)",
  hint: "rgba(16, 15, 15, 0.55)",
};

export type RangeTokens = typeof DARK;
export const rangeTokens = (name: ThemeName): RangeTokens => (name === "dark" ? DARK : LIGHT);
