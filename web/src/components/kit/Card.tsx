import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** A white card on the ice canvas: radius 16, a hairline only where two cards would otherwise merge, no shadow. */
export function Card({ className, flat, ...props }: ComponentProps<"div"> & { flat?: boolean }) {
  return <div data-slot="card" className={cn("rounded-ow-card bg-ow-card text-ow-ink", !flat && "p-5", className)} {...props} />;
}

const FEATURE_TONES = {
  pink: "bg-ow-pink text-ow-on-pink",
  sky: "bg-ow-sky text-ow-black",
  lime: "bg-ow-lime text-ow-black",
  cream: "bg-ow-cream text-ow-black",
  black: "bg-ow-black text-ow-white",
  white: "bg-ow-card text-ow-ink",
} as const;

export type FeatureTone = keyof typeof FEATURE_TONES;

/**
 * UGLYCASH's feature card: the big rounded (46) slab that carries one idea — the balance, a promo, a club. Coloured
 * tones are fixed in both themes (a sticker stays a sticker in the dark).
 */
export function FeatureCard({ className, tone = "white", ...props }: ComponentProps<"div"> & { tone?: FeatureTone }) {
  return (
    <div data-slot="feature-card" data-tone={tone} className={cn("relative overflow-hidden rounded-ow-feature p-7", FEATURE_TONES[tone], className)} {...props} />
  );
}

/** The small caps-free label UGLYCASH puts above a figure: muted, 14px, never uppercase. */
export function Eyebrow({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("ow-body text-ow-label font-medium text-ow-muted", className)} {...props} />;
}
