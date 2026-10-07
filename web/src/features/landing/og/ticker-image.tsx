import { isTokenOnlyKind, TICKERS, type TickerSymbol } from "@owarine/core/market";
import { ImageResponse } from "next/og";
import { OG_COPY } from "./copy";
import { ogFonts } from "./fonts";
import { OgFrame } from "./OgFrame";
import { OgMark } from "./OgMark";
import { OG, OG_SIZE } from "./theme";
import { readTickerClose, type TickerClose } from "./ticker-data";
import { readTickerLive, type TickerLive } from "./ticker-live";

/** A 24/7 name's live print (C8d): a basket in points, a valuation lane that is not listed with why. */
function LiveBlock({ live }: { live: TickerLive | null }) {
  if (!live) return <div style={{ display: "flex", marginTop: 28, fontSize: 36, color: OG.soft }}>{OG_COPY.ticker.noLivePrice}</div>;
  if (live.kind === "unlisted") {
    return (
      <div style={{ display: "flex", flexDirection: "column", marginTop: 28, maxWidth: 760 }}>
        <div style={{ display: "flex", fontSize: 56, letterSpacing: "-0.03em", color: OG.soft }}>{OG_COPY.ticker.unlisted}</div>
        <div style={{ display: "flex", marginTop: 12, fontSize: 24, color: OG.dim }}>{OG_COPY.ticker.unlistedWhy(live.why)}</div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", marginTop: 28 }}>
      <div style={{ display: "flex", fontSize: 72, letterSpacing: "-0.03em", color: OG.ink }}>{live.price}</div>
      <div style={{ display: "flex", marginTop: 12, fontSize: 26, color: OG.dim }}>{live.basket ? OG_COPY.ticker.liveIndex(live.atUtc) : OG_COPY.ticker.livePrint(live.atUtc)}</div>
    </div>
  );
}

function CloseBlock({ close }: { close: TickerClose | null }) {
  if (!close) return <div style={{ display: "flex", marginTop: 28, fontSize: 36, color: OG.soft }}>{OG_COPY.ticker.noPrice}</div>;
  const tone = close.change?.direction === "down" ? OG.down : close.change?.direction === "up" ? OG.up : OG.soft;
  return (
    <div style={{ display: "flex", flexDirection: "column", marginTop: 28 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 28 }}>
        <div style={{ display: "flex", fontSize: 72, letterSpacing: "-0.03em", color: OG.ink }}>{close.price}</div>
        {close.change && (
          <div style={{ display: "flex", fontSize: 40, color: tone }}>
            {close.change.dollars} · {close.change.percent}
          </div>
        )}
      </div>
      <div style={{ display: "flex", marginTop: 12, fontSize: 26, color: OG.dim }}>{OG_COPY.ticker.lastClose(close.when)}</div>
    </div>
  );
}

/**
 * A ticker's preview (`/tickers/<SYMBOL>/opengraph-image`): its mark, symbol and name, and the last close with the move;
 * a 24/7 name (crypto, pre-IPO, basket, valuation) shows its live print instead (C8d).
 */
export async function tickerImage(symbol: TickerSymbol): Promise<ImageResponse> {
  const allDay = isTokenOnlyKind(TICKERS[symbol].kind);
  const [fonts, close, live] = await Promise.all([ogFonts(), allDay ? null : readTickerClose(symbol), allDay ? readTickerLive(symbol) : null]);
  return new ImageResponse(
    <OgFrame eyebrow={OG_COPY.ticker.eyebrow}>
      <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 56 }}>
        <OgMark symbol={symbol} size={184} />
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", columnGap: 24 }}>
            <div style={{ display: "flex", fontSize: 112, lineHeight: 1, letterSpacing: "-0.035em", color: OG.ink }}>{symbol}</div>
            <div style={{ display: "flex", fontSize: 40, color: OG.soft }}>{TICKERS[symbol].name}</div>
          </div>
          {allDay ? <LiveBlock live={live} /> : <CloseBlock close={close} />}
        </div>
      </div>
    </OgFrame>,
    { ...OG_SIZE, fonts },
  );
}
