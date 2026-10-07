import type { TextStyle } from "react-native";

/** Loaded font family names (expo-font keys, theme/fonts.ts): Mona Sans Expanded for headings and labels, Mona Sans for body
 * and figures, Mona Sans Condensed for scoreboard numerals, Noto Sans JP for the stamp, JetBrains Mono for code only. */
export const FONT = {
  headingRegular: "MonaSans_Expanded600",
  headingSemi: "MonaSans_Expanded600",
  heading: "MonaSans_Expanded700",
  headingHeavy: "MonaSans_Expanded800",
  body: "MonaSans_400",
  bodyMedium: "MonaSans_500",
  bodyStrong: "MonaSans_600",
  bodyBold: "MonaSans_700",
  bodyHeavy: "MonaSans_800",
  dataRegular: "MonaSans_400",
  data: "MonaSans_500",
  dataStrong: "MonaSans_600",
  scoreboard: "MonaSans_Condensed800",
  label: "MonaSans_Expanded600",
  code: "JetBrainsMono_500Medium",
  stamp: "NotoSansJP_900",
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
