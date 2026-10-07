"use client";

import qrcode from "qrcode-generator";

/**
 * The share card as a PNG (Tradash's 1600×1000 share image; ours is UGLYCASH's keychain charm on the sky): the call,
 * the result (PnL, ROI or both), entry and exit or mark price, the 終値 seal and the link with its QR. Drawn on a canvas
 * from the theme tokens and the page's own fonts; nothing leaves the browser.
 */
export interface CharmCard {
  call: string;
  result: string;
  win: boolean;
  entry: string | null;
  exit: string | null;
  exitLabel: "Mark" | "Exit";
  url: string;
}

const W = 1600;
const H = 1000;
/** A canvas font for the 1600×1000 card: weight, size in card pixels, family. */
const font = (weight: number, size: number, family: string) => `${weight} ${size}px ${family}`;

function tokens() {
  const cs = getComputedStyle(document.body);
  const v = (n: string, fallback: string) => cs.getPropertyValue(n).trim() || fallback;
  return {
    display: v("--ow-font-display", "system-ui"),
    body: v("--ow-font-body", "system-ui"),
    jp: v("--ow-font-jp", "sans-serif"),
    sky: v("--ow-sky", "deepskyblue"),
    skyDeep: v("--ow-sky-deep", "steelblue"),
    cream: v("--ow-cream", "beige"),
    chain: v("--ow-chain", "silver"),
    win: v("--ow-win", "green"),
    lose: v("--ow-lose", "red"),
    pink: v("--ow-pink", "magenta"),
    black: v("--ow-black", "black"),
    white: v("--ow-white", "white"),
  };
}

function fit(ctx: CanvasRenderingContext2D, text: string, font: (px: number) => string, maxW: number, start: number): number {
  let px = start;
  ctx.font = font(px);
  while (px > 24 && ctx.measureText(text).width > maxW) ctx.font = font((px -= 4));
  return px;
}

function qr(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fg: string, bg: string): void {
  const q = qrcode(0, "M");
  q.addData(text);
  q.make();
  const n = q.getModuleCount();
  const cell = size / (n + 2);
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = fg;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) ctx.fillRect(x + (c + 1) * cell, y + (r + 1) * cell, Math.ceil(cell), Math.ceil(cell));
}

export async function renderCharmPng(card: CharmCard): Promise<Blob> {
  await document.fonts.ready;
  const t = tokens();
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // The sky.
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, t.skyDeep);
  sky.addColorStop(0.45, t.sky);
  sky.addColorStop(1, t.white);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // The ring and its chain, then the tilted charm.
  const cx = 560;
  ctx.strokeStyle = t.chain;
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.arc(cx, 120, 46, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = t.chain;
  ctx.beginPath();
  ctx.roundRect(cx - 9, 160, 18, 70, 9);
  ctx.fill();
  ctx.save();
  ctx.translate(cx, 560);
  ctx.rotate((-3 * Math.PI) / 180);
  const cw = 820;
  const ch = 640;
  ctx.fillStyle = t.white;
  ctx.beginPath();
  ctx.roundRect(-cw / 2 - 8, -ch / 2 - 8, cw + 16, ch + 16, 76);
  ctx.fill();
  ctx.fillStyle = t.cream;
  ctx.beginPath();
  ctx.roundRect(-cw / 2, -ch / 2, cw, ch, 70);
  ctx.fill();
  ctx.fillStyle = t.sky;
  ctx.beginPath();
  ctx.arc(0, -ch / 2 + 44, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  const left = -cw / 2 + 60;
  ctx.fillStyle = t.black;
  fit(ctx, card.call.toUpperCase(), (px) => font(900, px, t.display), cw - 120, 96);
  ctx.fillText(card.call.toUpperCase(), left, -ch / 2 + 190);
  ctx.fillStyle = card.win ? t.win : t.lose;
  fit(ctx, card.result, (px) => font(900, px, t.display), cw - 120, 200);
  ctx.fillText(card.result, left, -ch / 2 + 400);
  ctx.fillStyle = t.black;
  ctx.globalAlpha = 0.65;
  ctx.font = font(600, 36, t.body);
  if (card.entry) ctx.fillText(`Entry ${card.entry}`, left, -ch / 2 + 490);
  if (card.exit) ctx.fillText(`${card.exitLabel} ${card.exit}`, left, -ch / 2 + 540);
  ctx.globalAlpha = 1;
  ctx.font = font(900, 120, t.jp);
  ctx.textAlign = "right";
  ctx.fillText("終値", cw / 2 - 50, ch / 2 - 50);
  ctx.restore();

  // The brand and the way in.
  ctx.textAlign = "left";
  ctx.fillStyle = t.black;
  ctx.font = font(900, 88, t.display);
  ctx.fillText("OWARINE", 1080, 560);
  ctx.font = font(600, 34, t.body);
  ctx.fillText("Call the close.", 1080, 612);
  ctx.fillText("Nobody sees your bets.", 1080, 654);
  ctx.globalAlpha = 0.7;
  fit(ctx, card.url.replace(/^https?:\/\//, ""), (px) => font(600, px, t.body), W - 1080 - 40, 30);
  ctx.fillText(card.url.replace(/^https?:\/\//, ""), 1080, 702);
  ctx.globalAlpha = 1;
  qr(ctx, card.url, 1080, 732, 210, t.black, t.white);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG render failed"))), "image/png"));
}

/** Saves the PNG: the system share sheet where the browser can share files, else a download. */
export async function saveCharm(blob: Blob, filename: string): Promise<"shared" | "downloaded"> {
  const file = new File([blob], filename, { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.canShare?.({ files: [file] }) && /iPhone|iPad|Android/.test(navigator.userAgent)) {
    try {
      await navigator.share({ files: [file] });
      return "shared";
    } catch {
      // Cancelled or refused: fall back to a download.
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5_000);
  return "downloaded";
}
