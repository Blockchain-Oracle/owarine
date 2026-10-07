/**
 * The link-preview canvas (L-23, Y-14). Satori reads no stylesheet and no CSS variables, so Masayume's dark tokens
 * (`styles/yosuku/part-01.css`) are restated here as rgb strings, one per token the images use. Previews always render
 * the dark ground: a link card has no theme toggle.
 */
export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = "image/png";

export const OG = {
  /** `--bg` */
  ground: "rgb(10, 10, 10)",
  /** `--white` */
  ink: "rgb(255, 255, 255)",
  /** `--gray-400` */
  soft: "rgb(161, 159, 150)",
  /** `--gray-500` */
  dim: "rgb(118, 116, 108)",
  /** `--gray-800` */
  hairline: "rgb(38, 37, 37)",
  /** `.crop` corner marks (part-04). */
  crop: "rgba(255, 255, 255, 0.18)",
  /** `.mark-ring` (icons.css): Apple's near-black disc on the dark ground. */
  ring: "rgba(255, 255, 255, 0.22)",
  /** `--signal` */
  signal: "rgb(250, 0, 255)",
  /** `--color-profit` (dark) */
  up: "rgb(61, 220, 90)",
  /** `--color-loss` (dark) */
  down: "rgb(255, 90, 82)",
} as const;

/** The canvas inset every image shares. */
export const OG_PAD = 72;
