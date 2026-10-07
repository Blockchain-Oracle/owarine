import type { TextStyle } from "react-native";
import type { ThemeName } from "../index";
import { FONT } from "../type";

/**
 * web's Portfolio family as the browser computes it at 402 px, per theme: the ledger plate (ledger-plate.css
 * --lp-*), the bets plate and pager (history.css), the X wallet card (x-card.css) and the shadcn button fills.
 * Everything that already equals a `useTheme().color` role is read from there instead.
 */
const DARK = {
  // ledger-plate.css: the plate follows the theme in dark (surface-1 and the theme's inks)
  lpPaper: "#171616", lpPaperRaised: "#262525", lpInk: "#FFFFFF", lpMute: "#A19F96", lpLine: "rgba(255, 255, 255, 0.1)",
  // fixed signal in both themes (.lp-figure, .lp-bar-*, .pool-action)
  signal: "#E4E24E", barAccount: "rgba(228, 226, 78, 0.35)", barPositions: "rgba(228, 226, 78, 0.65)", actionBorder: "rgba(228, 226, 78, 0.45)", actionWash: "rgba(228, 226, 78, 0.07)",
  slabBorder: "rgba(228, 226, 78, 0.3)", earnedWash: "rgba(228, 226, 78, 0.06)", earnedIconWash: "rgba(228, 226, 78, 0.08)", earnedIconBorder: "rgba(228, 226, 78, 0.35)",
  // .connect-card: gray-500 ring glyph, gray-600 link
  ringInk: "#76746C", linkInk: "#55544E",
  // history.css
  rowHover: "rgba(255, 255, 255, 0.02)", markGeneric: "rgba(255, 255, 255, 0.1)", receiptInk: "rgba(255, 255, 255, 0.4)",
  equityZero: "rgba(255, 255, 255, 0.16)", equityDown: "rgba(255, 255, 255, 0.55)", equityDot: "#FFFFFF",
  equityEmptyBorder: "rgba(255, 255, 255, 0.06)", equityEmptyFill: "rgba(255, 255, 255, 0.015)", equityEmptyInk: "rgba(255, 255, 255, 0.25)",
  repBar: "rgba(255, 255, 255, 0.06)", badgeRankFill: "rgba(255, 255, 255, 0.02)", badgeLocked: "rgba(255, 255, 255, 0.018)", badgeLockedOpacity: 0.45,
  // x-card.css: its foot hairline, the slab and the verified button ink
  xFootLine: "rgba(188, 186, 179, 0.6)", xLoss: "#B53D30", xMint: "#3DD68C", xInkWash: "rgba(255, 255, 255, 0.03)", xSourceOn: "rgba(228, 226, 78, 0.08)", xSlabHard: "rgba(228, 226, 78, 0.4)", xSlabHardFill: "rgba(228, 226, 78, 0.09)", xPermissionWash: "rgba(228, 226, 78, 0.06)",
  // skeleton (bg-muted)
  skeleton: "#262525",
  // vault.css inside the plate: color-mix(ink N%) borders, the private route's profit border, the idle-yield block
  vInk18: "rgba(255, 255, 255, 0.18)", vInk22: "rgba(255, 255, 255, 0.22)", vInk45: "rgba(255, 255, 255, 0.45)", vProfit60: "rgba(61, 214, 140, 0.6)", vProfit30: "rgba(61, 214, 140, 0.3)", vProfit55: "rgba(61, 214, 140, 0.55)",
  idleLine: "rgba(255, 255, 255, 0.07)", idleHead: "#CDCBC3", idleBody: "#76746C", idleValue: "#CDCBC3",
  // private-claims.css `.plate-rows .pc*`: the fixed side pills and checks, the plate-ink mixes
  pcUp: "#3DD68C", pcUpWash: "rgba(61, 214, 140, 0.12)", pcDown: "#FF5C61", pcDownWash: "rgba(255, 92, 97, 0.12)",
  ink78: "rgba(255, 255, 255, 0.78)", ink50: "rgba(255, 255, 255, 0.5)", ink40: "rgba(255, 255, 255, 0.4)", loss30: "rgba(255, 92, 97, 0.3)",
  // yosuku .btn-primary keeps light text on signal in both themes (part-14)
  btnPrimaryInk: "#100F0F",
  // trader-edge-link.css --te-*
  teBg: "#0E0D0D", teText: "#F5F4F1", teMute: "#8F8E86", teRule: "rgba(255, 255, 255, 0.1)", teActionInk: "#100F0F",
};

const LIGHT: typeof DARK = {
  lpPaper: "#FAF9F5", lpPaperRaised: "#FDFCFA", lpInk: "#171515", lpMute: "#656359", lpLine: "rgba(188, 186, 179, 0.4)",
  signal: "#E4E24E", barAccount: "rgba(228, 226, 78, 0.35)", barPositions: "rgba(228, 226, 78, 0.65)", actionBorder: "rgba(228, 226, 78, 0.45)", actionWash: "rgba(228, 226, 78, 0.07)",
  slabBorder: "rgba(228, 226, 78, 0.3)", earnedWash: "rgba(228, 226, 78, 0.06)", earnedIconWash: "rgba(228, 226, 78, 0.08)", earnedIconBorder: "rgba(228, 226, 78, 0.35)",
  ringInk: "#76746C", linkInk: "#9C9A91",
  rowHover: "rgba(16, 15, 15, 0.03)", markGeneric: "rgba(16, 15, 15, 0.1)", receiptInk: "rgba(16, 15, 15, 0.62)",
  equityZero: "rgba(16, 15, 15, 0.22)", equityDown: "rgba(16, 15, 15, 0.62)", equityDot: "#100F0F",
  equityEmptyBorder: "rgba(16, 15, 15, 0.07)", equityEmptyFill: "rgba(16, 15, 15, 0.02)", equityEmptyInk: "rgba(16, 15, 15, 0.5)",
  repBar: "rgba(16, 15, 15, 0.08)", badgeRankFill: "rgba(16, 15, 15, 0.03)", badgeLocked: "rgba(16, 15, 15, 0.02)", badgeLockedOpacity: 0.55,
  xFootLine: "rgba(188, 186, 179, 0.6)", xLoss: "#B53D30", xMint: "#3DD68C", xInkWash: "rgba(23, 21, 21, 0.03)", xSourceOn: "rgba(228, 226, 78, 0.08)", xSlabHard: "rgba(228, 226, 78, 0.4)", xSlabHardFill: "rgba(228, 226, 78, 0.09)", xPermissionWash: "rgba(228, 226, 78, 0.06)",
  skeleton: "#ECEBE5",
  vInk18: "rgba(23, 21, 21, 0.18)", vInk22: "rgba(23, 21, 21, 0.22)", vInk45: "rgba(23, 21, 21, 0.45)", vProfit60: "rgba(14, 138, 87, 0.6)", vProfit30: "rgba(14, 138, 87, 0.3)", vProfit55: "rgba(14, 138, 87, 0.55)",
  idleLine: "rgba(16, 15, 15, 0.08)", idleHead: "rgba(16, 15, 15, 0.78)", idleBody: "rgba(16, 15, 15, 0.6)", idleValue: "rgba(16, 15, 15, 0.8)",
  pcUp: "#3DD68C", pcUpWash: "rgba(61, 214, 140, 0.12)", pcDown: "#FF5C61", pcDownWash: "rgba(255, 92, 97, 0.12)",
  ink78: "rgba(23, 21, 21, 0.78)", ink50: "rgba(23, 21, 21, 0.5)", ink40: "rgba(23, 21, 21, 0.4)", loss30: "rgba(210, 52, 60, 0.3)",
  btnPrimaryInk: "#100F0F",
  teBg: "#F8F7F2", teText: "#171515", teMute: "#68665C", teRule: "rgba(33, 32, 29, 0.14)", teActionInk: "#100F0F",
};

export type PortfolioTokens = typeof DARK;
export const portfolioTokens = (name: ThemeName): PortfolioTokens => (name === "dark" ? DARK : LIGHT);

/**
 * web's type utilities (base.css + bridge.css) as they compute on the phone. `--font-data` resolves to nothing there, so
 * `type-label-micro`, `type-data*` and `.numbers` fall back to Inter; only `font-mono` rules (yosuku, the plate) are JetBrains.
 * Sora's 650 and 750 have no face in the app: 700 and 800.
 */
export const WEB_TYPE = {
  headline: { fontFamily: FONT.heading, fontSize: 26, lineHeight: 29.9, letterSpacing: -0.52 },
  title: { fontFamily: FONT.heading, fontSize: 18, lineHeight: 23.4 },
  body: { fontFamily: FONT.body, fontSize: 15, lineHeight: 23.25 },
  bodyStrong: { fontFamily: FONT.bodyStrong, fontSize: 15, lineHeight: 23.25 },
  caption: { fontFamily: FONT.body, fontSize: 13, lineHeight: 18.85 },
  labelMicro: { fontFamily: FONT.bodyMedium, fontSize: 11, lineHeight: 13.2, letterSpacing: 1.76, textTransform: "uppercase" },
  data: { fontFamily: FONT.bodyMedium, fontSize: 14, lineHeight: 18.2, fontVariant: ["tabular-nums"] },
  dataLg: { fontFamily: FONT.bodyStrong, fontSize: 20, lineHeight: 24, fontVariant: ["tabular-nums"] },
  dataHero: { fontFamily: FONT.bodyStrong, fontSize: 36.18, lineHeight: 38, letterSpacing: -0.36, fontVariant: ["tabular-nums"] },
  numbers: { fontVariant: ["tabular-nums"] },
} satisfies Record<string, TextStyle>;

/** web's `.container` / `px-gutter` inset and the page rhythm (`py-8`, `gap-8`) on Portfolio. */
export const WEB_PAGE = { gutter: 16, padY: 32, gap: 32, dock: 112 } as const;
