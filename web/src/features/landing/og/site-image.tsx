import { ImageResponse } from "next/og";
import { OG_COPY } from "./copy";
import type { TickerSymbol } from "@owarine/core/market";
import { ogArt, ogCantonMark, ogDisplayFonts } from "./fonts";
import { OgMark } from "./OgMark";
import { OG_SIZE, OG_SKY } from "./theme";

const HEADLINE = ["CALL THE CLOSE.", "NOBODY SEES", "YOUR BETS."] as const;
const MARKS: readonly TickerSymbol[] = ["BTC", "ETH", "TSLA", "NVDA", "OPENAI", "SPACEX"] as TickerSymbol[];

/** The site preview (`/opengraph-image`, `/twitter-image`): the landing's sky, its headline, the seal and its objects. */
export async function siteImage(): Promise<ImageResponse> {
  const [key, lock, coin, wings, canton] = await Promise.all([ogArt("old-key"), ogArt("locked"), ogArt("coin"), ogArt("money-with-wings"), ogCantonMark()]);
  const obj = (src: string, size: number, style: Record<string, string | number>) => <img src={src} width={size} height={size} style={{ position: "absolute", ...style }} alt="" />;
  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%", backgroundImage: OG_SKY.gradient, position: "relative", padding: 64, flexDirection: "column", justifyContent: "space-between" }}>
      {obj(lock, 210, { right: 70, top: 60, transform: "rotate(12deg)" })}
      {obj(key, 230, { right: 250, bottom: 30, transform: "rotate(-22deg)" })}
      {obj(coin, 110, { right: 300, top: 40, transform: "rotate(14deg)" })}
      {obj(wings, 150, { right: 40, bottom: 120, transform: "rotate(-8deg)" })}
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div style={{ display: "flex", width: 76, height: 76, borderRadius: 18, backgroundColor: OG_SKY.pink, color: OG_SKY.white, fontFamily: "NotoJP", fontSize: 30, lineHeight: 1, alignItems: "center", justifyContent: "center", flexDirection: "column", transform: "rotate(-6deg)" }}>
          <span>終</span>
          <span>値</span>
        </div>
        <span style={{ fontFamily: "Archivo", fontSize: 54, color: OG_SKY.ink, letterSpacing: "-0.02em" }}>OWARINE</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {HEADLINE.map((line) => (
          <span key={line} style={{ fontFamily: "Archivo", fontSize: 128, lineHeight: 0.86, letterSpacing: "-0.035em", color: OG_SKY.ink }}>
            {line}
          </span>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <div style={{ display: "flex" }}>
          {MARKS.map((m, i) => (
            <div key={m} style={{ display: "flex", marginLeft: i === 0 ? 0 : -14, borderRadius: 999, borderWidth: 4, borderStyle: "solid", borderColor: OG_SKY.white }}>
              <OgMark symbol={m} size={60} />
            </div>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, backgroundColor: OG_SKY.white, borderRadius: 999, paddingTop: 14, paddingBottom: 14, paddingLeft: 22, paddingRight: 24 }}>
          <span style={{ fontFamily: "Sora", fontSize: 24, color: OG_SKY.ink }}>Private on</span>
          <img src={canton} height={30} width={Math.round((30 * 1432) / 369)} alt="Canton" />
        </div>
      </div>
    </div>,
    { ...OG_SIZE, fonts: await ogDisplayFonts() },
  );
}
