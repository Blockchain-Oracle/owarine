import type { ThemeName } from "./index";

/**
 * web's phone chrome as the browser computes it at 402 px (appstrip, marquee, header, the floating dock and the
 * drawer): yosuku part-02/03/14/15, shell.css, navigation.css and tokens.css --nav-*. Read off useagari.xyz, per theme.
 */
const DARK = {
  connectInk: "#FFFFFF", logoInk: "#FFFFFF",
  marqueeBg: "#000000", marqueeBorder: "rgba(255, 255, 255, 0.06)", marqueeLabel: "#55544E", marqueeValue: "#FFFFFF",
  headerBg: "rgba(16, 15, 15, 0.96)", headerBorder: "rgba(255, 255, 255, 0.06)", logoJp: "rgba(228, 226, 78, 0.55)",
  toggleBorder: "rgba(255, 255, 255, 0.1)", toggleInk: "#A19F96",
  pillBorder: "rgba(255, 255, 255, 0.12)", pillInk: "#CDCBC3", pillTotal: "#FFFFFF", pillDim: "rgba(255, 255, 255, 0.55)", pillUnit: "#76746C",
  addrDotFrom: "#FFFFFF", addrDotTo: "#CDCBC3",
  menuBorder: "rgba(255, 255, 255, 0.1)", menuBg: "#100F0F", menuRowLabel: "#76746C", menuVal: "#FFFFFF", menuValSoft: "rgba(255, 255, 255, 0.8)", menuLink: "#CDCBC3", menuDanger: "rgba(228, 226, 78, 0.7)", menuPoolsBorder: "rgba(255, 255, 255, 0.06)",
  dockBg: "rgba(12, 12, 12, 0.72)", dockBorder: "rgba(255, 255, 255, 0.08)", dockInk: "#76746C", dockActiveInk: "#FFFFFF", dockActiveFill: "rgba(255, 255, 255, 0.08)",
  navOverlay: "rgba(0, 0, 0, 0.72)", navPanelBorder: "rgba(255, 255, 255, 0.1)", navDivider: "rgba(255, 255, 255, 0.08)", navSectionDivider: "rgba(255, 255, 255, 0.07)",
  navItemBorder: "rgba(255, 255, 255, 0.08)", navItemFill: "rgba(255, 255, 255, 0.045)", navIconBorder: "rgba(255, 255, 255, 0.09)", navActiveBorder: "rgba(228, 226, 78, 0.35)",
  navLinkInk: "#CDCBC3",
  toastBg: "rgba(23, 22, 22, 0.9)", toastBorder: "rgba(255, 255, 255, 0.22)", toastWarnBorder: "rgba(242, 153, 74, 0.2)", toastInk: "#FFFFFF", toastMuted: "#A19F96", toastIcon: "#76746C",
};

const LIGHT: typeof DARK = {
  connectInk: "#FFFFFF", logoInk: "#100F0F",
  marqueeBg: "#F5F4EF", marqueeBorder: "rgba(255, 255, 255, 0.06)", marqueeLabel: "#9C9A91", marqueeValue: "#100F0F",
  headerBg: "rgba(245, 244, 239, 0.96)", headerBorder: "rgba(255, 255, 255, 0.06)", logoJp: "rgba(228, 226, 78, 0.65)",
  toggleBorder: "rgba(16, 15, 15, 0.14)", toggleInk: "#5C5B55",
  pillBorder: "rgba(16, 15, 15, 0.14)", pillInk: "rgba(16, 15, 15, 0.75)", pillTotal: "#100F0F", pillDim: "rgba(16, 15, 15, 0.55)", pillUnit: "#76746C",
  addrDotFrom: "#100F0F", addrDotTo: "#42413C",
  menuBorder: "rgba(16, 15, 15, 0.12)", menuBg: "#F5F4EF", menuRowLabel: "#76746C", menuVal: "#100F0F", menuValSoft: "rgba(16, 15, 15, 0.8)", menuLink: "#42413C", menuDanger: "rgba(228, 226, 78, 0.7)", menuPoolsBorder: "rgba(16, 15, 15, 0.08)",
  dockBg: "rgba(245, 244, 239, 0.82)", dockBorder: "rgba(255, 255, 255, 0.08)", dockInk: "#76746C", dockActiveInk: "#100F0F", dockActiveFill: "rgba(255, 255, 255, 0.08)",
  navOverlay: "rgba(0, 0, 0, 0.72)", navPanelBorder: "rgba(16, 15, 15, 0.12)", navDivider: "rgba(16, 15, 15, 0.09)", navSectionDivider: "rgba(16, 15, 15, 0.09)",
  navItemBorder: "rgba(16, 15, 15, 0.1)", navItemFill: "rgba(16, 15, 15, 0.04)", navIconBorder: "rgba(16, 15, 15, 0.12)", navActiveBorder: "rgba(228, 226, 78, 0.35)",
  navLinkInk: "#42413C",
  toastBg: "rgba(255, 255, 255, 0.9)", toastBorder: "rgba(16, 15, 15, 0.22)", toastWarnBorder: "rgba(242, 153, 74, 0.2)", toastInk: "#100F0F", toastMuted: "#5C5B55", toastIcon: "#76746C",
};

export type ChromeTokens = typeof DARK;
export const chromeTokens = (name: ThemeName): ChromeTokens => (name === "dark" ? DARK : LIGHT);

/** Heights of the fixed chrome (px = pt): marquee 20, header 46 (web's strip is not drawn in the app). */
export const CHROME = { marquee: 20, header: 46, dockClearance: 112 } as const;
