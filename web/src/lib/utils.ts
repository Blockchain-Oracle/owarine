import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

/**
 * tailwind-merge only knows Tailwind's own font sizes, so it would read the kit's `text-ow-label` as a colour and
 * drop it beside `text-ow-muted`. The kit's type scale (styles/owarine.css, `--text-ow-*`) is registered here.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["ow-micro", "ow-caption", "ow-label", "ow-body", "ow-lead", "ow-cta", "ow-title", "ow-sticker", "ow-heading", "ow-key", "ow-display", "ow-figure", "ow-mask", "ow-hero", "ow-charm"],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
