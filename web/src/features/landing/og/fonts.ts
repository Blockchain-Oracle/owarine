import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * The preview face. `web/public/fonts` holds only the games' m6x11plus pixel font, and the shell's Sora and Inter come
 * through `next/font/google` as WOFF2, which satori cannot read. The closest workable face is the OFL Sora SemiBold TTF
 * already vendored for the ops reply card (`services/ops/src/actors/x-relay/reply-card-assets`), copied here with its
 * licence so the web build owns its own bytes. Read from disk once per process: no request-time fetch.
 * `process.cwd()` is the Next project directory (`web/`), as the `next/og` docs load fonts.
 */
const SORA_SEMIBOLD = join(process.cwd(), "src/features/landing/og/fonts/Sora-SemiBold.ttf");

/**
 * The revamp's display face for the site card (step 3): Archivo ExtraCondensed Black and the 終値 seal's Noto Sans JP
 * Black subset, both OFL, copied from the phone app's bundle (`mobile/assets/fonts`) as static TTFs satori can read.
 */
const ARCHIVO_XCOND_900 = join(process.cwd(), "src/features/landing/og/fonts/Archivo-ExtraCondensed-900.ttf");
const NOTO_JP_900 = join(process.cwd(), "src/features/landing/og/fonts/NotoSansJP-900-subset.ttf");

let sora: Promise<Buffer> | null = null;
let display: Promise<[Buffer, Buffer]> | null = null;

export async function ogFonts() {
  sora ??= readFile(SORA_SEMIBOLD);
  const data = await sora;
  return [{ name: "Sora", data, style: "normal" as const, weight: 600 as const }];
}

/** Sora for small words, Archivo for the headline, Noto Sans JP for the seal. */
export async function ogDisplayFonts() {
  display ??= Promise.all([readFile(ARCHIVO_XCOND_900), readFile(NOTO_JP_900)]);
  const [archivo, jp] = await display;
  return [...(await ogFonts()), { name: "Archivo", data: archivo, style: "normal" as const, weight: 900 as const }, { name: "NotoJP", data: jp, style: "normal" as const, weight: 900 as const }];
}

/** A Fluent Emoji 3D object (MIT, `og/art/LICENSE`) as a data URI for an `<img>` on a card. */
const art = new Map<string, Promise<string>>();
export function ogArt(name: "old-key" | "locked" | "coin" | "money-with-wings" | "bell"): Promise<string> {
  let p = art.get(name);
  if (!p) {
    p = readFile(join(process.cwd(), `src/features/landing/og/art/${name}.png`)).then((b) => `data:image/png;base64,${b.toString("base64")}`);
    art.set(name, p);
  }
  return p;
}

/** Canton's mark for a light ground, exactly as its brand kit supplies it (K-250), as a data URI for a card. */
let canton: Promise<string> | null = null;
export function ogCantonMark(): Promise<string> {
  canton ??= readFile(join(process.cwd(), "public/brands/canton-on-light.svg")).then((b) => `data:image/svg+xml;base64,${b.toString("base64")}`);
  return canton;
}
