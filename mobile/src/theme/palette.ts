/**
 * The palette as web ships it (web/src/styles/yosuku/part-01.css dark, part-13.css light, and the K-403 kit tokens in
 * web/src/styles/owarine.css): UGLYCASH's ice canvas, white cards, black ink and Power Pink as the one action fill.
 * Every role below resolves per theme exactly as web does. React Native has no color-mix(): washes are precomputed.
 */
function rgba(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

const DARK_RAMP = {
  bg: "#0A0A0A", ink: "#FFFFFF",
  g400: "#A3A3A3", g500: "#7A7A7A", g600: "#575757", g700: "#3A3A3A", g800: "#262626", g900: "#171717",
  signal: "#FA00FF", signalD: "#D600DB", profit: "#3DDC5A", loss: "#FF5A52",
};

const LIGHT_RAMP = {
  bg: "#F2F2F2", ink: "#000000",
  g400: "#5E5E5E", g500: "#7A7A7A", g600: "#888888", g700: "#DCDCDC", g800: "#E8E8E8", g900: "#FFFFFF",
  signal: "#FA00FF", signalD: "#D600DB", profit: "#078A2E", loss: "#D21F1F",
};

function roles(ramp: typeof DARK_RAMP, dark: boolean) {
  return {
    ground: ramp.bg,
    surface1: ramp.g900,
    surface2: dark ? ramp.g800 : "#E8E8E8",
    surface3: dark ? ramp.g700 : "#FFFFFF",
    hairline: dark ? "rgba(255, 255, 255, 0.1)" : "rgba(10, 10, 10, 0.12)",
    borderStrong: dark ? "rgba(255, 255, 255, 0.22)" : "rgba(10, 10, 10, 0.22)",
    ink: ramp.ink,
    inkSecondary: ramp.g400,
    inkMuted: ramp.g500,
    inkDisabled: ramp.g600,
    /** Pink as ink (text, lines, icons): lightened on the dark canvas, darkened on the ice one (K-403). */
    accent: dark ? "#FF6BFF" : "#B000B5",
    /** Signal as a fill: the primary action, the live state, the call that came in. Text on it is `onAccent`. */
    accentFill: ramp.signal,
    /** The mark's signal tile, the same in both themes. */
    brandMarkAccent: "#FA00FF",
    accentPressed: ramp.signalD,
    accentDim: rgba(ramp.signal, 0.45),
    accentWash: rgba(ramp.signal, 0.12),
    onAccent: "#FFFFFF",
    profit: ramp.profit,
    loss: ramp.loss,
    profitWash: rgba(ramp.profit, 0.14),
    lossWash: rgba(ramp.loss, 0.14),
    // The receipt is a ticket stub in muted yellow in both themes (bridge.css --color-cream*).
    cream: "#E7E3BF",
    creamInk: "#0A0A0A",
    creamHairline: "#D6D1A8",
    scrim: "rgba(3, 3, 3, 0.72)",
    /** The receipt's drop shadow: the only shadow in the app (the ticket stub). */
    shadow: "#000000",
    // web's styles/icons.css: the white glyph on a brand disc, and the hairline ring on a near-black disc.
    markGlyph: "#FFFFFF",
    markRing: "rgba(255, 255, 255, 0.22)",
    /** icons.css `.basket-mark`: the pale ground a basket's member cluster sits on. */
    markBasket: dark ? "rgba(255, 255, 255, 0.08)" : "rgba(10, 10, 10, 0.08)",
    markUsdc: "#2775CA",
    warning: "#F2994A",
    info: "#60A5FA",
    /** The K-403 kit (web styles/owarine.css --ow-*), the same names on both surfaces. */
    ow: {
      canvas: ramp.bg,
      card: dark ? "#161616" : "#FFFFFF",
      recessed: dark ? "#222222" : "#E8E8E8",
      hairline: dark ? "#2C2C2C" : "#DCDCDC",
      ink: dark ? "#FFFFFF" : "#000000",
      muted: dark ? "#A3A3A3" : "#5E5E5E",
      helper: dark ? "#7A7A7A" : "#888888",
      inverse: dark ? "#000000" : "#FFFFFF",
      pink: "#FA00FF",
      pinkPressed: "#D600DB",
      pinkInk: dark ? "#FF6BFF" : "#B000B5",
      pinkWash: rgba("#FA00FF", 0.15),
      onPink: "#FFFFFF",
      up: dark ? "#3DDC5A" : "#078A2E",
      upLine: dark ? "#3DDC5A" : "#19C23E",
      down: dark ? "#FF5A52" : "#D21F1F",
      downLine: dark ? "#FF5A52" : "#FF3B30",
      sky: "#02BBFF",
      skyTop: "#02A6F0",
      skyMid: "#7FD9FF",
      skyHorizon: "#D9F3FF",
      lime: "#ADFF02",
      cream: "#E7E3BF",
      black: "#000000",
      white: "#FFFFFF",
      win: "#078A2E",
      lose: "#D21F1F",
      upOnBlack: "#3DDC5A",
      downOnBlack: "#FF6B63",
      chain: "#B9B9B9",
      scrim: dark ? "rgba(0, 0, 0, 0.6)" : "rgba(0, 0, 0, 0.42)",
      whiteDim: "rgba(255, 255, 255, 0.6)",
    },
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
