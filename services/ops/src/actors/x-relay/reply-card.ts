import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { X_REFUSAL_TITLES, type XReceiptStatus } from "@owarine/core/x";
import { isSignature } from "@owarine/core/types";
import { NETWORK_LABEL, SITE_HOST } from "./reply-format";

/** Structural subset of ReplyPresentation. All facts come from the receipt formatter. */
export interface ReplyCardInput {
  status: XReceiptStatus;
  title?: string;
  detail?: string;
  context?: string;
  footer?: string;
  sender?: string | null;
  txHash?: string | null;
}

export interface ReplyCardOptions {
  /** Only for review fixtures. Never disguise a fixture as a real receipt. */
  demo?: boolean;
}

export const REPLY_CARD_WIDTH = 1200;
export const REPLY_CARD_HEIGHT = 600;

interface OutlineFont {
  getAdvanceWidth(text: string, size: number, options?: { kerning: boolean }): number;
  getPath(text: string, x: number, y: number, size: number, options?: { kerning: boolean }): { toPathData(places: number): string };
}
const require = createRequire(import.meta.url);
const opentype = require("opentype.js") as { loadSync(file: string): OutlineFont };
// Keep licensed fonts with the actor so the production Docker copy includes them.
const sora = opentype.loadSync(fileURLToPath(new URL("./reply-card-assets/Sora-SemiBold.ttf", import.meta.url)));
const inter = opentype.loadSync(fileURLToPath(new URL("./reply-card-assets/Inter-Regular.ttf", import.meta.url)));
const INK = "#FAFAFA";
const MUTED = "#B4B3AB";
const PINK = "#FA00FF";

const states: Record<XReceiptStatus, { title: string; footer: string }> = {
  filled: { title: "Order filled", footer: "The market result comes later." },
  submitted: { title: "Instruction received", footer: "Execution has not been confirmed." },
  unknown: { title: "Status needs checking", footer: "Check the app before trying again." },
  refused: { title: "Order not confirmed", footer: "This instruction was not confirmed." },
  reverted: { title: "Order reverted", footer: "Nothing was booked and no fee was taken." },
  "nothing-filled": { title: "No fill", footer: "A successful transaction does not guarantee a fill." },
};

function escapeXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function plain(value: unknown, limit: number): string {
  if (typeof value !== "string") return "";
  // Bound work before processing, strip XML-invalid/control and bidi characters,
  // and collapse line breaks so data cannot move itself around the composition.
  const cleaned = value.slice(0, 2048)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF\uFFFE\uFFFF]/g, "")
    .replace(/\s+/g, " ").trim();
  const chars = Array.from(cleaned);
  return chars.length > limit ? `${chars.slice(0, limit - 1).join("")}…` : cleaned;
}

function width(font: OutlineFont, value: string, size: number): number {
  return font.getAdvanceWidth(value, size, { kerning: true });
}

/** Wrap even a single long token and ellipsize without crossing the text column. */
function lines(value: string, font: OutlineFont, size: number, maxWidth: number, maxLines: number): string[] {
  const remaining = Array.from(value);
  const result: string[] = [];
  while (remaining.length > 0 && result.length < maxLines) {
    let end = 0;
    while (end < remaining.length && width(font, remaining.slice(0, end + 1).join(""), size) <= maxWidth) end++;
    if (end === remaining.length) { result.push(remaining.join("").trim()); break; }
    if (result.length === maxLines - 1) {
      let tail = remaining.slice(0, Math.max(1, end));
      while (tail.length && width(font, `${tail.join("").trimEnd()}…`, size) > maxWidth) tail.pop();
      result.push(`${tail.join("").trimEnd()}…`);
      break;
    }
    const space = remaining.slice(0, end).lastIndexOf(" ");
    const split = space > end / 2 ? space : Math.max(1, end);
    result.push(remaining.splice(0, split).join("").trim());
    while (remaining[0] === " ") remaining.shift();
  }
  return result;
}

function text(value: string, x: number, baseline: number, size: number, fill: string, font = inter): string {
  return `<g role="img" aria-label="${escapeXml(value)}"><path d="${font.getPath(value, x, baseline, size, { kerning: true }).toPathData(2)}" fill="${fill}"/></g>`;
}

/** Owarine's mark, the 終値 seal, path for path with `brand/owarine-mark.svg` (100×100; it was Agari's Window Cut until 8 Oct). */
const SEAL_PATHS = [
  "M22 6h56a16 16 0 0 1 16 16v56a16 16 0 0 1-16 16H22A16 16 0 0 1 6 78V22A16 16 0 0 1 22 6Zm0 7a9 9 0 0 0-9 9v56a9 9 0 0 0 9 9h56a9 9 0 0 0 9-9V22a9 9 0 0 0-9-9Z",
  "M52.17 38.41L52.17 38.41L55.21 34.95Q56.61 35.45 58.09 36.15Q59.58 36.85 60.91 37.61Q62.24 38.37 63.19 39.06L63.19 39.06L60.07 42.90Q59.16 42.14 57.83 41.30Q56.50 40.46 55.02 39.70Q53.53 38.94 52.17 38.41ZM48.06 44.95L48.06 44.95L51.22 41.11Q53.04 41.60 54.98 42.27Q56.92 42.93 58.80 43.69Q60.68 44.45 62.37 45.23Q64.06 46.01 65.39 46.73L65.39 46.73L62.20 51.03Q60.53 49.96 58.15 48.82Q55.78 47.68 53.13 46.68Q50.49 45.67 48.06 44.95ZM52.62 14.51L52.62 14.51L57.98 15.42Q56.35 19.15 53.99 22.62Q51.63 26.10 48.10 29.03L48.10 29.03Q47.72 28.46 47.05 27.75Q46.39 27.05 45.69 26.40Q44.98 25.76 44.38 25.42L44.38 25.42Q46.47 23.86 48.06 22.02Q49.66 20.17 50.80 18.25Q51.94 16.33 52.62 14.51ZM51.71 22.60L54.03 17.93L62.96 17.93L62.96 22.60L51.71 22.60ZM61.51 18.84L61.51 17.93L62.54 17.93L63.41 17.74L66.80 19.64Q65.09 23.97 62.29 27.47Q59.50 30.96 56.02 33.49Q52.55 36.02 48.75 37.54L48.75 37.54Q48.44 36.89 47.85 36.06Q47.26 35.22 46.60 34.42Q45.93 33.62 45.40 33.17L45.40 33.17Q49.05 31.91 52.26 29.84Q55.47 27.77 57.88 24.98Q60.30 22.19 61.51 18.84L61.51 18.84ZM49.24 22.91L53.61 21.39Q55.02 23.97 57.30 26.27Q59.58 28.57 62.52 30.34Q65.47 32.10 68.81 33.17L68.81 33.17Q68.24 33.70 67.57 34.50Q66.91 35.30 66.30 36.13Q65.69 36.97 65.31 37.65L65.31 37.65Q61.78 36.25 58.78 34.08Q55.78 31.91 53.38 29.08Q50.99 26.25 49.24 22.91L49.24 22.91ZM37.54 14.55L37.54 14.55L42.29 16.30Q41.49 17.78 40.65 19.36Q39.82 20.93 39.02 22.34Q38.22 23.74 37.50 24.81L37.50 24.81L33.85 23.25Q34.53 22.07 35.22 20.57Q35.90 19.07 36.53 17.49Q37.16 15.92 37.54 14.55ZM41.94 19.15L41.94 19.15L46.39 21.16Q44.98 23.33 43.33 25.68Q41.68 28.04 40.02 30.17Q38.37 32.29 36.89 33.93L36.89 33.93L33.74 32.18Q34.80 30.89 35.94 29.27Q37.08 27.66 38.18 25.91Q39.28 24.16 40.25 22.41Q41.22 20.67 41.94 19.15ZM31.76 24.12L31.76 24.12L34.34 20.32Q35.33 21.16 36.36 22.21Q37.38 23.25 38.26 24.28Q39.13 25.30 39.59 26.18L39.59 26.18L36.78 30.47Q36.36 29.56 35.52 28.44Q34.69 27.32 33.70 26.18Q32.71 25.04 31.76 24.12ZM40.96 28.34L40.96 28.34L44.53 26.86Q45.25 28.15 45.91 29.65Q46.58 31.15 47.07 32.56Q47.57 33.97 47.76 35.11L47.76 35.11L43.92 36.82Q43.77 35.68 43.31 34.21Q42.86 32.75 42.25 31.21Q41.64 29.67 40.96 28.34ZM32.22 35.87L31.76 31.12Q34.46 31.04 38.24 30.89Q42.02 30.74 45.86 30.58L45.86 30.58L45.82 34.92Q42.25 35.18 38.68 35.43Q35.10 35.68 32.22 35.87L32.22 35.87ZM41.68 38.11L41.68 38.11L45.52 36.85Q46.16 38.49 46.83 40.41Q47.49 42.33 47.83 43.77L47.83 43.77L43.81 45.21Q43.54 43.77 42.91 41.77Q42.29 39.78 41.68 38.11ZM33.13 37.20L33.13 37.20L37.65 37.99Q37.42 40.73 36.85 43.43Q36.28 46.13 35.52 47.95L35.52 47.95Q35.07 47.65 34.31 47.27Q33.55 46.89 32.75 46.52Q31.95 46.16 31.38 45.97L31.38 45.97Q32.14 44.30 32.56 41.93Q32.98 39.55 33.13 37.20ZM37.50 50.61L37.50 33.66L42.29 33.66L42.29 50.61L37.50 50.61Z",
  "M45.10 59.41L45.10 54.74L67.52 54.74L67.52 59.41L45.10 59.41ZM46.47 85.94L46.47 81.23L67.71 81.23L67.71 85.94L46.47 85.94ZM54.64 51.55L54.64 51.55L60.15 51.81Q59.99 53.71 59.77 55.77Q59.54 57.82 59.29 59.72Q59.04 61.62 58.78 63.10L58.78 63.10L53.72 63.10Q53.95 61.58 54.12 59.60Q54.29 57.63 54.45 55.54Q54.60 53.45 54.64 51.55ZM60.91 69.71L55.78 69.71L55.78 71.04L60.91 71.04L60.91 69.71ZM60.91 74.65L55.78 74.65L55.78 75.94L60.91 75.94L60.91 74.65ZM60.91 64.81L55.78 64.81L55.78 66.10L60.91 66.10L60.91 64.81ZM50.68 79.82L50.68 60.93L66.23 60.93L66.23 79.82L50.68 79.82ZM43.88 87.61L43.88 63.33L48.97 63.33L48.97 87.61L43.88 87.61ZM39.44 51.66L39.44 51.66L44.64 53.30Q43.43 56.53 41.75 59.83Q40.08 63.14 38.13 66.10Q36.17 69.07 34.08 71.27L34.08 71.27Q33.85 70.59 33.34 69.48Q32.82 68.38 32.23 67.26Q31.65 66.14 31.19 65.46L31.19 65.46Q32.82 63.78 34.36 61.58Q35.90 59.38 37.21 56.83Q38.52 54.28 39.44 51.66ZM35.94 87.57L35.94 62.57L41.18 57.32L41.18 57.36L41.18 87.57L35.94 87.57Z",
];
function mark(x: number, y: number, height: number): string {
  return `<g transform="translate(${x} ${y}) scale(${height / 100}) rotate(-6 50 50)" aria-hidden="true" fill="${PINK}">${SEAL_PATHS.map((d, i) => `<path d="${d}"${i === 0 ? ' fill-rule="evenodd"' : ""}/>`).join("")}</g>`;
}

function receiptArt(status: XReceiptStatus): string {
  const symbol: Record<XReceiptStatus, string> = {
    filled: '<path d="M889 320L915 349L966 287"/>',
    submitted: '<path d="M931 282V320L953 337"/>',
    unknown: '<path d="M914 297C914 276 950 276 950 297C950 311 932 311 932 327M932 347V349"/>',
    refused: '<path d="M910 294L952 342M952 294L910 342"/>',
    reverted: '<path d="M946 287H913L897 305L913 322M898 305H940C969 305 969 347 940 347H921"/>',
    "nothing-filled": '<path d="M905 320H958"/>',
  };
  return `<g aria-hidden="true" transform="rotate(7 970 307)">
<path d="M1093 407C1151 414 1151 465 1114 477H1006V439Z" fill="#AEACA3"/>
<path d="M817 145L828 152L839 145L850 152L861 145L872 152L883 145L894 152L905 145L916 152L927 145L938 152L949 145L960 152L971 145L982 152L993 145L1004 152L1015 145L1026 152L1037 145L1048 152L1059 145L1070 152L1081 145V430Q1081 469 1114 477L839 477Q817 477 817 449Z" fill="#F2F2F2" stroke="#CDCCC7" stroke-width="1.5"/>
${mark(909, 174, 49)}
<path d="M842 245H1054M842 396H1054M842 418H978" stroke="#BCBAB3" stroke-width="1.5"/>
<circle cx="931" cy="320" r="62" stroke="${PINK}" stroke-width="4" fill="none"/>
<g data-symbol="${status}" fill="none" stroke="${PINK}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round">${symbol[status]}</g>
</g>`;
}

/** Render facts as self-contained vector paths, with no font/network dependencies. */
export function renderReplyCardSvg(input: ReplyCardInput, options: ReplyCardOptions = {}): string {
  const status: XReceiptStatus = Object.hasOwn(states, input.status) ? input.status : "unknown";
  const state = states[status];
  // Only fixed refusal titles may refine the status headline. Unknown outcomes
  // must never imply success or that chain confirmation is still pending.
  const title = status === "refused" && Object.values(X_REFUSAL_TITLES).some(title => title === input.title) ? input.title! : state.title;
  const footer = status === "unknown" && input.footer === "Check this transaction before trying again."
    ? input.footer : state.footer;
  const context = plain(input.context, 180) || NETWORK_LABEL;
  const detail = plain(input.detail, 420) || "Open the receipt for details.";
  const sender = typeof input.sender === "string" && /^(@[A-Za-z0-9_]{1,15}|X user \d{1,30})$/.test(input.sender) ? input.sender : null;
  const hash = isSignature(input.txHash) ? input.txHash : null;
  const contextLines = lines(context, inter, 27, 690, 2);
  const detailLines = lines(detail, inter, 22, 690, 2);
  const titleSize = Math.min(72, 690 / width(sora, title, 1));
  const banner = options.demo ? "DEMO · NOT A REAL TRADE" : NETWORK_LABEL.toUpperCase();
  const description = `${banner}. ${sender ? `For ${sender}. ` : ""}${title}. ${contextLines.join(" ")}. ${detailLines.join(" ")}. ${footer}${hash ? ` Transaction ${hash}.` : ""}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 600" width="1200" height="600" role="img" aria-labelledby="reply-title reply-description" data-status="${status}">
<title id="reply-title">${escapeXml(title)} — Owarine</title>
<desc id="reply-description">${escapeXml(description)}</desc>
<rect width="1200" height="600" fill="#0A0A0A"/>
${mark(963, 32, 42)}
${text("Owarine", 1008, 61, 20, INK, sora)}
${sender ? text(`FOR ${sender}`, 64, 104, 19, INK) : ""}
${text("YOUR CALL HAS A RECEIPT", 64, 146, 16, PINK)}
${text(title, 60, 235, titleSize, INK, sora)}
${contextLines.map((line, i) => text(line, 64, 298 + i * 33, 27, INK)).join("\n")}
${detailLines.map((line, i) => text(line, 64, 372 + i * 29, 22, MUTED)).join("\n")}
${text(footer, 64, 444, 20, MUTED)}
${hash ? text(`TX ${hash}`, 64, 491, Math.min(15, 690 / width(inter, `TX ${hash}`, 1)), MUTED) : ""}
${receiptArt(status)}
<path d="M64 523H1136" stroke="#363530"/>
${text(`${SITE_HOST} · Receipt details in the reply`, 64, 563, 15, MUTED)}
${text(banner, 1136 - width(inter, banner, 15), 563, 15, PINK)}
</svg>`;
}

/** Return a deterministic PNG ready for a separately authorized media uploader. */
export async function renderReplyCardPng(input: ReplyCardInput, options: ReplyCardOptions = {}): Promise<Buffer> {
  return sharp(Buffer.from(renderReplyCardSvg(input, options))).png({ compressionLevel: 9 }).toBuffer();
}
