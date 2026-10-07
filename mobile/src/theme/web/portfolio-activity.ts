import type { ThemeName } from "../index";

/**
 * web's `/activity`, `/claim` and first-run Tutorial colours as the browser computes them at 402 px, per theme:
 * news.css / activity.css's `--news-*` ladder and gray steps, yosuku's `.btn-primary` pill, x.css and tutorial.css.
 */
/** tutorial.css + the card's utilities (bg-neutral-900/95, border-white/10, the gray ladder part-14 and tutorial.css remap on cream). */
const TUTORIAL_DARK = {
  tutScrim: "rgba(0, 0, 0, 0.7)", tutCard: "rgba(23, 22, 22, 0.95)", tutBorder: "rgba(255, 255, 255, 0.09)", tutInk: "#FFFFFF",
  tutBody: "#A3A3A3", tutNote: "#7A7A7A", tutFine: "#575757", tutDotPast: "rgba(255, 255, 255, 0.2)", tutDotAhead: "rgba(255, 255, 255, 0.08)",
  tutBoxBorder: "rgba(255, 255, 255, 0.08)", tutBoxFill: "rgba(255, 255, 255, 0.02)",
};
const TUTORIAL_LIGHT: typeof TUTORIAL_DARK = {
  tutScrim: "rgba(0, 0, 0, 0.7)", tutCard: "rgba(255, 255, 255, 0.94)", tutBorder: "rgba(10, 10, 10, 0.11)", tutInk: "#0A0A0A",
  tutBody: "rgba(10, 10, 10, 0.8)", tutNote: "rgba(10, 10, 10, 0.62)", tutFine: "rgba(10, 10, 10, 0.5)", tutDotPast: "rgba(10, 10, 10, 0.16)", tutDotAhead: "rgba(10, 10, 10, 0.08)",
  tutBoxBorder: "rgba(10, 10, 10, 0.08)", tutBoxFill: "rgba(10, 10, 10, 0.02)",
};

const DARK = {
  // .act-list --news-*
  newsHairline: "rgba(255, 255, 255, 0.12)", newsRule: "rgba(255, 255, 255, 0.06)", newsHover: "rgba(255, 255, 255, 0.02)",
  // the yosuku gray ladder where it is not a theme role: gray-200 (row titles), gray-600 (meta), gray-700 (arrow)
  gray200: "#E6E4E4", gray600: "#575757", gray700: "#3A3A3A",
  // .btn.btn-primary: signal pill, ink inherits the page's white in dark
  pillFill: "#FA00FF", pillInk: "#0A0A0A",
  // x-card.css `.xc`: the 12% ink hairline, the page washes, the profit slab and the white X pill on the ground
  xcLine: "rgba(255, 255, 255, 0.12)", washV: "rgba(250, 0, 255, 0.13)", washG: "rgba(61, 220, 90, 0.08)",
  slabFill: "rgba(61, 220, 90, 0.1)", slabBorder: "rgba(61, 220, 90, 0.45)", ctaInk: "#0A0A0A",
  // `.xr`: the cream ticket, fixed in both themes
  xrPaper: "#F8F7F2", xrV: "#FA00FF", xrInk: "#0A0A0A", xrMute: "#66645B", xrGreen: "#078A2E", xrFaint: "#918F84",
  xrPill: "rgba(10, 10, 10, 0.06)", xrPillKnown: "rgba(7, 138, 46, 0.12)", xrHr: "rgba(10, 10, 10, 0.1)", xrShadow: "rgb(30, 28, 28)",
  // tutorial.css
  ...TUTORIAL_DARK,
};

const LIGHT: typeof DARK = {
  newsHairline: "rgba(10, 10, 10, 0.12)", newsRule: "rgba(10, 10, 10, 0.08)", newsHover: "rgba(10, 10, 10, 0.03)",
  gray200: "#262626", gray600: "#888888", gray700: "#DCDCDC",
  pillFill: "#FA00FF", pillInk: "#0A0A0A",
  xcLine: "rgba(10, 10, 10, 0.12)", washV: "rgba(250, 0, 255, 0.13)", washG: "rgba(7, 138, 46, 0.08)",
  slabFill: "rgba(7, 138, 46, 0.1)", slabBorder: "rgba(7, 138, 46, 0.45)", ctaInk: "#0A0A0A",
  xrPaper: "#F8F7F2", xrV: "#FA00FF", xrInk: "#0A0A0A", xrMute: "#66645B", xrGreen: "#078A2E", xrFaint: "#918F84",
  xrPill: "rgba(10, 10, 10, 0.06)", xrPillKnown: "rgba(7, 138, 46, 0.12)", xrHr: "rgba(10, 10, 10, 0.1)", xrShadow: "rgb(30, 28, 28)",
  ...TUTORIAL_LIGHT,
};

export type ActivityTokens = typeof DARK;
export const activityTokens = (name: ThemeName): ActivityTokens => (name === "dark" ? DARK : LIGHT);
