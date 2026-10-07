import type { ThemeName } from "../../index";

/** web's how-it-works.css `--hiw-*` as computed on useagari.xyz/how-it-works at 402 px, per theme. */
const DARK = {
  mint: "#3DD68C",
  mintWash: "rgba(61, 214, 140, 0.1)",
  mintEdge: "rgba(61, 214, 140, 0.1)",
  mintTagEdge: "rgba(61, 214, 140, 0.25)",
  blue: "#60A5FA",
  blueWash: "rgba(96, 165, 250, 0.1)",
  blueEdge: "rgba(96, 165, 250, 0.1)",
  card: "rgba(23, 22, 22, 0.5)",
  line: "rgba(255, 255, 255, 0.05)",
  tile: "rgba(255, 255, 255, 0.05)",
  formula: "rgba(0, 0, 0, 0.4)",
  signalWash: "rgba(228, 226, 78, 0.1)",
  ctaInk: "#000000",
  ctaGlow: "0px 0px 30px 0px rgba(61, 214, 140, 0.2)",
};

const LIGHT: typeof DARK = {
  mint: "#0E8A57",
  mintWash: "rgba(14, 138, 87, 0.1)",
  mintEdge: "rgba(14, 138, 87, 0.1)",
  mintTagEdge: "rgba(14, 138, 87, 0.25)",
  blue: "#3E6391",
  blueWash: "rgba(62, 99, 145, 0.1)",
  blueEdge: "rgba(62, 99, 145, 0.1)",
  card: "rgba(255, 255, 255, 0.94)",
  line: "rgba(16, 15, 15, 0.08)",
  tile: "rgba(16, 15, 15, 0.05)",
  formula: "rgba(16, 15, 15, 0.04)",
  signalWash: "rgba(228, 226, 78, 0.1)",
  ctaInk: "#F5F4EF",
  ctaGlow: "0px 0px 30px 0px rgba(61, 214, 140, 0.2)",
};

export type HiwTokens = typeof DARK;
export const hiwTokens = (name: ThemeName): HiwTokens => (name === "dark" ? DARK : LIGHT);
