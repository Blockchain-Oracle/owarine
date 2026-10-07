import type { ThemeName } from "../../index";

/**
 * web's `/trade-from-x` island as the browser computes it at 402 px (useagari.xyz): x.css `.xt-*`, x-instruction.css
 * `.xi-*`, x-card.css `.xt .xw` and yosuku part-17.css. The page is `data-theme="dark"` in both themes — web's one
 * dark island — so both token sets are the same; only web's shared Connect button follows the theme (its accent comes
 * from `useTheme().color.accent`).
 */
const DARK = {
  /* --xt-* (x.css .xt-page) */
  v: "#E4E24E",
  m: "#3DD68C",
  ink: "#F3F2EE",
  bg: "#0A0909",
  paper: "#110F0F",
  agent: "#100E0E",
  mintPaper: "#0F0E0E",
  seal: "#100F0F",
  wire: "#CDCCC6",
  muted: "#7C7A70",
  faint: "#8A887D",
  sealText: "#97958A",
  mintInk: "#DDFFEE",
  white: "#FFFFFF",
  /* tailwind grays the island names */
  gray200: "#E2E1DA",
  gray300: "#CDCBC3",
  gray400: "#A19F96",
  gray500: "#76746C",
  gray600: "#55544E",
  gray700: "#3B3A37",
  clear: "rgba(0, 0, 0, 0)",
  /* .xt-strip */
  stripBg: "rgba(10, 9, 9, 0.7)",
  stripBorder: "rgba(255, 255, 255, 0.06)",
  eyebrow: "rgba(228, 226, 78, 0.8)",
  /* .xt-rail */
  railBorder: "rgba(255, 255, 255, 0.08)",
  railTop: "rgba(255, 255, 255, 0.03)",
  railPaperStroke: "rgba(255, 255, 255, 0.14)",
  railYouStroke: "rgba(255, 255, 255, 0.16)",
  /* .xt-step-node / .xt-spine / .xt-step-card */
  nodeBorder: "rgba(255, 255, 255, 0.12)",
  nodeBg: "rgba(255, 255, 255, 0.03)",
  nodeDoneBg: "rgba(61, 214, 140, 0.15)",
  nodeDoneBorder: "rgba(61, 214, 140, 0.45)",
  nodeActiveBg: "rgba(228, 226, 78, 0.15)",
  nodeActiveBorder: "rgba(228, 226, 78, 0.55)",
  pulse: "rgba(228, 226, 78, 0.3)",
  spine: "rgba(228, 226, 78, 0.12)",
  cardBorder: "rgba(255, 255, 255, 0.07)",
  cardBg: "rgba(255, 255, 255, 0.02)",
  cardDoneBorder: "rgba(61, 214, 140, 0.22)",
  cardDoneBg: "rgba(61, 214, 140, 0.025)",
  cardActiveBorder: "rgba(228, 226, 78, 0.25)",
  cardActiveBg: "rgba(228, 226, 78, 0.03)",
  /* .xt-chip */
  chipBorder: "rgba(61, 214, 140, 0.25)",
  chipBg: "rgba(61, 214, 140, 0.04)",
  /* .xt-err */
  errBorder: "rgba(232, 70, 76, 0.3)",
  errBg: "rgba(232, 70, 76, 0.06)",
  errInk: "#FDA4AF",
  warnInk: "#FBBF24",
  /* the capability receipt */
  amountBorder: "rgba(255, 255, 255, 0.12)",
  amountFocus: "rgba(255, 255, 255, 0.3)",
  presetBorder: "rgba(255, 255, 255, 0.1)",
  canBorder: "rgba(61, 214, 140, 0.2)",
  canBg: "rgba(61, 214, 140, 0.03)",
  canHead: "rgba(61, 214, 140, 0.8)",
  cannotBorder: "rgba(228, 226, 78, 0.2)",
  cannotBg: "rgba(228, 226, 78, 0.03)",
  cannotHead: "rgba(228, 226, 78, 0.8)",
  struck: "rgba(228, 226, 78, 0.5)",
  lineBorder: "rgba(255, 255, 255, 0.1)",
  lineBg: "rgba(0, 0, 0, 0.3)",
  /* .xt-composer--live */
  liveBorder: "rgba(61, 214, 140, 0.25)",
  liveBg: "rgba(61, 214, 140, 0.03)",
  /* .xt .xw (x-card.css): the permission panel */
  xwLine: "rgba(255, 255, 255, 0.14)",
  xwActionBg: "rgba(228, 226, 78, 0.06)",
  xwBtnBorder: "rgba(228, 226, 78, 0.45)",
  /* .xi (x-instruction.css) */
  xiMute: "#A8A69D",
  xiLine: "rgba(255, 255, 255, 0.13)",
  xiUp: "#6EE7B7",
  xiDown: "#F99B8B",
  xiUpWash: "rgba(110, 231, 183, 0.1)",
  xiUpBorder: "rgba(110, 231, 183, 0.48)",
  xiDownWash: "rgba(249, 155, 139, 0.1)",
  xiDownBorder: "rgba(249, 155, 139, 0.48)",
  xiAssetOn: "#EDEBDF",
  xiAssetOnInk: "#171515",
  xiCadenceOn: "rgba(228, 226, 78, 0.1)",
  xiHover: "rgba(255, 255, 255, 0.06)",
  xiAmountBg: "rgba(255, 255, 255, 0.024)",
  xiQuickOn: "rgba(255, 255, 255, 0.08)",
  xiPost: "#F2F0E6",
  xiPostInk: "#171515",
  xiPostMute: "#737166",
  xiCmdUp: "#246449",
  xiCmdDown: "#A03626",
  xiCopy: "#DFDD3A",
  xiCopyInk: "#FBFAF7",
  xiCopyPressed: "#DCD926",
  xiCopyOffBg: "#DADAD6",
  xiCopyOffBorder: "#C8C6C0",
  xiCopyOffInk: "#727066",
  xiSetup: "#646259",
};

const LIGHT: typeof DARK = DARK;

export type TradeXTokens = typeof DARK;
export const tradeXTokens = (name: ThemeName): TradeXTokens => (name === "dark" ? DARK : LIGHT);

/** An "#rrggbb" string → its channels; null when it is not one (web's CSS drops such a colour). */
export function hexChannels(value: string): [number, number, number] | null {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(value);
  if (!match) return null;
  const n = parseInt(match[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Linear mix of two "#rrggbb" colours, as a CSS rgb() string (for the identity orb's conic stops). */
export function mixHex(a: string, b: string, t: number): string {
  const ca = hexChannels(a);
  const cb = hexChannels(b);
  if (!ca || !cb) return DARK.clear;
  const c = ca.map((x, i) => Math.round(x + (cb[i] - x) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}
