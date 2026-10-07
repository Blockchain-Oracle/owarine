import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * The 終値 hanko: Owarine's mark, drawn in code. Two kanji stacked in a rounded square, stamped — a turbulence filter
 * roughs the edges like ink on paper. `stamp` plays a one-shot press (scale down, slight overshoot) when it mounts.
 */
const TONES = { pink: "var(--ow-pink)", black: "var(--ow-black)", white: "var(--ow-white)", ink: "currentColor" } as const;

export function Seal({ size = 48, tone = "pink", rough = true, stamp, rotate = -6, className, title = "終値 Owarine" }: { size?: number; tone?: keyof typeof TONES; rough?: boolean; stamp?: boolean; rotate?: number; className?: string; title?: string }) {
  const id = useId().replace(/:/g, "");
  const colour = TONES[tone];
  return (
    <svg
      role="img"
      aria-label={title}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={cn("shrink-0", stamp && "ow-seal-stamp", className)}
      style={{ rotate: `${rotate}deg`, color: colour }}
    >
      {rough ? (
        <defs>
          <filter id={`ink-${id}`} x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.6" />
          </filter>
        </defs>
      ) : null}
      <g filter={rough ? `url(#ink-${id})` : undefined} fill="none" stroke="currentColor">
        <rect x="6" y="6" width="88" height="88" rx="16" strokeWidth="7" />
        <text
          x="50"
          y="47"
          textAnchor="middle"
          fill="currentColor"
          stroke="none"
          fontSize="38"
          fontWeight={900}
          style={{ fontFamily: "var(--font-noto-sans-jp), 'Noto Sans JP', sans-serif" }}
        >
          終
        </text>
        <text
          x="50"
          y="84"
          textAnchor="middle"
          fill="currentColor"
          stroke="none"
          fontSize="38"
          fontWeight={900}
          style={{ fontFamily: "var(--font-noto-sans-jp), 'Noto Sans JP', sans-serif" }}
        >
          値
        </text>
      </g>
    </svg>
  );
}
