import { JetBrains_Mono, Mona_Sans, Noto_Sans_JP } from "next/font/google";

/**
 * Owarine's faces (K-402). One family, Mona Sans, with its width axis loaded so the same file draws the expanded
 * headings and labels (wdth 125), the body and figures (100) and the condensed scoreboard numerals (75). Noto Sans JP
 * draws the kana and kanji (終値, the verdict stamps). JetBrains Mono stays for code only: party and update ids and
 * the literal ledger query (`--font-code`).
 */

export const monaSans = Mona_Sans({
  variable: "--font-mona",
  subsets: ["latin"],
  display: "swap",
  axes: ["wdth"],
});

export const notoSansJp = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  display: "swap",
  weight: ["700", "900"],
});

export const jetbrainsMono = JetBrains_Mono({
  variable: "--font-code",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500"],
});

export const fontVariables = [monaSans.variable, notoSansJp.variable, jetbrainsMono.variable].join(" ");
