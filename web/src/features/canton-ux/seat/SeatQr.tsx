import qrcode from "qrcode-generator";
import { useMemo } from "react";

/** The QR spec's quiet zone, in modules, on every side. */
const QUIET = 4;

/**
 * A QR as one SVG path, drawn with the reference's own `qrcode-generator` (byte mode, level M, smallest version that
 * holds the text), as `features/share/stub.ts` encodes the share card's. Dark on the cream tile in both themes, so any
 * phone camera reads it.
 */
export function SeatQr({ text, label, className }: { text: string; label: string; className?: string }) {
  const { size, d } = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(text);
    qr.make();
    const count = qr.getModuleCount();
    let path = "";
    for (let row = 0; row < count; row += 1) {
      for (let col = 0; col < count; col += 1) {
        if (qr.isDark(row, col)) path += `M${col + QUIET} ${row + QUIET}h1v1h-1z`;
      }
    }
    return { size: count + QUIET * 2, d: path };
  }, [text]);
  return (
    <svg className={className} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={size} height={size} className="cx-qr-paper" />
      <path d={d} className="cx-qr-ink" />
    </svg>
  );
}
