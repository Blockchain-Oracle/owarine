/**
 * Yosuku's palette as web ships it (web/src/styles/yosuku/part-01.css dark, part-13.css light). The light ramp is
 * inverted there (50 = darkest ink), so every role below resolves per theme exactly as web/src/styles/bridge.css does.
 * React Native has no color-mix(): the washes are the same mixes, precomputed.
 */
function rgba(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

const DARK_RAMP = {
  bg: "#100F0F", ink: "#FFFDF6",
  g400: "#A19F96", g500: "#76746C", g600: "#55544E", g700: "#3B3A37", g800: "#262525", g900: "#171616",
  signal: "#E4E24E", signalD: "#CFCD3F", profit: "#3DD68C", loss: "#FF5C61",
};

const LIGHT_RAMP = {
  bg: "#F5F4EF", ink: "#100F0F",
  g400: "#5C5B55", g500: "#76746C", g600: "#9C9A91", g700: "#D6D4CB", g800: "#ECEBE5", g900: "#FFFFFF",
  signal: "#E4E24E", signalD: "#CFCD3F", profit: "#0E8A57", loss: "#D2343C",
};

function roles(ramp: typeof DARK_RAMP, dark: boolean) {
  return {
    ground: ramp.bg,
    surface1: ramp.g900,
    surface2: dark ? ramp.g800 : "#ECEBE5",
    surface3: dark ? ramp.g700 : "#FFFFFF",
    hairline: dark ? "rgba(255, 255, 255, 0.1)" : "rgba(16, 15, 15, 0.12)",
    borderStrong: dark ? "rgba(255, 255, 255, 0.22)" : "rgba(16, 15, 15, 0.22)",
    ink: ramp.ink,
    inkSecondary: ramp.g400,
    inkMuted: ramp.g500,
    inkDisabled: ramp.g600,
    /** Signal as ink (text, lines, icons): the signal on the dark canvas, ink on paper (K-402). */
    accent: dark ? ramp.signal : ramp.ink,
    /** Signal as a fill: the primary action, the live state, the call that came in. Text on it is `onAccent`. */
    accentFill: ramp.signal,
    /** The mark's signal tile, the same in both themes. */
    brandMarkAccent: "#E4E24E",
    accentPressed: ramp.signalD,
    accentDim: rgba(ramp.signal, 0.45),
    accentWash: rgba(ramp.signal, 0.12),
    onAccent: "#100F0F",
    profit: ramp.profit,
    loss: ramp.loss,
    profitWash: rgba(ramp.profit, 0.14),
    lossWash: rgba(ramp.loss, 0.14),
    // The receipt is a ticket stub in muted yellow in both themes (bridge.css --color-cream*).
    cream: "#FAF9B6",
    creamInk: "#100F0F",
    creamHairline: "#E2E09A",
    scrim: "rgba(3, 3, 3, 0.72)",
    /** The receipt's drop shadow: the only shadow in the app (the ticket stub). */
    shadow: "#000000",
    // web's styles/icons.css: the white glyph on a brand disc, and the hairline ring on a near-black disc.
    markGlyph: "#FFFFFF",
    markRing: "rgba(255, 255, 255, 0.22)",
    /** icons.css `.basket-mark`: the pale ground a basket's member cluster sits on. */
    markBasket: dark ? "rgba(255, 255, 255, 0.08)" : "rgba(16, 15, 15, 0.08)",
    markUsdc: "#2775CA",
    warning: "#F2994A",
    info: "#60A5FA",
  };
}

/** web's account avatar colours (providers/wallet/wallet-modal.css .wm-ava-<n>, RainbowKit's), by index. */
export const AVATAR_COLORS = [
  "#FC5C54", "#FFD95A", "#E95D72", "#6A87C8", "#5FD0F3", "#75C06B", "#FFDD86", "#5FC6D4", "#FF949A", "#FF8024", "#A4A39B", "#EC66FF",
  "#FF8CBC", "#FF9A23", "#C5DADB", "#A8CE63", "#71ABFF", "#FFE279", "#B6B5B1", "#FF6780", "#A575FF", "#4D82FF", "#FFB35A",
] as const;

export type Palette = ReturnType<typeof roles>;
export const DARK: Palette = roles(DARK_RAMP, true);
export const LIGHT: Palette = roles(LIGHT_RAMP, false);
