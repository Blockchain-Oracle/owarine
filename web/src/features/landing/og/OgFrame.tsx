import type { ReactNode } from "react";
import { BRAND } from "@/lib/copy";
import { OG_COPY } from "./copy";
import { OG, OG_PAD } from "./theme";

const CROP = 28;
const CROP_INSET = 32;

/** Masayume's `.crop` corner marks (part-04), one L per corner, drawn with per-side borders satori understands. */
function Crop({ at }: { at: "tl" | "tr" | "bl" | "br" }) {
  const top = at[0] === "t";
  const left = at[1] === "l";
  return (
    <div
      style={{
        position: "absolute",
        width: CROP,
        height: CROP,
        ...(top ? { top: CROP_INSET } : { bottom: CROP_INSET }),
        ...(left ? { left: CROP_INSET } : { right: CROP_INSET }),
        ...(top ? { borderTopWidth: 1, borderTopStyle: "solid", borderTopColor: OG.crop } : { borderBottomWidth: 1, borderBottomStyle: "solid", borderBottomColor: OG.crop }),
        ...(left ? { borderLeftWidth: 1, borderLeftStyle: "solid", borderLeftColor: OG.crop } : { borderRightWidth: 1, borderRightStyle: "solid", borderRightColor: OG.crop }),
      }}
    />
  );
}

/** The 終値 seal at preview size (the app's mark), beside the name. */
function Wordmark() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 46, height: 46, borderRadius: 10, borderWidth: 4, borderStyle: "solid", borderColor: OG.signal, color: OG.signal, fontFamily: "NotoJP", fontSize: 17, lineHeight: 1, transform: "rotate(-6deg)" }}>
        <span>終</span>
        <span>値</span>
      </div>
      <div style={{ display: "flex", fontSize: 30, letterSpacing: "0.22em", color: OG.ink }}>{BRAND.name.toUpperCase()}</div>
    </div>
  );
}

interface OgFrameProps {
  eyebrow: string;
  children: ReactNode;
}

/** Every preview: the dark ground, the crop marks, the wordmark and an eyebrow on top, the honesty line at the foot. */
export function OgFrame({ eyebrow, children }: OgFrameProps) {
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        padding: OG_PAD,
        background: OG.ground,
        color: OG.ink,
        fontFamily: "Sora",
      }}
    >
      <Crop at="tl" />
      <Crop at="tr" />
      <Crop at="bl" />
      <Crop at="br" />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Wordmark />
        <div style={{ display: "flex", fontSize: 18, letterSpacing: "0.18em", textTransform: "uppercase", color: OG.dim }}>{eyebrow}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>{children}</div>
      {/* Not uppercased: "credits" is a name with fixed casing, and "TUSDC" reads as a different token. */}
      <div style={{ display: "flex", fontSize: 22, letterSpacing: "0.04em", color: OG.dim }}>{OG_COPY.honesty}</div>
    </div>
  );
}
