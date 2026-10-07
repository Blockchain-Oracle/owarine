import type { ThemeName } from "../index";

/**
 * web's `/portfolio/edge` palette (styles/edge.css `.edge-page` --edge-*, per theme) and the fills the CSS computes
 * from it: the page's signal glow, the state panel's paper wash and its 80 px rules, the skeleton shimmer.
 */
const DARK = {
  bg: "#090909", surface: "#0F0E0E", surface2: "#131212",
  text: "#F3F2EA", muted: "#A09E94", faint: "#6F6D64",
  rule: "rgba(255, 255, 255, 0.09)", ruleStrong: "rgba(255, 255, 255, 0.16)", paper: "rgba(255, 255, 255, 0.025)", paperClear: "rgba(255, 255, 255, 0)",
  glow: "rgba(250, 0, 255, 0.055)", glowClear: "rgba(250, 0, 255, 0)",
  shimmer: "rgba(255, 255, 255, 0.045)", shimmerClear: "rgba(255, 255, 255, 0)",
  signal: "#FA00FF", signalD: "#D600DB", actionInk: "#0A0A0A",
};

const LIGHT: typeof DARK = {
  bg: "#F2F2F2", surface: "#F8F7F2", surface2: "#E6E6E3",
  text: "#171515", muted: "#68665C", faint: "#8D8A7E",
  rule: "rgba(33, 32, 29, 0.12)", ruleStrong: "rgba(33, 32, 29, 0.2)", paper: "rgba(255, 255, 255, 0.34)", paperClear: "rgba(255, 255, 255, 0)",
  glow: "rgba(250, 0, 255, 0.055)", glowClear: "rgba(250, 0, 255, 0)",
  shimmer: "rgba(255, 255, 255, 0.045)", shimmerClear: "rgba(255, 255, 255, 0)",
  signal: "#FA00FF", signalD: "#D600DB", actionInk: "#0A0A0A",
};

export type EdgeTokens = typeof DARK;
export const edgeTokens = (name: ThemeName): EdgeTokens => (name === "dark" ? DARK : LIGHT);
