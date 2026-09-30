import qrcode from "qrcode-generator";
import { useMemo } from "react";
import Svg, { Path, Rect } from "react-native-svg";
import { useTheme } from "~/theme";

/** The QR spec's quiet zone, in modules, on every side. */
const QUIET = 4;

/**
 * web's `SeatQr` on the phone: the reference's own `qrcode-generator` (byte mode, level M, smallest version that holds
 * the text) drawn as one SVG path, dark on the cream tile in both themes (`--color-cream` / `--color-cream-ink`), so any
 * camera reads it.
 */
export function SeatQr({ text, label, size }: { text: string; label: string; size: number }) {
  const { color } = useTheme();
  const { modules, d } = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(text);
    qr.make();
    const count = qr.getModuleCount();
    let path = "";
    for (let row = 0; row < count; row += 1) {
      for (let col = 0; col < count; col += 1) if (qr.isDark(row, col)) path += `M${col + QUIET} ${row + QUIET}h1v1h-1z`;
    }
    return { modules: count + QUIET * 2, d: path };
  }, [text]);
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${modules} ${modules}`} accessibilityRole="image" accessibilityLabel={label}>
      <Rect width={modules} height={modules} fill={color.cream} />
      <Path d={d} fill={color.creamInk} />
    </Svg>
  );
}
