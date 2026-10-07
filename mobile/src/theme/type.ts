import type { TextStyle } from "react-native";

/** Loaded font family names (expo-font keys, theme/fonts.ts), K-403: Archivo cut at its narrowest width for the
 * condensed black display (UGLYCASH's headline), Inter for body, labels and figures, Noto Sans JP for 終値 and the stamp,
 * JetBrains Mono for code only. The legacy role names stay so the screens not yet rebuilt keep resolving. */
export const FONT = {
  display: "Archivo_ExtraCondensed900",
  displayHeavy: "Archivo_ExtraCondensed800",
  displayCondensed: "Archivo_Condensed700",
  headingRegular: "Inter_600",
  headingSemi: "Inter_600",
  heading: "Inter_700",
  headingHeavy: "Inter_800",
  body: "Inter_400",
  bodyMedium: "Inter_500",
  bodyStrong: "Inter_600",
  bodyBold: "Inter_700",
  bodyHeavy: "Inter_800",
  dataRegular: "Inter_400",
  data: "Inter_500",
  dataStrong: "Inter_600",
  scoreboard: "Archivo_ExtraCondensed800",
  label: "Inter_600",
  code: "JetBrainsMono_500Medium",
  stamp: "NotoSansJP_900",
} as const;

/**
 * The kit's type scale (web styles/owarine.css --text-ow-*), letter-spacing em → points at each size. Display is
 * uppercase condensed black at -0.033em; body is Inter at -0.02em. Every lineHeight is at least the size (iOS clips
 * glyph tops otherwise; the app's tight-leading rule).
 */
export const OW_TYPE = {
  display: (size: number): TextStyle => ({ fontFamily: FONT.display, fontSize: size, lineHeight: size, letterSpacing: -0.033 * size, textTransform: "uppercase" }),
  body: (size: number, weight: "400" | "500" | "600" | "700" | "800" = "400"): TextStyle => ({
    fontFamily: `Inter_${weight}`,
    fontSize: size,
    lineHeight: Math.round(size * 1.35),
    letterSpacing: -0.02 * size,
  }),
  num: (size: number, weight: "400" | "500" | "600" | "700" | "800" = "700"): TextStyle => ({
    fontFamily: `Inter_${weight}`,
    fontSize: size,
    lineHeight: Math.ceil(size * 1.1),
    letterSpacing: -0.03 * size,
    fontVariant: ["tabular-nums"],
  }),
} as const;

/** bridge.css's type scale; letter-spacing em → points at each size. */
export const TYPE = {
  display: { fontFamily: FONT.heading, fontSize: 40, lineHeight: 42, letterSpacing: -1.2 },
  headline: { fontFamily: FONT.heading, fontSize: 26, lineHeight: 30, letterSpacing: -0.52 },
  title: { fontFamily: FONT.heading, fontSize: 18, lineHeight: 23 },
  body: { fontFamily: FONT.body, fontSize: 15, lineHeight: 23 },
  bodyStrong: { fontFamily: FONT.bodyStrong, fontSize: 15, lineHeight: 23 },
  caption: { fontFamily: FONT.body, fontSize: 13, lineHeight: 19 },
  labelMicro: { fontFamily: FONT.label, fontSize: 11, lineHeight: 13, letterSpacing: 1.76, textTransform: "uppercase" },
  data: { fontFamily: FONT.data, fontSize: 14, lineHeight: 18, fontVariant: ["tabular-nums"] },
  dataLg: { fontFamily: FONT.dataStrong, fontSize: 20, lineHeight: 24, fontVariant: ["tabular-nums"] },
  dataHero: { fontFamily: FONT.scoreboard, fontSize: 44, lineHeight: 44, letterSpacing: -0.4, fontVariant: ["tabular-nums"] },
  stamp: { fontFamily: FONT.stamp, fontSize: 28, lineHeight: 31 },
  stampHero: { fontFamily: FONT.stamp, fontSize: 64, lineHeight: 64 },
} satisfies Record<string, TextStyle>;

/** Empower's shapes (K-402): modules 16, cards 24, every button a pill. */
export const RADIUS = { sm: 6, md: 10, lg: 16, xl: 24, full: 9999 } as const;
/** 4-pt grid; gutter 16, touch target 44 (bridge.css --spacing*). */
export const SPACE = { unit: 4, gutter: 16, section: 64, touch: 44 } as const;
