import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A die-cut sticker: condensed black caps on a bright tone with a white cut line, tilted a few degrees. Used for the
 * claims Owarine makes out loud ("PRIVATE", "3 ORACLES SIGN IT", "PAYS 1.9×") and in privacy mode, where a sticker
 * covers the balance. Sky, lime and cream live only here.
 */
const TONES = {
  sky: "bg-ow-sky text-ow-black",
  lime: "bg-ow-lime text-ow-black",
  pink: "bg-ow-pink text-ow-white",
  cream: "bg-ow-cream text-ow-black",
  black: "bg-ow-black text-ow-white",
  white: "bg-ow-white text-ow-black",
} as const;

export type StickerTone = keyof typeof TONES;

export function Sticker({ tone = "lime", tilt = -4, icon, size = "md", className, children, ...props }: ComponentProps<"span"> & { tone?: StickerTone; tilt?: number; icon?: ReactNode; size?: "sm" | "md" | "lg" }) {
  return (
    <span
      data-slot="sticker"
      className={cn(
        "ow-display inline-flex items-center gap-1.5 rounded-ow-sticker whitespace-nowrap outline-3 outline-ow-white outline-solid",
        size === "sm" && "px-2.5 pt-1.5 pb-1 text-ow-body",
        size === "md" && "px-3.5 pt-2 pb-1.5 text-ow-sticker",
        size === "lg" && "px-5 pt-3 pb-2 text-ow-display",
        TONES[tone],
        className,
      )}
      style={{ rotate: `${tilt}deg` }}
      {...props}
    >
      {icon}
      {children}
    </span>
  );
}
