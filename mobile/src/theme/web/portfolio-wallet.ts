import type { ThemeName } from "../index";

/**
 * web's money dialogs as the browser computes them at 402 px, per theme: the Add-funds modal and the first-credit card
 * (features/funding/funding.css) and RainbowKit's phone sheet for connect and account (providers/wallet/wallet-modal.css).
 * The grays that equal a `useTheme().color` role (gray-400/500/600, --white) are read from there instead.
 */
const DARK = {
  // .fund-modal-scrim, .credit-scrim
  fundScrim: "rgba(0, 0, 0, 0.7)", creditScrim: "rgba(0, 0, 0, 0.6)",
  // .fund-modal: bg-[#0f0e0e] border-white/10; .credit-card bg-[#0e0d0d]
  fundPaper: "#0F0E0E", fundBorder: "rgba(255, 255, 255, 0.1)", creditPaper: "#0E0D0D",
  // .fund-account and .fund-foot hairlines (white/[0.06] in both themes), .fund-balances cells (white 12%)
  fundLine: "rgba(255, 255, 255, 0.06)", fundCell: "rgba(255, 255, 255, 0.12)",
  // .fund-account-addr gray-300
  addrInk: "#CDCBC3",
  // .fund-cta-white: bg-white text-black (light: #100F0F on the ground)
  ctaWhite: "#FFFFFF", ctaWhiteInk: "#000000",
  // .fund-cta-signal: var(--signal), #fff
  signal: "#E4E24E", signalInk: "#100F0F",
  // .credit-card: profit at 25% border, 10% badge fill, 30% badge ring, 80% eyebrow
  creditBorder: "rgba(61, 214, 140, 0.25)", creditBadgeFill: "rgba(61, 214, 140, 0.1)", creditBadgeRing: "rgba(61, 214, 140, 0.3)", creditEyebrow: "rgba(61, 214, 140, 0.8)",
  // .wm-feature-art
  featureArt: "#D0D5DE",
};

const LIGHT: typeof DARK = {
  fundScrim: "rgba(0, 0, 0, 0.7)", creditScrim: "rgba(0, 0, 0, 0.6)",
  fundPaper: "#F5F4EF", fundBorder: "rgba(16, 15, 15, 0.12)", creditPaper: "#F5F4EF",
  fundLine: "rgba(255, 255, 255, 0.06)", fundCell: "rgba(16, 15, 15, 0.12)",
  addrInk: "#42413C",
  ctaWhite: "#100F0F", ctaWhiteInk: "#F5F4EF",
  signal: "#E4E24E", signalInk: "#100F0F",
  creditBorder: "rgba(14, 138, 87, 0.25)", creditBadgeFill: "rgba(14, 138, 87, 0.1)", creditBadgeRing: "rgba(14, 138, 87, 0.3)", creditEyebrow: "rgba(14, 138, 87, 0.8)",
  featureArt: "#D0D5DE",
};

export type WalletTokens = typeof DARK;
export const walletTokens = (name: ThemeName): WalletTokens => (name === "dark" ? DARK : LIGHT);
