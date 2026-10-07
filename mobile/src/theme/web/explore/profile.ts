import type { ThemeName } from "../../index";

/**
 * web's /u/[address] on a phone as useagari.xyz computes it, per theme: profile.css (the /news frame and the edge
 * excerpt's own ladder), history.css (the summary, reputation plate, badges, bets plate) and the outline button.
 */
const DARK = {
  barRule: "rgba(255, 255, 255, 0.12)",
  avatarRing: "rgba(255, 255, 255, 0.12)",
  plate: "#171717",
  plateBorder: "rgba(255, 255, 255, 0.1)",
  csvFill: "rgba(255, 255, 255, 0.03)",
  track: "rgba(255, 255, 255, 0.06)",
  badgeGround: "#0A0A0A",
  rankFill: "rgba(255, 255, 255, 0.02)",
  earnedFill: "rgba(250, 0, 255, 0.06)",
  earnedBorder: "rgba(250, 0, 255, 0.3)",
  iconFill: "rgba(250, 0, 255, 0.08)",
  iconBorder: "rgba(250, 0, 255, 0.35)",
  lockedFill: "rgba(255, 255, 255, 0.018)",
  lockedOpacity: 0.45,
  equityZero: "rgba(255, 255, 255, 0.16)",
  equityDown: "rgba(255, 255, 255, 0.55)",
  equityEmptyBorder: "rgba(255, 255, 255, 0.06)",
  equityEmptyFill: "rgba(255, 255, 255, 0.015)",
  equityEmptyInk: "rgba(255, 255, 255, 0.25)",
  edgeText: "#F3F2EA",
  edgeMuted: "#A09E94",
  edgeFaint: "#6F6D64",
  edgeRule: "rgba(255, 255, 255, 0.09)",
  edgePaper: "rgba(255, 255, 255, 0.025)",
};

const LIGHT: typeof DARK = {
  barRule: "rgba(10, 10, 10, 0.12)",
  avatarRing: "rgba(10, 10, 10, 0.12)",
  plate: "#FFFFFF",
  plateBorder: "rgba(10, 10, 10, 0.12)",
  csvFill: "rgba(10, 10, 10, 0.036)",
  track: "rgba(10, 10, 10, 0.08)",
  badgeGround: "#F2F2F2",
  rankFill: "rgba(10, 10, 10, 0.03)",
  earnedFill: "rgba(250, 0, 255, 0.06)",
  earnedBorder: "rgba(250, 0, 255, 0.3)",
  iconFill: "rgba(250, 0, 255, 0.08)",
  iconBorder: "rgba(250, 0, 255, 0.35)",
  lockedFill: "rgba(10, 10, 10, 0.02)",
  lockedOpacity: 0.55,
  equityZero: "rgba(10, 10, 10, 0.22)",
  equityDown: "rgba(10, 10, 10, 0.62)",
  equityEmptyBorder: "rgba(10, 10, 10, 0.07)",
  equityEmptyFill: "rgba(10, 10, 10, 0.02)",
  equityEmptyInk: "rgba(10, 10, 10, 0.5)",
  edgeText: "#171515",
  edgeMuted: "#68665C",
  edgeFaint: "#8D8A7E",
  edgeRule: "rgba(33, 32, 29, 0.12)",
  edgePaper: "rgba(255, 255, 255, 0.34)",
};

export type ProfileTokens = typeof DARK;
export const profileTokens = (name: ThemeName): ProfileTokens => (name === "dark" ? DARK : LIGHT);
