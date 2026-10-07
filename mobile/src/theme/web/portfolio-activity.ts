import type { ThemeName } from "../index";

/**
 * web's `/activity`, `/claim` and first-run Tutorial colours as the browser computes them at 402 px, per theme:
 * news.css / activity.css's `--news-*` ladder and gray steps, yosuku's `.btn-primary` pill, x.css and tutorial.css.
 */
/** tutorial.css + the card's utilities (bg-neutral-900/95, border-white/10, the gray ladder part-14 and tutorial.css remap on cream). */
const TUTORIAL_DARK = {
  tutScrim: "rgba(0, 0, 0, 0.7)", tutCard: "rgba(23, 22, 22, 0.95)", tutBorder: "rgba(255, 255, 255, 0.09)", tutInk: "#FFFFFF",
  tutBody: "#A19F96", tutNote: "#76746C", tutFine: "#55544E", tutDotPast: "rgba(255, 255, 255, 0.2)", tutDotAhead: "rgba(255, 255, 255, 0.08)",
  tutBoxBorder: "rgba(255, 255, 255, 0.08)", tutBoxFill: "rgba(255, 255, 255, 0.02)",
};
const TUTORIAL_LIGHT: typeof TUTORIAL_DARK = {
  tutScrim: "rgba(0, 0, 0, 0.7)", tutCard: "rgba(255, 255, 255, 0.94)", tutBorder: "rgba(16, 15, 15, 0.11)", tutInk: "#100F0F",
  tutBody: "rgba(16, 15, 15, 0.8)", tutNote: "rgba(16, 15, 15, 0.62)", tutFine: "rgba(16, 15, 15, 0.5)", tutDotPast: "rgba(16, 15, 15, 0.16)", tutDotAhead: "rgba(16, 15, 15, 0.08)",
  tutBoxBorder: "rgba(16, 15, 15, 0.08)", tutBoxFill: "rgba(16, 15, 15, 0.02)",
};

const DARK = {
  // .act-list --news-*
  newsHairline: "rgba(255, 255, 255, 0.12)", newsRule: "rgba(255, 255, 255, 0.06)", newsHover: "rgba(255, 255, 255, 0.02)",
  // the yosuku gray ladder where it is not a theme role: gray-200 (row titles), gray-600 (meta), gray-700 (arrow)
  gray200: "#E2E1DA", gray600: "#55544E", gray700: "#3B3A37",
  // .btn.btn-primary: signal pill, ink inherits the page's white in dark
  pillFill: "#E4E24E", pillInk: "#100F0F",
  // x-card.css `.xc`: the 12% ink hairline, the page washes, the profit slab and the white X pill on the ground
  xcLine: "rgba(255, 255, 255, 0.12)", washV: "rgba(228, 226, 78, 0.13)", washG: "rgba(61, 214, 140, 0.08)",
  slabFill: "rgba(61, 214, 140, 0.1)", slabBorder: "rgba(61, 214, 140, 0.45)", ctaInk: "#100F0F",
  // `.xr`: the cream ticket, fixed in both themes
  xrPaper: "#F8F7F2", xrV: "#E4E24E", xrInk: "#100F0F", xrMute: "#66645B", xrGreen: "#0E8A57", xrFaint: "#918F84",
  xrPill: "rgba(16, 15, 15, 0.06)", xrPillKnown: "rgba(14, 138, 87, 0.12)", xrHr: "rgba(16, 15, 15, 0.1)", xrShadow: "rgb(30, 28, 28)",
  // tutorial.css
  ...TUTORIAL_DARK,
};

const LIGHT: typeof DARK = {
  newsHairline: "rgba(16, 15, 15, 0.12)", newsRule: "rgba(16, 15, 15, 0.08)", newsHover: "rgba(16, 15, 15, 0.03)",
  gray200: "#2B2A27", gray600: "#9C9A91", gray700: "#D6D4CB",
  pillFill: "#E4E24E", pillInk: "#100F0F",
  xcLine: "rgba(16, 15, 15, 0.12)", washV: "rgba(228, 226, 78, 0.13)", washG: "rgba(14, 138, 87, 0.08)",
  slabFill: "rgba(14, 138, 87, 0.1)", slabBorder: "rgba(14, 138, 87, 0.45)", ctaInk: "#100F0F",
  xrPaper: "#F8F7F2", xrV: "#E4E24E", xrInk: "#100F0F", xrMute: "#66645B", xrGreen: "#0E8A57", xrFaint: "#918F84",
  xrPill: "rgba(16, 15, 15, 0.06)", xrPillKnown: "rgba(14, 138, 87, 0.12)", xrHr: "rgba(16, 15, 15, 0.1)", xrShadow: "rgb(30, 28, 28)",
  ...TUTORIAL_LIGHT,
};

export type ActivityTokens = typeof DARK;
export const activityTokens = (name: ThemeName): ActivityTokens => (name === "dark" ? DARK : LIGHT);
