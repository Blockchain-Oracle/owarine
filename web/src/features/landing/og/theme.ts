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

/** The landing's sky (`--ow-sky-gradient`) and its ink, for the site card (revamp step 3). */
export const OG_SKY = {
  gradient: "linear-gradient(180deg, rgb(2, 166, 240) 0%, rgb(2, 187, 255) 38%, rgb(127, 217, 255) 78%, rgb(217, 243, 255) 100%)",
  ink: "rgb(0, 0, 0)",
  white: "rgb(255, 255, 255)",
  pink: "rgb(250, 0, 255)",
  lime: "rgb(173, 255, 2)",
} as const;
