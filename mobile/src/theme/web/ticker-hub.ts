import type { ThemeName } from "../index";

/**
 * web's /tickers/<SYMBOL> on a phone (ticker-hub.css, profile.css `.prf-*`, news.css, market-session.css `.mks-chip`,
 * desk-kit.css `.dkit-status`, source-line.css), as useagari.xyz computes it per theme. Everything else is a palette role.
 */
const DARK = {
  /** `--news-hairline`: the figure bar's rule. */
  barRule: "rgba(255, 255, 255, 0.12)",
  /** `.dkit-status[data-tone=live]`: the profit ink at 40 %. */
  liveBorder: "rgba(61, 214, 140, 0.4)",
  /** `.mks-chip` pre-market / after-hours dot: --gray-300. */
  chipDotLit: "#CDCBC3",
  /** `.mks-chip` holiday dot: signal at 55 %. */
  chipDotHoliday: "rgba(228, 226, 78, 0.55)",
  /** `.src-line-link` underline: --gray-700. */
  underline: "#3B3A37",
};

const LIGHT: typeof DARK = {
  barRule: "rgba(16, 15, 15, 0.12)",
  liveBorder: "rgba(14, 138, 87, 0.4)",
  chipDotLit: "#42413C",
  chipDotHoliday: "rgba(228, 226, 78, 0.55)",
  underline: "#D6D4CB",
};

export type TickerHubTokens = typeof DARK;
export const tickerHubTokens = (name: ThemeName): TickerHubTokens => (name === "dark" ? DARK : LIGHT);
