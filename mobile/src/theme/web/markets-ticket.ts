import type { ThemeName } from "../index";

/**
 * web's phone ticket as the browser computes it at 402 px, per theme: the drawer (`.tk-drawer`), its head and mini
 * chart, the mode tray, the side segments, "Betting against", the amount and price blocks, the leverage chips, the
 * readout strip, the gates, Public / Private, the CTA and the footnote (ticket.css, ticket-composer.css,
 * ticket-composer-light.css, preopen.css, private-ticket.css, components/ui button + switch). Read off useagari.xyz.
 * Where web's light rule out-ranks a pressed state (the 1× chip, the pressed mode tile), the computed value is kept.
 */
const DARK = {
  drawerBg: "#0D0C0C", close: "#575757", drawerEdge: "rgba(255, 255, 255, 0.1)",
  ink: "#FFFFFF", inkSecondary: "#A3A3A3", inkMuted: "#7A7A7A", signal: "#FA00FF",
  // .tk-mini-chart and the lightweight-charts canvas inside it
  miniBorder: "rgba(255, 255, 255, 0.08)", miniBg: "rgba(255, 255, 255, 0.016)",
  chartGrid: "rgba(255, 255, 255, 0.1)", chartText: "#7A7A7A", chartLine: "#FFFFFF", chartLineLabelInk: "#000000",
  chartPriceLine: "#A3A3A3", chartPriceLabelInk: "#000000",
  // .tk-modes / .tk-mode
  modesBorder: "rgba(255, 255, 255, 0.08)", modesBg: "rgba(255, 255, 255, 0.015)", mode: "rgba(255, 255, 255, 0.4)",
  modeOnBg: "rgba(255, 255, 255, 0.08)", modeOnInk: "#FFFFFF", modePrivateOnBg: "rgba(250, 0, 255, 0.12)",
  // the outline side segments
  sideBorder: "rgba(255, 255, 255, 0.1)", sideIdleBg: "rgba(255, 255, 255, 0.03)",
  up: "#3DDC5A", down: "#FF5A52", upFill: "rgba(61, 220, 90, 0.14)", downFill: "rgba(255, 90, 82, 0.14)",
  // .tk-against
  trackBorder: "rgba(255, 255, 255, 0.16)", trackBg: "rgba(255, 255, 255, 0.04)", trackThumb: "rgba(255, 255, 255, 0.55)",
  againstWord: "rgba(255, 255, 255, 0.45)", againstNote: "rgba(255, 255, 255, 0.42)",
  // .tk-amount / .tk-add / .tk-lev / .tk-control-label
  rule: "rgba(255, 255, 255, 0.08)", label: "rgba(255, 255, 255, 0.45)", balance: "rgba(255, 255, 255, 0.35)", placeholder: "rgba(255, 255, 255, 0.18)",
  addBorder: "rgba(255, 255, 255, 0.1)", add: "rgba(255, 255, 255, 0.55)",
  levBorder: "rgba(255, 255, 255, 0.1)", lev: "rgba(255, 255, 255, 0.45)", levOnBorder: "rgba(250, 0, 255, 0.7)", levOnBg: "rgba(250, 0, 255, 0.08)", levOnInk: "#FA00FF",
  // .tk-readout / .tk-caption / .tk-note
  cellRule: "rgba(255, 255, 255, 0.07)", liveRule: "rgba(250, 0, 255, 0.3)", readLabel: "rgba(255, 255, 255, 0.3)", readValue: "rgba(255, 255, 255, 0.75)",
  caption: "rgba(255, 255, 255, 0.35)", chance: "rgba(255, 255, 255, 0.55)",
  // .tk-gate
  gateBorder: "rgba(255, 255, 255, 0.08)", gateBg: "rgba(255, 255, 255, 0.02)", warnBorder: "rgba(250, 0, 255, 0.25)", warnBg: "rgba(250, 0, 255, 0.04)",
  gateBody: "#A3A3A3", gateLine: "#7A7A7A", gateQuiet: "rgba(255, 255, 255, 0.3)", onSignal: "#0A0A0A",
  // .tk-pp
  ppBorder: "rgba(255, 255, 255, 0.1)", pp: "rgba(255, 255, 255, 0.4)", ppOnBg: "rgba(255, 255, 255, 0.08)", ppOnInk: "#FFFFFF", ppOff: "rgba(255, 255, 255, 0.2)",
  foot: "rgba(255, 255, 255, 0.25)",
  // .tk-priv-box / .tk-priv-line
  privBorder: "rgba(250, 0, 255, 0.25)", privBg: "rgba(250, 0, 255, 0.05)", privText: "rgba(255, 255, 255, 0.6)",
  // BlockedButton: the side tones, and the blocked face (surface-2, ink-disabled, hairline)
  ctaSideInk: "#0A0A0A", blockedBg: "#262626", blockedInk: "#575757", hairline: "rgba(255, 255, 255, 0.1)",
  // OutcomeNote's line (surface-2 on the hairline)
  noteBg: "#262626",
  // components/ui switch, size sm
  switchOff: "rgba(255, 255, 255, 0.08)", switchThumb: "#FFFFFF",
};

const LIGHT: typeof DARK = {
  drawerBg: "#F2F2F2", close: "#888888", drawerEdge: "rgba(10, 10, 10, 0.1)",
  ink: "#0A0A0A", inkSecondary: "#5E5E5E", inkMuted: "#7A7A7A", signal: "#FA00FF",
  miniBorder: "rgba(10, 10, 10, 0.11)", miniBg: "rgba(10, 10, 10, 0.02)",
  chartGrid: "rgba(10, 10, 10, 0.12)", chartText: "#7A7A7A", chartLine: "#0A0A0A", chartLineLabelInk: "#FFFFFF",
  chartPriceLine: "#5E5E5E", chartPriceLabelInk: "#FFFFFF",
  modesBorder: "rgba(10, 10, 10, 0.1)", modesBg: "rgba(10, 10, 10, 0.02)", mode: "rgba(10, 10, 10, 0.62)",
  modeOnBg: "rgba(10, 10, 10, 0.06)", modeOnInk: "rgba(10, 10, 10, 0.62)", modePrivateOnBg: "rgba(250, 0, 255, 0.12)",
  sideBorder: "rgba(10, 10, 10, 0.12)", sideIdleBg: "rgba(10, 10, 10, 0.036)",
  up: "#078A2E", down: "#D21F1F", upFill: "rgba(7, 138, 46, 0.14)", downFill: "rgba(210, 52, 60, 0.14)",
  trackBorder: "rgba(10, 10, 10, 0.16)", trackBg: "rgba(10, 10, 10, 0.03)", trackThumb: "rgba(10, 10, 10, 0.5)",
  againstWord: "rgba(10, 10, 10, 0.6)", againstNote: "rgba(10, 10, 10, 0.6)",
  rule: "rgba(10, 10, 10, 0.1)", label: "rgba(10, 10, 10, 0.62)", balance: "rgba(10, 10, 10, 0.55)", placeholder: "rgba(10, 10, 10, 0.25)",
  addBorder: "rgba(10, 10, 10, 0.12)", add: "rgba(10, 10, 10, 0.62)",
  levBorder: "rgba(10, 10, 10, 0.12)", lev: "rgba(10, 10, 10, 0.62)", levOnBorder: "rgba(10, 10, 10, 0.12)", levOnBg: "rgba(250, 0, 255, 0.08)", levOnInk: "rgba(10, 10, 10, 0.62)",
  cellRule: "rgba(10, 10, 10, 0.08)", liveRule: "rgba(250, 0, 255, 0.3)", readLabel: "rgba(10, 10, 10, 0.62)", readValue: "rgba(10, 10, 10, 0.8)",
  caption: "rgba(10, 10, 10, 0.55)", chance: "rgba(10, 10, 10, 0.7)",
  gateBorder: "rgba(10, 10, 10, 0.1)", gateBg: "rgba(10, 10, 10, 0.02)", warnBorder: "rgba(250, 0, 255, 0.25)", warnBg: "rgba(250, 0, 255, 0.04)",
  gateBody: "#5E5E5E", gateLine: "#7A7A7A", gateQuiet: "rgba(10, 10, 10, 0.45)", onSignal: "#0A0A0A",
  ppBorder: "rgba(10, 10, 10, 0.12)", pp: "rgba(10, 10, 10, 0.55)", ppOnBg: "rgba(10, 10, 10, 0.06)", ppOnInk: "#0A0A0A", ppOff: "rgba(10, 10, 10, 0.3)",
  foot: "rgba(10, 10, 10, 0.4)",
  privBorder: "rgba(250, 0, 255, 0.25)", privBg: "rgba(250, 0, 255, 0.05)", privText: "rgba(10, 10, 10, 0.7)",
  ctaSideInk: "#0A0A0A", blockedBg: "#E8E8E8", blockedInk: "#888888", hairline: "rgba(10, 10, 10, 0.12)",
  noteBg: "#E8E8E8",
  switchOff: "rgba(10, 10, 10, 0.12)", switchThumb: "#F2F2F2",
};

export type TicketTokens = typeof DARK;
export const ticketTokens = (name: ThemeName): TicketTokens => (name === "dark" ? DARK : LIGHT);
