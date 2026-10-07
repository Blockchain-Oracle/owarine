import type { ThemeName } from "../index";

/**
 * web's Lucky cabinet as the browser computes it at 402 px, per theme (lucky.css, stage.css `.crt-screen` /
 * `.st-band` / `.st-cadence`, the shadcn secondary chip and BlockedButton). Roles that equal a `useTheme().color`
 * value (surface-1, surface-2, hairline, the grays, signal, profit, loss, ground) are read from there.
 */
const DARK = {
  // .lk-face: linear-gradient(180deg, color-mix(white 6%, bg), bg) under the CRT's two inset shadows
  faceGradient: "linear-gradient(180deg, #141414, #100F0F)",
  faceShadow: "inset 0 0 18px rgba(0, 0, 0, 0.55), inset 0 0 60px rgba(0, 0, 0, 0.35)",
  screw: "rgba(0, 0, 0, 0.5)",
  scanline: "rgba(0, 0, 0, 0.28)",
  // .lk-stake-field and .st-band: color-mix(bg 55%, surface-1)
  well: "#0D0D0D",
  bandShadow: "inset 0 2px 0 rgba(255, 255, 255, 0.06), inset 0 -2px 0 rgba(0, 0, 0, 0.45)",
  // .lk-cta: signal with a 60 % signal edge and the commit lip
  ctaBorder: "rgba(228, 226, 78, 0.6)",
  ctaShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.28), inset 0 -2px 0 rgba(0, 0, 0, 0.32), 0 2px 0 rgba(0, 0, 0, 0.55)",
  ctaShadowPressed: "inset 0 1px 0 rgba(0, 0, 0, 0.25), inset 0 -1px 0 rgba(255, 255, 255, 0.08)",
  // .lk-section-k: signal at 80 %
  sectionK: "rgba(228, 226, 78, 0.8)",
  cadenceBorder: "rgba(255, 255, 255, 0.12)",
  driftBorder: "rgba(228, 226, 78, 0.34)", driftBg: "rgba(228, 226, 78, 0.07)",
  placedBorder: "rgba(61, 214, 140, 0.45)", refusedBorder: "rgba(228, 226, 78, 0.34)",
  // BlockedButton tone up/down and the verdict's cream ink
  toneInk: "#100F0F",
};

const LIGHT: typeof DARK = {
  faceGradient: "linear-gradient(180deg, #E0E0DD, #F5F4EF)",
  faceShadow: "inset 0 0 18px rgba(16, 15, 15, 0.25), inset 0 0 60px rgba(16, 15, 15, 0.12)",
  screw: "rgba(16, 15, 15, 0.35)",
  scanline: "rgba(0, 0, 0, 0.28)",
  well: "#F2F0E6",
  bandShadow: "inset 0 2px 0 rgba(255, 255, 255, 0.5), inset 0 -2px 0 rgba(16, 15, 15, 0.08)",
  ctaBorder: "rgba(228, 226, 78, 0.6)",
  ctaShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.28), inset 0 -2px 0 rgba(0, 0, 0, 0.32), 0 2px 0 rgba(0, 0, 0, 0.55)",
  ctaShadowPressed: "inset 0 1px 0 rgba(0, 0, 0, 0.25), inset 0 -1px 0 rgba(255, 255, 255, 0.08)",
  sectionK: "rgba(228, 226, 78, 0.8)",
  cadenceBorder: "rgba(16, 15, 15, 0.14)",
  driftBorder: "rgba(228, 226, 78, 0.34)", driftBg: "rgba(228, 226, 78, 0.07)",
  placedBorder: "rgba(14, 138, 87, 0.45)", refusedBorder: "rgba(228, 226, 78, 0.34)",
  toneInk: "#100F0F",
};

export type LuckyTokens = typeof DARK;
export const luckyTokens = (name: ThemeName): LuckyTokens => (name === "dark" ? DARK : LIGHT);
