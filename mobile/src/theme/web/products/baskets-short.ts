import type { ThemeName } from "../../index";

/**
 * `/baskets` and `/short` as the browser computes them at 402 px (useagari.xyz, per theme): baskets.css, the desk
 * kit's status chip and logo stack, short-page.css, short-picker.css, market-session.css and shell.css's
 * capability-pending. Only the values the app palette has no role for live here; the rest read `useTheme().color`.
 */
const DARK = {
  /** .dkit-status[data-tone="live"]: the profit ink at 40%. */
  liveChipBorder: "rgba(61, 220, 90, 0.4)",
  /** .bk-action[data-kind="cover"]: loss 55% into the hairline. */
  /** .sh-eyebrow: signal at 80%. */
  eyebrow: "rgba(250, 0, 255, 0.8)",
  /** .section-head's rule (both themes compute the dark value). */
  sectionRule: "rgba(255, 255, 255, 0.08)",
  /** .sh-picker / .sh-ticket shell. */
  panelBg: "#171717",
  panelBorder: "rgba(255, 255, 255, 0.1)",
  panelShadow: "none",
  /** .sh-filter[aria-pressed] lift. */
  filterShadow: "0px 1px 4px 0px rgba(0, 0, 0, 0.18)",
  /** .sh-window, dashed while it opens later; the chosen one keeps its accent border in dark only. */
  windowBorder: "rgba(255, 255, 255, 0.1)",
  windowOnBorder: "#FA00FF",
  /** .sh-field */
  fieldBorder: "rgba(255, 255, 255, 0.1)",
  fieldFocus: "rgba(255, 255, 255, 0.25)",
  fieldBg: "transparent",
  /** .sh-multiple and its chosen state (signal 55% / 13%). */
  multipleBorder: "rgba(255, 255, 255, 0.1)",
  multipleOnBorder: "rgba(250, 0, 255, 0.55)",
  multipleOnBg: "rgba(250, 0, 255, 0.13)",
  /** .sh-readout's top rule. */
  readoutRule: "rgba(255, 255, 255, 0.08)",
  /** --color-warning (.sh-note--warn, .sh-line--close, the unpriced title). */
  warn: "#F2994A",
  /** .sh-empty */
  emptyBorder: "rgba(255, 255, 255, 0.08)",
  emptyBg: "transparent",
  /** .sh-pos */
  posBorder: "rgba(255, 255, 255, 0.1)",
  posBg: "#171717",
  /** .sh-how-card */
  howBorder: "rgba(255, 255, 255, 0.1)",
  howBg: "#171717",
  /** .mks-chip-dot: closed, pre/post (--gray-300), holiday (signal 55%). */
  sessionDotLit: "#CFCFCF",
  sessionDotHoliday: "rgba(250, 0, 255, 0.55)",
  /** .capability-pending .cp-meta rule. */
  pendingRule: "rgba(255, 255, 255, 0.08)",
  /** .sh-chip-row's mask fades the last 18% to the panel under it. */
  rowFadeFrom: "rgba(23, 22, 22, 0)",
  rowFadeTo: "#171717",
  /** .sh-chip[aria-checked]'s wash fades to nothing at 80%: the accent at 0 so the fade never greys. */
  chipWashEnd: "rgba(250, 0, 255, 0)",
};

const LIGHT: typeof DARK = {
  liveChipBorder: "rgba(7, 138, 46, 0.4)",
  eyebrow: "rgba(250, 0, 255, 0.8)",
  sectionRule: "rgba(255, 255, 255, 0.08)",
  panelBg: "rgba(10, 10, 10, 0.016)",
  panelBorder: "rgba(10, 10, 10, 0.1)",
  panelShadow: "0px 20px 44px -32px rgba(10, 10, 10, 0.16)",
  filterShadow: "0px 1px 4px 0px rgba(0, 0, 0, 0.18)",
  windowBorder: "rgba(10, 10, 10, 0.14)",
  windowOnBorder: "rgba(10, 10, 10, 0.14)",
  fieldBorder: "rgba(10, 10, 10, 0.16)",
  fieldFocus: "rgba(250, 0, 255, 0.5)",
  fieldBg: "rgba(255, 255, 255, 0.45)",
  multipleBorder: "rgba(10, 10, 10, 0.14)",
  multipleOnBorder: "rgba(10, 10, 10, 0.14)",
  multipleOnBg: "rgba(250, 0, 255, 0.13)",
  readoutRule: "rgba(10, 10, 10, 0.08)",
  warn: "#A85A12",
  emptyBorder: "rgba(10, 10, 10, 0.1)",
  emptyBg: "rgba(255, 255, 255, 0.94)",
  posBorder: "rgba(10, 10, 10, 0.1)",
  posBg: "rgba(255, 255, 255, 0.94)",
  howBorder: "rgba(10, 10, 10, 0.11)",
  howBg: "rgba(255, 255, 255, 0.94)",
  sessionDotLit: "#3A3A3A",
  sessionDotHoliday: "rgba(250, 0, 255, 0.55)",
  pendingRule: "rgba(10, 10, 10, 0.12)",
  rowFadeFrom: "rgba(239, 237, 225, 0)",
  rowFadeTo: "#EFEDE1",
  chipWashEnd: "rgba(250, 0, 255, 0)",
};

export type BasketsShortTokens = typeof DARK;
export const basketsShortTokens = (name: ThemeName): BasketsShortTokens => (name === "dark" ? DARK : LIGHT);
