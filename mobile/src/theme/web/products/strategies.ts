import type { ThemeName } from "../../index";

/**
 * `/strategies` and `/agents` as the browser computes them at 402 px (useagari.xyz, per theme): strategies.css,
 * builder.css, desk.css, decision.css, copy-form.css and yosuku part-17's `.strat-card` / `.strat-sigil`. Most of
 * these surfaces paint the ink at an alpha (`text-ink/40`, `border-white/[0.08]`), which light mode resolves to the
 * dark ink at the same alpha; `ink(a)` is that mix. `signal` is web's fixed `--color-signal` (#E4E24E in both
 * themes); the theme's `accent` is `text-signal`, which light mode deepens.
 */
function mix(rgb: string) {
  return (alpha: number) => `rgba(${rgb}, ${alpha})`;
}

const SIGNAL = "224, 77, 38";

const DARK = {
  ink: mix("255, 255, 255"),
  signalA: mix(SIGNAL),
  signal: "#E4E24E",
  signalD: "#CFCD3F",
  /** .strat-card (part-17) */
  cardBg: "rgba(255, 255, 255, 0.024)",
  cardBorder: "rgba(255, 255, 255, 0.07)",
  cardShadow: "inset 0px 1px 0px 0px rgba(255, 255, 255, 0.03), 0px 12px 32px -22px rgba(0, 0, 0, 0.85)",
  /** .strat-sigil ring and the persona's paper tile */
  sigilRing: "rgba(255, 255, 255, 0.14)",
  paper: "#F1EFE4",
  /** the archive's sticky tab bar: bg-bg/85 */
  stickyBg: "rgba(16, 15, 15, 0.85)",
  /** --gray-700 (the leaderboard rank), --gray-300, --gray-200, --gray-900 (the picker menu) */
  gray700: "#3B3A37",
  gray300: "#CDCBC3",
  gray200: "#E2E1DA",
  menuBg: "#171616",
  /** .strat-confirm--live's glow */
  confirmShadow: "0px 6px 28px -8px #E4E24E",
  scrim: "rgba(0, 0, 0, 0.7)",
  drawerShadow: "0px 25px 50px -12px rgba(0, 0, 0, 0.25)",
  sheetShadow: "0px -20px 40px -12px rgba(0, 0, 0, 0.5)",
  /** the fade pill, the decision popup edge and grab bar */
  directionBorder: "rgba(255, 255, 255, 0.15)",
  directionInk: "#CDCBC3",
  popupBorder: "rgba(255, 255, 255, 0.12)",
  grabBar: "rgba(255, 255, 255, 0.18)",
  /** history.css .equity-* */
  equityZero: "rgba(255, 255, 255, 0.16)",
  equityDown: "rgba(255, 255, 255, 0.55)",
  equityDownDot: "#FFFFFF",
  equityEmptyBorder: "rgba(255, 255, 255, 0.06)",
  equityEmptyBg: "rgba(255, 255, 255, 0.015)",
  equityEmptyInk: "rgba(255, 255, 255, 0.25)",
  /** .copy-you: the profit at 45% */
  profitBorder: "rgba(61, 214, 140, 0.45)",
  /** the wallet Connect button's label */
  onAccent: "#100F0F",
};

const LIGHT: typeof DARK = {
  ink: mix("20, 18, 16"),
  signalA: mix(SIGNAL),
  signal: "#E4E24E",
  signalD: "#CFCD3F",
  cardBg: "#F9F8F3",
  cardBorder: "rgba(16, 15, 15, 0.08)",
  cardShadow: "inset 0px 1px 0px 0px rgba(255, 255, 255, 0.7), 0px 16px 36px -24px rgba(70, 46, 20, 0.3)",
  sigilRing: "rgba(16, 15, 15, 0.12)",
  paper: "#F1EFE4",
  stickyBg: "rgba(245, 244, 239, 0.85)",
  gray700: "#D6D4CB",
  gray300: "#42413C",
  gray200: "#2B2A27",
  menuBg: "#FFFFFF",
  confirmShadow: "0px 6px 28px -8px #E4E24E",
  scrim: "rgba(0, 0, 0, 0.7)",
  drawerShadow: "0px 25px 50px -12px rgba(0, 0, 0, 0.25)",
  sheetShadow: "0px -20px 40px -12px rgba(16, 15, 15, 0.18)",
  directionBorder: "rgba(16, 15, 15, 0.16)",
  directionInk: "rgba(16, 15, 15, 0.68)",
  popupBorder: "rgba(16, 15, 15, 0.12)",
  grabBar: "rgba(16, 15, 15, 0.18)",
  equityZero: "rgba(16, 15, 15, 0.22)",
  equityDown: "rgba(16, 15, 15, 0.62)",
  equityDownDot: "#100F0F",
  equityEmptyBorder: "rgba(16, 15, 15, 0.07)",
  equityEmptyBg: "rgba(16, 15, 15, 0.02)",
  equityEmptyInk: "rgba(16, 15, 15, 0.5)",
  profitBorder: "rgba(14, 138, 87, 0.45)",
  onAccent: "#100F0F",
};

export type StrategiesTokens = typeof DARK;
export const strategiesTokens = (name: ThemeName): StrategiesTokens => (name === "dark" ? DARK : LIGHT);
