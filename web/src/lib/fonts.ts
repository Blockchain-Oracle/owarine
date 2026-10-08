import { Archivo, Inter, JetBrains_Mono, Noto_Sans_JP, Nunito } from "next/font/google";

/**
 * Owarine's faces (K-403, the UGLYCASH / Tradash revamp).
 *
 *   Archivo   display: loaded with its width axis so headlines set extra-condensed and black (wdth 62, wght 900), the
 *             free stand-in for UGLYCASH's Helvetica Now Display Condensed Bold, tracked -0.033em.
 *   Inter     body, labels and figures (tabular numerals for prices and PnL), tracked -0.02em.
 *   JetBrains Mono  the chart's price axis and the ledger's ids, like Tradash's axis column.
 *   Noto Sans JP    終値 and the seal stamp.
 *   Nunito    the landing's rounded display (8 Oct, the "Rainbow" direction): the free stand-in for SF Pro Rounded, 600–900.
 */

export const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  display: "swap",
  axes: ["wdth"],
});

export const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
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
  weight: ["400", "500", "700"],
});

export const nunito = Nunito({
  variable: "--font-rounded",
  subsets: ["latin"],
  display: "swap",
  weight: ["600", "700", "800", "900"],
});

export const fontVariables = [archivo.variable, inter.variable, notoSansJp.variable, jetbrainsMono.variable, nunito.variable].join(" ");
