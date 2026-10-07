import type { ThemeName } from "../index";

/**
 * The Explore and Learn family's shared web values, as the browser computes them at 402 px (useagari.xyz, per theme):
 * the gray ramp steps web paints with that the app palette has no role for. Each route's own values live beside this
 * file in `explore/<route>.ts`.
 */
const DARK = {
  /** --gray-300: the light row ink of mono tables (stats rows, the proof feed). */
  gray300: "#CDCBC3",
  /** --gray-200 */
  gray200: "#E2E1DA",
  /** web's page ground behind the container. */
  ground: "#100F0F",
};

const LIGHT: typeof DARK = {
  gray300: "#42413C",
  gray200: "#2B2A27",
  ground: "#F5F4EF",
};

export type ExploreTokens = typeof DARK;
export const exploreTokens = (name: ThemeName): ExploreTokens => (name === "dark" ? DARK : LIGHT);
