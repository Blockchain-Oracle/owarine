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
  ink: "#FFFFFF", gray300: "#CFCFCF", gray700: "#3A3A3A", gray400: "#A3A3A3", gray500: "#7A7A7A", gray600: "#575757", signal: "#FA00FF",
  profit: "#3DDC5A", loss: "#FF5A52",
  // section.page-hero.markets-hero
  heroRule: "rgba(255, 255, 255, 0.06)",
  // .hero-chart
  panelBg: "#0A0A0A", panelBorder: "rgba(255, 255, 255, 0.08)",
  // .mh-cadence
  cadence: "rgba(255, 255, 255, 0.35)", cadenceOff: "rgba(255, 255, 255, 0.15)",
  // .mh-settles.urgent .mh-settles-label
  urgentLabel: "rgba(250, 0, 255, 0.7)",
  // .hero-chart-foot, .mh-room, .alerts-button, .ramp
  footBg: "rgba(10, 10, 10, 0.5)", footRule: "rgba(255, 255, 255, 0.05)", footAction: "rgba(255, 255, 255, 0.45)", roomMeta: "rgba(255, 255, 255, 0.2)",
  rampBar: "rgba(255, 255, 255, 0.08)", rampFrom: "#FA00FF", rampTo: "#FFFFFF",
  // .hyn-yes / .hyn-no
  upBg: "rgba(61, 220, 90, 0.08)", upBorder: "rgba(61, 220, 90, 0.32)", downBg: "rgba(255, 90, 82, 0.08)", downBorder: "rgba(255, 90, 82, 0.32)",
  // .alerts-pop
  popBg: "rgba(23, 22, 22, 0.96)", popBorder: "rgba(255, 255, 255, 0.1)", popQuiet: "#7A7A7A", popRule: "rgba(255, 255, 255, 0.05)",
  dirBorder: "rgba(255, 255, 255, 0.1)", aboveBg: "rgba(61, 220, 90, 0.1)", aboveBorder: "rgba(61, 220, 90, 0.2)", belowBg: "rgba(255, 90, 82, 0.1)", belowBorder: "rgba(255, 90, 82, 0.2)",
  inputBg: "rgba(255, 255, 255, 0.05)", inputBorder: "rgba(255, 255, 255, 0.1)", plusBg: "rgba(250, 0, 255, 0.2)",
  rowLabel: "#A3A3A3", remove: "#575757",
  // .mks-chip
  chipHoliday: "rgba(250, 0, 255, 0.55)",
  // .sensei-dock / .sensei-teaser
  dockBg: "rgba(20, 19, 19, 0.93)", dockRing: "rgba(250, 0, 255, 0.22)", dockShadow: "#000000", dockTrack: "rgba(255, 255, 255, 0.12)", dockGlyph: "#FFFFFF",
  teaserInk: "#FFFFFF", teaserShadow: "#FA00FF",
};

const LIGHT: typeof DARK = {
  ink: "#0A0A0A", gray300: "#3A3A3A", gray700: "#DCDCDC", gray400: "#5E5E5E", gray500: "#7A7A7A", gray600: "#888888", signal: "#FA00FF",
  profit: "#078A2E", loss: "#D21F1F",
  heroRule: "rgba(255, 255, 255, 0.06)",
  panelBg: "#F2F2F2", panelBorder: "rgba(255, 255, 255, 0.08)",
  cadence: "rgba(10, 10, 10, 0.5)", cadenceOff: "rgba(10, 10, 10, 0.4)",
  urgentLabel: "rgba(250, 0, 255, 0.7)",
  footBg: "rgba(10, 10, 10, 0.035)", footRule: "rgba(10, 10, 10, 0.08)", footAction: "rgba(10, 10, 10, 0.62)", roomMeta: "rgba(10, 10, 10, 0.4)",
  rampBar: "rgba(10, 10, 10, 0.1)", rampFrom: "#FA00FF", rampTo: "#EEEDAD",
  upBg: "rgba(61, 220, 90, 0.08)", upBorder: "rgba(61, 220, 90, 0.32)", downBg: "rgba(255, 90, 82, 0.08)", downBorder: "rgba(255, 90, 82, 0.32)",
  popBg: "rgba(255, 255, 255, 0.94)", popBorder: "rgba(10, 10, 10, 0.12)", popQuiet: "rgba(10, 10, 10, 0.62)", popRule: "rgba(10, 10, 10, 0.08)",
  dirBorder: "rgba(10, 10, 10, 0.1)", aboveBg: "rgba(7, 138, 46, 0.1)", aboveBorder: "rgba(7, 138, 46, 0.2)", belowBg: "rgba(210, 52, 60, 0.1)", belowBorder: "rgba(210, 52, 60, 0.2)",
  inputBg: "rgba(10, 10, 10, 0.05)", inputBorder: "rgba(10, 10, 10, 0.12)", plusBg: "rgba(250, 0, 255, 0.2)",
  rowLabel: "rgba(10, 10, 10, 0.8)", remove: "rgba(10, 10, 10, 0.4)",
  chipHoliday: "rgba(250, 0, 255, 0.55)",
  dockBg: "rgba(255, 255, 255, 0.95)", dockRing: "rgba(250, 0, 255, 0.22)", dockShadow: "#4E4D0C", dockTrack: "rgba(10, 10, 10, 0.12)", dockGlyph: "#181515",
  teaserInk: "#FFFFFF", teaserShadow: "#FA00FF",
};

export type MarketsTokens = typeof DARK;
export const marketsTokens = (name: ThemeName): MarketsTokens => (name === "dark" ? DARK : LIGHT);

/** web's `.markets-hero` padding-top is 116 under a 94 px fixed chrome that the app lays out above the screen: 50 remain. */
export const HERO_TOP = 50;
