import type { ThemeName } from "../index";

/**
 * The Explore and Learn family's shared web values, as the browser computes them at 402 px (useagari.xyz, per theme):
 * the gray ramp steps web paints with that the app palette has no role for. Each route's own values live beside this
 * file in `explore/<route>.ts`.
 */
const DARK = {
  /** --gray-300: the light row ink of mono tables (stats rows, the proof feed). */
  gray300: "#CFCFCF",
  /** --gray-200 */
  gray200: "#E6E4E4",
  /** web's page ground behind the container. */
  ground: "#0A0A0A",
};

const LIGHT: typeof DARK = {
  gray300: "#3A3A3A",
  gray200: "#262626",
  ground: "#F2F2F2",
};

export type ExploreTokens = typeof DARK;
export const exploreTokens = (name: ThemeName): ExploreTokens => (name === "dark" ? DARK : LIGHT);
