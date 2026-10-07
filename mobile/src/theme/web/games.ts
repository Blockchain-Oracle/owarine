import type { ThemeName } from "../index";

/**
 * web's games frame as the browser computes it at 402 px, per theme: the rail, the checker ground, the hub's cards
 * and plates, the economic chip, the badges, the section head and the shared overlay (games.css, duel.css
 * .du-modal / .du-cta, yosuku part-05 .section-head). Read off useagari.xyz. Where web's light override out-ranks
 * a modifier (the econ and badge borders), the computed value is what is kept. Roles that already equal a
 * `useTheme().color` value (ink, the grays, signal, profit, loss, hairline, surface-1) are read from there.
 */
const DARK = {
  railBg: "rgba(10, 10, 10, 0.96)", railBorder: "rgba(255, 255, 255, 0.06)", railSep: "rgba(255, 255, 255, 0.14)",
  tile: "rgba(255, 255, 255, 0.028)",
  cardBg: "rgba(23, 22, 22, 0.4)", cardBorder: "rgba(255, 255, 255, 0.08)", cardHoverBorder: "rgba(250, 0, 255, 0.4)",
  iconWash: "rgba(250, 0, 255, 0.1)",
  econBorder: "rgba(255, 255, 255, 0.12)", econRiskBorder: "rgba(250, 0, 255, 0.4)", econRiskBg: "rgba(250, 0, 255, 0.08)",
  badgeBorder: "rgba(255, 255, 255, 0.12)", badgeLiveBorder: "rgba(61, 220, 90, 0.45)", badgeAfterBorder: "rgba(242, 153, 74, 0.45)",
  warning: "#F2994A",
  sectionRule: "rgba(255, 255, 255, 0.08)",
  resumeBorder: "rgba(250, 0, 255, 0.4)", resumeBg: "rgba(250, 0, 255, 0.05)",
  achBg: "rgba(255, 255, 255, 0.02)", achBorder: "rgba(255, 255, 255, 0.07)", achOnBg: "rgba(250, 0, 255, 0.09)", achOnBorder: "rgba(250, 0, 255, 0.45)",
  achProgress: "#EAE979",
  avatarRing: "rgba(255, 255, 255, 0.08)",
  matchBadgeBg: "rgba(255, 255, 255, 0.06)", matchBadgeLiveBg: "rgba(61, 220, 90, 0.12)",
  seasonBorder: "rgba(232, 231, 106, 0.46)", seasonWash: "#372019", seasonLipTop: "rgba(255, 255, 255, 0.06)", seasonLipBottom: "rgba(0, 0, 0, 0.35)",
  trophyGlow: "rgba(250, 0, 255, 0.55)",
  // .du-modal / .du-cta
  scrim: "rgba(0, 0, 0, 0.65)", modalClose: "#7A7A7A",
  ctaInk: "#0A0A0A", ctaLipTop: "rgba(255, 255, 255, 0.28)", ctaLipBottom: "rgba(0, 0, 0, 0.32)", ctaDrop: "rgba(0, 0, 0, 0.55)",
  ctaLeaveBg: "rgba(255, 90, 82, 0.14)", ctaLeaveBorder: "rgba(255, 90, 82, 0.5)",
  // the settings plate's well, segments, switch and range
  setBlock: "rgba(255, 255, 255, 0.07)", segBorder: "rgba(255, 255, 255, 0.12)", segOnBorder: "rgba(250, 0, 255, 0.45)", segOnBg: "rgba(250, 0, 255, 0.1)",
  switchOff: "rgba(255, 255, 255, 0.08)", switchThumb: "#FFFFFF", rangeTrack: "#3D3C39",
  statBg: "rgba(0, 0, 0, 0.3)",
};

const LIGHT: typeof DARK = {
  railBg: "rgba(255, 255, 255, 0.96)", railBorder: "rgba(10, 10, 10, 0.1)", railSep: "rgba(10, 10, 10, 0.16)",
  tile: "rgba(10, 10, 10, 0.035)",
  cardBg: "rgba(255, 255, 255, 0.94)", cardBorder: "rgba(10, 10, 10, 0.11)", cardHoverBorder: "rgba(250, 0, 255, 0.4)",
  iconWash: "rgba(250, 0, 255, 0.1)",
  econBorder: "rgba(10, 10, 10, 0.14)", econRiskBorder: "rgba(10, 10, 10, 0.14)", econRiskBg: "rgba(250, 0, 255, 0.08)",
  badgeBorder: "rgba(10, 10, 10, 0.14)", badgeLiveBorder: "rgba(10, 10, 10, 0.14)", badgeAfterBorder: "rgba(10, 10, 10, 0.14)",
  warning: "#F2994A",
  sectionRule: "rgba(255, 255, 255, 0.08)",
  resumeBorder: "rgba(250, 0, 255, 0.4)", resumeBg: "rgba(250, 0, 255, 0.05)",
  achBg: "rgba(10, 10, 10, 0.02)", achBorder: "rgba(10, 10, 10, 0.1)", achOnBg: "rgba(250, 0, 255, 0.09)", achOnBorder: "rgba(250, 0, 255, 0.45)",
  achProgress: "#B2351C",
  avatarRing: "rgba(10, 10, 10, 0.08)",
  matchBadgeBg: "rgba(255, 255, 255, 0.06)", matchBadgeLiveBg: "rgba(7, 138, 46, 0.12)",
  seasonBorder: "rgba(187, 55, 29, 0.47)", seasonWash: "#F1D4C4", seasonLipTop: "rgba(255, 255, 255, 0.5)", seasonLipBottom: "rgba(10, 10, 10, 0.08)",
  trophyGlow: "rgba(250, 0, 255, 0.55)",
  scrim: "rgba(0, 0, 0, 0.65)", modalClose: "#7A7A7A",
  ctaInk: "#0A0A0A", ctaLipTop: "rgba(255, 255, 255, 0.28)", ctaLipBottom: "rgba(0, 0, 0, 0.32)", ctaDrop: "rgba(0, 0, 0, 0.55)",
  ctaLeaveBg: "rgba(210, 52, 60, 0.14)", ctaLeaveBorder: "rgba(210, 52, 60, 0.5)",
  setBlock: "rgba(10, 10, 10, 0.07)", segBorder: "rgba(10, 10, 10, 0.14)", segOnBorder: "rgba(250, 0, 255, 0.45)", segOnBg: "rgba(250, 0, 255, 0.1)",
  switchOff: "rgba(10, 10, 10, 0.12)", switchThumb: "#F2F2F2", rangeTrack: "#EFEFEF",
  statBg: "rgba(10, 10, 10, 0.06)",
};

export type GamesTokens = typeof DARK;
export const gamesTokens = (name: ThemeName): GamesTokens => (name === "dark" ? DARK : LIGHT);

/** The games frame's display face (m6x11plus, web's "Owarine Pixel"); crisp at multiples of its 11 px em. */
export const PIXEL_FONT = "OwarinePixel";
export const PIXEL_FONT_SOURCE = require("../../../assets/fonts/m6x11plus.ttf");
