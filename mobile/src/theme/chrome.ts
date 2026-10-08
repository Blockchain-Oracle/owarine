import type { ThemeName } from "./index";

/**
 * web's phone chrome as the browser computes it at 402 px (appstrip, marquee, header, the floating dock and the
 * drawer): yosuku part-02/03/14/15, shell.css, navigation.css and tokens.css --nav-*. Read off useagari.xyz, per theme.
 */
const DARK = {
  connectInk: "#FFFFFF", logoInk: "#FFFFFF",
  marqueeBg: "#000000", marqueeBorder: "rgba(255, 255, 255, 0.06)", marqueeLabel: "#575757", marqueeValue: "#FFFFFF",
  headerBg: "rgba(10, 10, 10, 0.96)", headerBorder: "rgba(255, 255, 255, 0.06)", logoJp: "rgba(250, 0, 255, 0.55)",
  toggleBorder: "rgba(255, 255, 255, 0.1)", toggleInk: "#A3A3A3",
  pillBorder: "rgba(255, 255, 255, 0.12)", pillInk: "#CFCFCF", pillTotal: "#FFFFFF", pillDim: "rgba(255, 255, 255, 0.55)", pillUnit: "#7A7A7A",
  addrDotFrom: "#FFFFFF", addrDotTo: "#CFCFCF",
  menuBorder: "rgba(255, 255, 255, 0.1)", menuBg: "#0A0A0A", menuRowLabel: "#7A7A7A", menuVal: "#FFFFFF", menuValSoft: "rgba(255, 255, 255, 0.8)", menuLink: "#CFCFCF", menuDanger: "rgba(250, 0, 255, 0.7)", menuPoolsBorder: "rgba(255, 255, 255, 0.06)",
  dockBg: "rgba(12, 12, 12, 0.72)", dockBorder: "rgba(255, 255, 255, 0.08)", dockInk: "#7A7A7A", dockActiveInk: "#FFFFFF", dockActiveFill: "rgba(255, 255, 255, 0.08)",
  navOverlay: "rgba(0, 0, 0, 0.72)", navPanelBorder: "rgba(255, 255, 255, 0.1)", navDivider: "rgba(255, 255, 255, 0.08)", navSectionDivider: "rgba(255, 255, 255, 0.07)",
  navItemBorder: "rgba(255, 255, 255, 0.08)", navItemFill: "rgba(255, 255, 255, 0.045)", navIconBorder: "rgba(255, 255, 255, 0.09)", navActiveBorder: "rgba(250, 0, 255, 0.35)",
  navLinkInk: "#CFCFCF",
  toastBg: "rgba(23, 22, 22, 0.9)", toastBorder: "rgba(255, 255, 255, 0.22)", toastWarnBorder: "rgba(242, 153, 74, 0.2)", toastInk: "#FFFFFF", toastMuted: "#A3A3A3", toastIcon: "#7A7A7A",
};

const LIGHT: typeof DARK = {
  connectInk: "#FFFFFF", logoInk: "#0A0A0A",
  marqueeBg: "#F2F2F2", marqueeBorder: "rgba(255, 255, 255, 0.06)", marqueeLabel: "#888888", marqueeValue: "#0A0A0A",
  headerBg: "rgba(242, 242, 242, 0.96)", headerBorder: "rgba(255, 255, 255, 0.06)", logoJp: "rgba(250, 0, 255, 0.65)",
  toggleBorder: "rgba(10, 10, 10, 0.14)", toggleInk: "#5E5E5E",
  pillBorder: "rgba(10, 10, 10, 0.14)", pillInk: "rgba(10, 10, 10, 0.75)", pillTotal: "#0A0A0A", pillDim: "rgba(10, 10, 10, 0.55)", pillUnit: "#7A7A7A",
  addrDotFrom: "#0A0A0A", addrDotTo: "#3A3A3A",
  menuBorder: "rgba(10, 10, 10, 0.12)", menuBg: "#F2F2F2", menuRowLabel: "#7A7A7A", menuVal: "#0A0A0A", menuValSoft: "rgba(10, 10, 10, 0.8)", menuLink: "#3A3A3A", menuDanger: "rgba(250, 0, 255, 0.7)", menuPoolsBorder: "rgba(10, 10, 10, 0.08)",
  dockBg: "rgba(242, 242, 242, 0.82)", dockBorder: "rgba(255, 255, 255, 0.08)", dockInk: "#7A7A7A", dockActiveInk: "#0A0A0A", dockActiveFill: "rgba(255, 255, 255, 0.08)",
  navOverlay: "rgba(0, 0, 0, 0.72)", navPanelBorder: "rgba(10, 10, 10, 0.12)", navDivider: "rgba(10, 10, 10, 0.09)", navSectionDivider: "rgba(10, 10, 10, 0.09)",
  navItemBorder: "rgba(10, 10, 10, 0.1)", navItemFill: "rgba(10, 10, 10, 0.04)", navIconBorder: "rgba(10, 10, 10, 0.12)", navActiveBorder: "rgba(250, 0, 255, 0.35)",
  navLinkInk: "#3A3A3A",
  toastBg: "rgba(255, 255, 255, 0.9)", toastBorder: "rgba(10, 10, 10, 0.22)", toastWarnBorder: "rgba(242, 153, 74, 0.2)", toastInk: "#0A0A0A", toastMuted: "#5E5E5E", toastIcon: "#7A7A7A",
};

export type ChromeTokens = typeof DARK;
export const chromeTokens = (name: ThemeName): ChromeTokens => (name === "dark" ? DARK : LIGHT);

/** Heights of the fixed chrome (px = pt): header 46 (web's strip is not drawn in the app). */
export const CHROME = { header: 46, dockClearance: 112 } as const;
