import type { ThemeName } from "../index";

/**
 * web's phone ticket as the browser computes it at 402 px, per theme: the drawer (`.tk-drawer`), its head and mini
 * chart, the mode tray, the side segments, "Betting against", the amount and price blocks, the leverage chips, the
 * readout strip, the gates, Public / Private, the CTA and the footnote (ticket.css, ticket-composer.css,
 * ticket-composer-light.css, preopen.css, private-ticket.css, components/ui button + switch). Read off useagari.xyz.
 * Where web's light rule out-ranks a pressed state (the 1× chip, the pressed mode tile), the computed value is kept.
 */
const DARK = {
  drawerBg: "#0D0C0C", close: "#55544E", drawerEdge: "rgba(255, 255, 255, 0.1)",
  ink: "#FFFFFF", inkSecondary: "#A19F96", inkMuted: "#76746C", signal: "#E4E24E",
  // .tk-mini-chart and the lightweight-charts canvas inside it
  miniBorder: "rgba(255, 255, 255, 0.08)", miniBg: "rgba(255, 255, 255, 0.016)",
  chartGrid: "rgba(255, 255, 255, 0.1)", chartText: "#76746C", chartLine: "#FFFFFF", chartLineLabelInk: "#000000",
  chartPriceLine: "#A19F96", chartPriceLabelInk: "#000000",
  // .tk-modes / .tk-mode
  modesBorder: "rgba(255, 255, 255, 0.08)", modesBg: "rgba(255, 255, 255, 0.015)", mode: "rgba(255, 255, 255, 0.4)",
  modeOnBg: "rgba(255, 255, 255, 0.08)", modeOnInk: "#FFFFFF", modePrivateOnBg: "rgba(228, 226, 78, 0.12)",
  // the outline side segments
  sideBorder: "rgba(255, 255, 255, 0.1)", sideIdleBg: "rgba(255, 255, 255, 0.03)",
  up: "#3DD68C", down: "#FF5C61", upFill: "rgba(61, 214, 140, 0.14)", downFill: "rgba(255, 92, 97, 0.14)",
  // .tk-against
  trackBorder: "rgba(255, 255, 255, 0.16)", trackBg: "rgba(255, 255, 255, 0.04)", trackThumb: "rgba(255, 255, 255, 0.55)",
  againstWord: "rgba(255, 255, 255, 0.45)", againstNote: "rgba(255, 255, 255, 0.42)",
  // .tk-amount / .tk-add / .tk-lev / .tk-control-label
  rule: "rgba(255, 255, 255, 0.08)", label: "rgba(255, 255, 255, 0.45)", balance: "rgba(255, 255, 255, 0.35)", placeholder: "rgba(255, 255, 255, 0.18)",
  addBorder: "rgba(255, 255, 255, 0.1)", add: "rgba(255, 255, 255, 0.55)",
  levBorder: "rgba(255, 255, 255, 0.1)", lev: "rgba(255, 255, 255, 0.45)", levOnBorder: "rgba(228, 226, 78, 0.7)", levOnBg: "rgba(228, 226, 78, 0.08)", levOnInk: "#E4E24E",
  // .tk-readout / .tk-caption / .tk-note
  cellRule: "rgba(255, 255, 255, 0.07)", liveRule: "rgba(228, 226, 78, 0.3)", readLabel: "rgba(255, 255, 255, 0.3)", readValue: "rgba(255, 255, 255, 0.75)",
  caption: "rgba(255, 255, 255, 0.35)", chance: "rgba(255, 255, 255, 0.55)",
  // .tk-gate
  gateBorder: "rgba(255, 255, 255, 0.08)", gateBg: "rgba(255, 255, 255, 0.02)", warnBorder: "rgba(228, 226, 78, 0.25)", warnBg: "rgba(228, 226, 78, 0.04)",
  gateBody: "#A19F96", gateLine: "#76746C", gateQuiet: "rgba(255, 255, 255, 0.3)", onSignal: "#100F0F",
  // .tk-pp
  ppBorder: "rgba(255, 255, 255, 0.1)", pp: "rgba(255, 255, 255, 0.4)", ppOnBg: "rgba(255, 255, 255, 0.08)", ppOnInk: "#FFFFFF", ppOff: "rgba(255, 255, 255, 0.2)",
  foot: "rgba(255, 255, 255, 0.25)",
  // .tk-priv-box / .tk-priv-line
  privBorder: "rgba(228, 226, 78, 0.25)", privBg: "rgba(228, 226, 78, 0.05)", privText: "rgba(255, 255, 255, 0.6)",
  // BlockedButton: the side tones, and the blocked face (surface-2, ink-disabled, hairline)
  ctaSideInk: "#100F0F", blockedBg: "#262525", blockedInk: "#55544E", hairline: "rgba(255, 255, 255, 0.1)",
  // OutcomeNote's line (surface-2 on the hairline)
  noteBg: "#262525",
  // components/ui switch, size sm
  switchOff: "rgba(255, 255, 255, 0.08)", switchThumb: "#FFFFFF",
};

const LIGHT: typeof DARK = {
  drawerBg: "#F5F4EF", close: "#9C9A91", drawerEdge: "rgba(16, 15, 15, 0.1)",
  ink: "#100F0F", inkSecondary: "#5C5B55", inkMuted: "#76746C", signal: "#E4E24E",
  miniBorder: "rgba(16, 15, 15, 0.11)", miniBg: "rgba(16, 15, 15, 0.02)",
  chartGrid: "rgba(16, 15, 15, 0.12)", chartText: "#76746C", chartLine: "#100F0F", chartLineLabelInk: "#FFFFFF",
  chartPriceLine: "#5C5B55", chartPriceLabelInk: "#FFFFFF",
  modesBorder: "rgba(16, 15, 15, 0.1)", modesBg: "rgba(16, 15, 15, 0.02)", mode: "rgba(16, 15, 15, 0.62)",
  modeOnBg: "rgba(16, 15, 15, 0.06)", modeOnInk: "rgba(16, 15, 15, 0.62)", modePrivateOnBg: "rgba(228, 226, 78, 0.12)",
  sideBorder: "rgba(16, 15, 15, 0.12)", sideIdleBg: "rgba(16, 15, 15, 0.036)",
  up: "#0E8A57", down: "#D2343C", upFill: "rgba(14, 138, 87, 0.14)", downFill: "rgba(210, 52, 60, 0.14)",
  trackBorder: "rgba(16, 15, 15, 0.16)", trackBg: "rgba(16, 15, 15, 0.03)", trackThumb: "rgba(16, 15, 15, 0.5)",
  againstWord: "rgba(16, 15, 15, 0.6)", againstNote: "rgba(16, 15, 15, 0.6)",
  rule: "rgba(16, 15, 15, 0.1)", label: "rgba(16, 15, 15, 0.62)", balance: "rgba(16, 15, 15, 0.55)", placeholder: "rgba(16, 15, 15, 0.25)",
  addBorder: "rgba(16, 15, 15, 0.12)", add: "rgba(16, 15, 15, 0.62)",
  levBorder: "rgba(16, 15, 15, 0.12)", lev: "rgba(16, 15, 15, 0.62)", levOnBorder: "rgba(16, 15, 15, 0.12)", levOnBg: "rgba(228, 226, 78, 0.08)", levOnInk: "rgba(16, 15, 15, 0.62)",
  cellRule: "rgba(16, 15, 15, 0.08)", liveRule: "rgba(228, 226, 78, 0.3)", readLabel: "rgba(16, 15, 15, 0.62)", readValue: "rgba(16, 15, 15, 0.8)",
  caption: "rgba(16, 15, 15, 0.55)", chance: "rgba(16, 15, 15, 0.7)",
  gateBorder: "rgba(16, 15, 15, 0.1)", gateBg: "rgba(16, 15, 15, 0.02)", warnBorder: "rgba(228, 226, 78, 0.25)", warnBg: "rgba(228, 226, 78, 0.04)",
  gateBody: "#5C5B55", gateLine: "#76746C", gateQuiet: "rgba(16, 15, 15, 0.45)", onSignal: "#100F0F",
  ppBorder: "rgba(16, 15, 15, 0.12)", pp: "rgba(16, 15, 15, 0.55)", ppOnBg: "rgba(16, 15, 15, 0.06)", ppOnInk: "#100F0F", ppOff: "rgba(16, 15, 15, 0.3)",
  foot: "rgba(16, 15, 15, 0.4)",
  privBorder: "rgba(228, 226, 78, 0.25)", privBg: "rgba(228, 226, 78, 0.05)", privText: "rgba(16, 15, 15, 0.7)",
  ctaSideInk: "#100F0F", blockedBg: "#ECEBE5", blockedInk: "#9C9A91", hairline: "rgba(16, 15, 15, 0.12)",
  noteBg: "#ECEBE5",
  switchOff: "rgba(16, 15, 15, 0.12)", switchThumb: "#F5F4EF",
};

export type TicketTokens = typeof DARK;
export const ticketTokens = (name: ThemeName): TicketTokens => (name === "dark" ? DARK : LIGHT);
