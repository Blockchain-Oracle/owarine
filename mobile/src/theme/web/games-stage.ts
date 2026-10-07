import type { ThemeName } from "../index";

/**
 * web's swipe stage and Practice at 402 px, per theme (stage.css, practice.css), as the browser computes them.
 * Light keeps what the cascade actually produces: the active pip stays the resting step (the light `.st-pip`
 * override out-ranks `--active`), and the card is `#FDFCFA` on a 9 % hairline.
 */
const DARK = {
  cardBg: "#171717", cardBorder: "rgba(255, 255, 255, 0.1)",
  bandBg: "#0D0D0D", bandBorder: "rgba(255, 255, 255, 0.1)", bandLipTop: "rgba(255, 255, 255, 0.06)", bandLipBottom: "rgba(0, 0, 0, 0.45)",
  callLipTop: "rgba(255, 255, 255, 0.06)", callLipBottom: "rgba(0, 0, 0, 0.35)",
  pip: "rgba(255, 255, 255, 0.14)", pipActive: "#FA00FF",
  cadenceBorder: "rgba(255, 255, 255, 0.12)", discGeneric: "rgba(255, 255, 255, 0.14)",
  artGleam: "rgba(255, 255, 255, 0.06)", artVignetteNear: "rgba(0, 0, 0, 0.55)", artVignetteFar: "rgba(0, 0, 0, 0.35)",
  scanline: "rgba(0, 0, 0, 0.28)", flicker: "rgba(18, 16, 16, 0.12)", screw: "rgba(0, 0, 0, 0.5)", artGlow: "rgba(250, 0, 255, 0.6)",
  quoteInset: "rgba(255, 255, 255, 0.08)", eyebrow: "rgba(250, 0, 255, 0.8)",
  tintUp: "rgba(61, 220, 90, 0.25)", tintDown: "rgba(255, 90, 82, 0.25)",
  stampBg: "rgba(10, 10, 10, 0.8)", stampShadow: "rgba(0, 0, 0, 0.6)",
  deplete: "rgba(255, 255, 255, 0.1)", emptyBorder: "rgba(255, 255, 255, 0.12)",
  refusalBorder: "rgba(250, 0, 255, 0.34)", refusalBg: "rgba(250, 0, 255, 0.07)",
  // practice.css
  tutorialBorder: "rgba(250, 0, 255, 0.32)", tutorialBg: "rgba(250, 0, 255, 0.06)", watchBar: "rgba(255, 255, 255, 0.12)",
  scoreBg: "rgba(23, 22, 22, 0.5)", scoreWon: "rgba(61, 220, 90, 0.4)", scoreLost: "rgba(255, 90, 82, 0.34)",
};

const LIGHT: typeof DARK = {
  cardBg: "#FDFCFA", cardBorder: "rgba(10, 10, 10, 0.09)",
  bandBg: "#F2F0E6", bandBorder: "rgba(10, 10, 10, 0.12)", bandLipTop: "rgba(255, 255, 255, 0.5)", bandLipBottom: "rgba(10, 10, 10, 0.08)",
  callLipTop: "rgba(255, 255, 255, 0.06)", callLipBottom: "rgba(0, 0, 0, 0.35)",
  pip: "rgba(10, 10, 10, 0.14)", pipActive: "rgba(10, 10, 10, 0.14)",
  cadenceBorder: "rgba(10, 10, 10, 0.14)", discGeneric: "rgba(10, 10, 10, 0.12)",
  artGleam: "rgba(255, 255, 255, 0.06)", artVignetteNear: "rgba(10, 10, 10, 0.25)", artVignetteFar: "rgba(10, 10, 10, 0.12)",
  scanline: "rgba(0, 0, 0, 0.28)", flicker: "rgba(18, 16, 16, 0.12)", screw: "rgba(10, 10, 10, 0.35)", artGlow: "rgba(250, 0, 255, 0.6)",
  quoteInset: "rgba(10, 10, 10, 0.08)", eyebrow: "rgba(250, 0, 255, 0.8)",
  tintUp: "rgba(7, 138, 46, 0.25)", tintDown: "rgba(210, 52, 60, 0.25)",
  stampBg: "rgba(242, 242, 242, 0.8)", stampShadow: "rgba(0, 0, 0, 0.6)",
  deplete: "rgba(10, 10, 10, 0.12)", emptyBorder: "rgba(10, 10, 10, 0.14)",
  refusalBorder: "rgba(250, 0, 255, 0.34)", refusalBg: "rgba(250, 0, 255, 0.07)",
  tutorialBorder: "rgba(250, 0, 255, 0.32)", tutorialBg: "rgba(250, 0, 255, 0.06)", watchBar: "rgba(10, 10, 10, 0.12)",
  scoreBg: "rgba(255, 255, 255, 0.96)", scoreWon: "rgba(7, 138, 46, 0.4)", scoreLost: "rgba(210, 52, 60, 0.34)",
};

export type StageTokens = typeof DARK;
export const stageTokens = (name: ThemeName): StageTokens => (name === "dark" ? DARK : LIGHT);
