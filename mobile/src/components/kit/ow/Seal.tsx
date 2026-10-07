import Svg, { Rect, Text as SvgText } from "react-native-svg";
import { FONT, useTheme } from "~/theme";

/**
 * The 終値 hanko (web components/kit/Seal): two kanji stacked in a rounded square. The web seal roughs its edges with
 * an SVG turbulence filter; react-native-svg has no filters, so the phone draws it clean.
 */
export function Seal({ size = 48, tone = "pink", rotate = -6, title = "終値 Owarine" }: { size?: number; tone?: "pink" | "black" | "white"; rotate?: number; title?: string }) {
  const { color } = useTheme();
  const ink = tone === "pink" ? color.ow.pink : tone === "black" ? color.ow.black : color.ow.white;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityLabel={title} style={{ transform: [{ rotate: `${rotate}deg` }] }}>
      <Rect x={6} y={6} width={88} height={88} rx={16} stroke={ink} strokeWidth={7} fill="none" />
      <SvgText x={50} y={47} textAnchor="middle" fill={ink} fontSize={38} fontFamily={FONT.stamp}>
        終
      </SvgText>
      <SvgText x={50} y={84} textAnchor="middle" fill={ink} fontSize={38} fontFamily={FONT.stamp}>
        値
      </SvgText>
    </Svg>
  );
}
