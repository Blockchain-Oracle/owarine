import type { ThemeName } from "../index";

/**
 * web's /markets page frame on a phone as the browser computes it at 402 px, per theme: the hero section and its
 * `.hero-chart` panel (head, cadence tabs, question, distance, settles, canvas, foot, the Room and Alert controls, the
 * ramp, `.hero-yesno`), the alerts popover (alerts.css), the lanes header's session chip (market-session.css) and the
 * Sensei dock (yosuku part-02). markets-hero.css, asset-hero.css, yosuku part-04/14/16; read off useagari.xyz. Where
 * web's light rules leave a dark-canvas white alpha in place (the hero rule, the panel border), the computed value is
 * kept: that is what a phone shows.
 */
const DARK = {
  ink: "#FFFFFF", gray300: "#CDCBC3", gray700: "#3B3A37", gray400: "#A19F96", gray500: "#76746C", gray600: "#55544E", signal: "#E4E24E",
  profit: "#3DD68C", loss: "#FF5C61",
  // section.page-hero.markets-hero
  heroRule: "rgba(255, 255, 255, 0.06)",
  // .hero-chart
  panelBg: "#100F0F", panelBorder: "rgba(255, 255, 255, 0.08)",
  // .mh-cadence
  cadence: "rgba(255, 255, 255, 0.35)", cadenceOff: "rgba(255, 255, 255, 0.15)",
  // .mh-settles.urgent .mh-settles-label
  urgentLabel: "rgba(228, 226, 78, 0.7)",
  // .hero-chart-foot, .mh-room, .alerts-button, .ramp
  footBg: "rgba(16, 15, 15, 0.5)", footRule: "rgba(255, 255, 255, 0.05)", footAction: "rgba(255, 255, 255, 0.45)", roomMeta: "rgba(255, 255, 255, 0.2)",
  rampBar: "rgba(255, 255, 255, 0.08)", rampFrom: "#E4E24E", rampTo: "#FFFFFF",
  // .hyn-yes / .hyn-no
  upBg: "rgba(61, 214, 140, 0.08)", upBorder: "rgba(61, 214, 140, 0.32)", downBg: "rgba(255, 92, 97, 0.08)", downBorder: "rgba(255, 92, 97, 0.32)",
  // .alerts-pop
  popBg: "rgba(23, 22, 22, 0.96)", popBorder: "rgba(255, 255, 255, 0.1)", popQuiet: "#76746C", popRule: "rgba(255, 255, 255, 0.05)",
  dirBorder: "rgba(255, 255, 255, 0.1)", aboveBg: "rgba(61, 214, 140, 0.1)", aboveBorder: "rgba(61, 214, 140, 0.2)", belowBg: "rgba(255, 92, 97, 0.1)", belowBorder: "rgba(255, 92, 97, 0.2)",
  inputBg: "rgba(255, 255, 255, 0.05)", inputBorder: "rgba(255, 255, 255, 0.1)", plusBg: "rgba(228, 226, 78, 0.2)",
  rowLabel: "#A19F96", remove: "#55544E",
  // .mks-chip
  chipHoliday: "rgba(228, 226, 78, 0.55)",
  // .sensei-dock / .sensei-teaser
  dockBg: "rgba(20, 19, 19, 0.93)", dockRing: "rgba(228, 226, 78, 0.22)", dockShadow: "#000000", dockTrack: "rgba(255, 255, 255, 0.12)", dockGlyph: "#FFFFFF",
  teaserInk: "#FFFFFF", teaserShadow: "#E4E24E",
};

const LIGHT: typeof DARK = {
  ink: "#100F0F", gray300: "#42413C", gray700: "#D6D4CB", gray400: "#5C5B55", gray500: "#76746C", gray600: "#9C9A91", signal: "#E4E24E",
  profit: "#0E8A57", loss: "#D2343C",
  heroRule: "rgba(255, 255, 255, 0.06)",
  panelBg: "#F5F4EF", panelBorder: "rgba(255, 255, 255, 0.08)",
  cadence: "rgba(16, 15, 15, 0.5)", cadenceOff: "rgba(16, 15, 15, 0.4)",
  urgentLabel: "rgba(228, 226, 78, 0.7)",
  footBg: "rgba(16, 15, 15, 0.035)", footRule: "rgba(16, 15, 15, 0.08)", footAction: "rgba(16, 15, 15, 0.62)", roomMeta: "rgba(16, 15, 15, 0.4)",
  rampBar: "rgba(16, 15, 15, 0.1)", rampFrom: "#E4E24E", rampTo: "#EEEDAD",
  upBg: "rgba(61, 214, 140, 0.08)", upBorder: "rgba(61, 214, 140, 0.32)", downBg: "rgba(255, 92, 97, 0.08)", downBorder: "rgba(255, 92, 97, 0.32)",
  popBg: "rgba(255, 255, 255, 0.94)", popBorder: "rgba(16, 15, 15, 0.12)", popQuiet: "rgba(16, 15, 15, 0.62)", popRule: "rgba(16, 15, 15, 0.08)",
  dirBorder: "rgba(16, 15, 15, 0.1)", aboveBg: "rgba(14, 138, 87, 0.1)", aboveBorder: "rgba(14, 138, 87, 0.2)", belowBg: "rgba(210, 52, 60, 0.1)", belowBorder: "rgba(210, 52, 60, 0.2)",
  inputBg: "rgba(16, 15, 15, 0.05)", inputBorder: "rgba(16, 15, 15, 0.12)", plusBg: "rgba(228, 226, 78, 0.2)",
  rowLabel: "rgba(16, 15, 15, 0.8)", remove: "rgba(16, 15, 15, 0.4)",
  chipHoliday: "rgba(228, 226, 78, 0.55)",
  dockBg: "rgba(255, 255, 255, 0.95)", dockRing: "rgba(228, 226, 78, 0.22)", dockShadow: "#4E4D0C", dockTrack: "rgba(16, 15, 15, 0.12)", dockGlyph: "#181515",
  teaserInk: "#FFFFFF", teaserShadow: "#E4E24E",
};

export type MarketsTokens = typeof DARK;
export const marketsTokens = (name: ThemeName): MarketsTokens => (name === "dark" ? DARK : LIGHT);

/** web's `.markets-hero` padding-top is 116 under a 94 px fixed chrome that the app lays out above the screen: 50 remain. */
export const HERO_TOP = 50;
