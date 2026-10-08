#!/usr/bin/env node
/** Live screenshots remain immutable. Only a separate overlay is rasterized. */
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync, rmSync, createReadStream } from 'node:fs';
import { resolve, dirname, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import opentype from 'opentype.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FPS = 60, W = 2560, H = 1440;
const SCREEN = { x: 40, y: 130, w: 1888, h: 1180 };
const PINK = '#FA00FF';
const args = process.argv.slice(2);
function arg(key, fallback) { const i = args.indexOf(key); return i < 0 ? fallback : args[i + 1]; }
if (args.includes('--help') || !arg('--input')) {
  console.log(`Usage: node scripts/render-walkthroughs.mjs --input evidence/raw-video/<name> --chapters <chapters.json> [--name <name>] [--preview-only --preview-time <outputSeconds>]\n\nframes.json: {origin,capturedAt,viewport:{width:1600,height:1000,deviceScaleFactor:2},frames:[{t:milliseconds,file:'frame.png'}],durationMs?}\nactions.json: {actions:[{t:milliseconds,kind:'click',box:{x,y,width,height},mousePath:[{t:milliseconds,x,y}]}]}\nchapters.json: {name,title,description,chapters:[{time:sourceSeconds,title,lines:[...],text,action:index,zoom:1.4,targetStart:sourceSeconds,targetEnd:sourceSeconds,annotation:true}],segments:[{start:sourceSeconds,end:sourceSeconds,reason:'explicit omission reason'}],speedups:[{start:sourceSeconds,end:sourceSeconds,speed:4}]}\n\nAll times start at recording zero. No cuts or wait compression are implicit.\nOnly explicit 4× speedups are allowed, with a visible badge and chapter disclosure.\nA live Owarine source, 1600×1000 viewport, lossless 2× PNG frames and 20–60s output are required.\nThe renderer streams overlays to ffmpeg; it never stores a 60fps PNG sequence.`);
  process.exit(args.includes('--help') ? 0 : 1);
}
const input = resolve(arg('--input'));
const spec = JSON.parse(readFileSync(resolve(arg('--chapters', resolve(input, 'chapters.json'))), 'utf8'));
const name = arg('--name', spec.name);
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name ?? '')) throw new Error('Use a lowercase hyphenated clip name.');
const capture = JSON.parse(readFileSync(resolve(input, 'frames.json'), 'utf8'));
const origin = new URL(capture.origin);
if (origin.origin !== 'https://owarine.xyz' || origin.pathname.startsWith('/dev')) throw new Error('Only live https://owarine.xyz recordings are allowed.');
if (!Number.isFinite(Date.parse(capture.capturedAt))) throw new Error('capturedAt must be a real ISO capture date.');
const viewport = capture.viewport ?? { width: 1600, height: 1000, deviceScaleFactor: 2 };
if (viewport.width !== 1600 || viewport.height !== 1000 || (viewport.deviceScaleFactor ?? 2) !== 2) throw new Error('Expected a 1600×1000 viewport at 2× density.');
const frames = capture.frames.map((f) => ({ t: f.t ?? f.timestamp, file: f.file ?? f.path }));
if (frames.length < 2) throw new Error('At least two timestamped live frames are required.');
for (let i = 0; i < frames.length; i++) {
  const f = frames[i], path = resolve(input, f.file);
  if (!Number.isFinite(f.t) || f.t < 0 || (i && f.t < frames[i - 1].t)) throw new Error(`Non-monotonic source frame ${i}.`);
  if (relative(input, path).startsWith('..') || isAbsolute(relative(input, path)) || !existsSync(path)) throw new Error(`Missing or unsafe frame ${i}.`);
  if (!f.file.toLowerCase().endsWith('.png')) throw new Error('Lossless PNG source frames are required.');
}
const firstImage = await sharp(resolve(input, frames[0].file)).metadata();
if (firstImage.width !== 3200 || firstImage.height !== 2000 || firstImage.format !== 'png') throw new Error('Source frames must be 3200×2000 lossless PNGs.');
const startMs = frames[0].t;
const sourceDuration = ((capture.durationMs ?? frames.at(-1).t) - startMs) / 1000;
if (sourceDuration <= 0) throw new Error('Recording has no elapsed duration.');
const segments = spec.segments ?? [{ start: 0, end: sourceDuration, reason: 'Full recording.' }];
let segmentEnd = 0;
for (const s of segments) {
  if (!Number.isFinite(s.start) || !Number.isFinite(s.end) || s.start < segmentEnd || s.end <= s.start || s.end > sourceDuration || !s.reason) throw new Error('Retained segments need ordered source-second start/end and an explicit editorial reason.');
  segmentEnd = s.end;
}
if (!segments.length) throw new Error('At least one retained source segment is required.');
const excerpt = segments.length !== 1 || segments[0].start !== 0 || segments[0].end !== sourceDuration;
if (excerpt && !/excerpt|edited|cut/i.test(spec.description ?? '')) throw new Error('The description must disclose that this is an edited excerpt when source segments are omitted.');
const speedups = (spec.speedups ?? []).map((s) => ({ start: s.start, end: s.end, speed: s.speed }));
let lastEnd = 0;
for (const s of speedups) {
  if (s.speed !== 4 || !Number.isFinite(s.start) || !Number.isFinite(s.end) || s.start < lastEnd || s.end <= s.start || s.end > sourceDuration) throw new Error('Speedups must be ordered, non-overlapping 4× intervals inside the recording.');
  if (!segments.some((segment) => s.start >= segment.start && s.end <= segment.end)) throw new Error('Each declared speedup must lie inside one retained source segment.');
  lastEnd = s.end;
}
function speedTime(source) { return source - speedups.reduce((sum, s) => sum + Math.max(0, Math.min(source, s.end) - s.start) * .75, 0); }
function realTime(output) {
  let source = output;
  for (const s of speedups) {
    const outStart = speedTime(s.start), outEnd = speedTime(s.end);
    if (output < outStart) break;
    if (output < outEnd) return s.start + (output - outStart) * 4;
    source += (s.end - s.start) * .75;
  }
  return source;
}
function outputTime(source) {
  return segments.reduce((sum, s) => sum + Math.max(0, speedTime(Math.min(Math.max(source, s.start), s.end)) - speedTime(s.start)), 0);
}
function sourceTime(output) {
  let offset = 0;
  for (const s of segments) {
    const length = speedTime(s.end) - speedTime(s.start);
    if (output < offset + length) return realTime(speedTime(s.start) + output - offset);
    offset += length;
  }
  return segments.at(-1).end;
}
const duration = outputTime(sourceDuration);
if (duration < 20 || duration > 60) throw new Error(`Output is ${duration.toFixed(2)}s; the brief requires 20–60s. Keep real waits or declare a 4× interval.`);
const posterTime = spec.posterTime ?? Math.min(.75, duration / 2);
if (!Number.isFinite(posterTime) || posterTime < 0 || posterTime >= duration) throw new Error('posterTime must be an output second inside the video.');
const actionsFile = JSON.parse(readFileSync(resolve(input, 'actions.json'), 'utf8'));
const actions = (Array.isArray(actionsFile) ? actionsFile : actionsFile.actions).map((a) => ({ ...a, t: a.t ?? a.timestamp, box: a.box ?? a.boundingBox }));
const chapters = spec.chapters.map((c, i) => {
  const action = Number.isInteger(c.action) ? actions[c.action] : null;
  const box = action?.box ?? c.box ?? (c.annotation === false ? { x: 0, y: 0, width: viewport.width, height: viewport.height } : null);
  if (!Number.isFinite(c.time) || c.time < 0 || c.time >= sourceDuration || (i && c.time <= spec.chapters[i - 1].time)) throw new Error('Chapters must have increasing source-second times inside the recording.');
  if (!segments.some((s) => c.time >= s.start && c.time < s.end)) throw new Error(`Chapter ${i + 1} starts in an omitted source interval.`);
  if (!c.title || !(c.text ?? c.caption)) throw new Error('Every chapter needs a title and caption text.');
  if (!box || !['x', 'y', 'width', 'height'].every((k) => Number.isFinite(box[k])) || box.width <= 0 || box.height <= 0 || box.x < 0 || box.y < 0 || box.x + box.width > viewport.width + 1 || box.y + box.height > viewport.height + 1) throw new Error(`Chapter ${i + 1} needs a measured on-screen target box. Use its action index.`);
  if ((c.zoom ?? 1) < 1 || (c.zoom ?? 1) > 1.6) throw new Error('Zoom must be between 1 and 1.6.');
  return { ...c, text: c.text ?? c.caption, box, time: outputTime(c.time), sourceTime: c.time, zoom: c.zoom ?? (c.annotation !== false && box.width < 180 && box.height < 100 ? 1.35 : 1) };
});
if (!chapters.length || chapters[0].time !== 0) throw new Error('The first chapter must start at zero.');
for (const s of speedups) {
  for (const [i, c] of chapters.entries()) {
    if (c.sourceTime >= s.end || (chapters[i + 1]?.sourceTime ?? sourceDuration) <= s.start) continue;
    if (!/×\s*4|4\s*×|4x|four times/i.test([c.text, ...(c.lines ?? [])].join(' '))) throw new Error(`Chapter ${i + 1}: every compressed wait must be disclosed as ×4 in its chapter text.`);
  }
}

const outDir = resolve(ROOT, 'public/videos'), scratch = resolve(ROOT, 'evidence/raw-video/.render', name);
mkdirSync(outDir, { recursive: true }); mkdirSync(scratch, { recursive: true }); mkdirSync(resolve(ROOT, 'public/captures'), { recursive: true });
const fonts = {
  title: opentype.loadSync(resolve(ROOT, 'scripts/assets/fonts/Archivo-ExtraCondensed-900.ttf')),
  body: opentype.loadSync(resolve(ROOT, 'scripts/assets/fonts/Inter-Regular.ttf')),
};
const xml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
const textCache = new Map();
function text(value, x, y, size = 28, fill = '#000', title = false) {
  const key = JSON.stringify([value, x, y, size, fill, title]);
  if (!textCache.has(key)) textCache.set(key, `<path d="${fonts[title ? 'title' : 'body'].getPath(String(value), x, y, size).toPathData(2)}" fill="${fill}"/>`);
  return textCache.get(key);
}
function wrap(value, width, size, title = false) {
  const font = fonts[title ? 'title' : 'body'], lines = []; let line = '';
  for (const word of String(value).split(/\s+/)) {
    const next = `${line}${line ? ' ' : ''}${word}`;
    if (line && font.getAdvanceWidth(next, size) > width) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line); return lines;
}
for (const [index, c] of chapters.entries()) {
  const lines = c.lines ?? wrap(c.text, 480, 31);
  if (lines.length > 3 || lines.some((line) => fonts.body.getAdvanceWidth(line, 31) > 500)) throw new Error(`Chapter ${index + 1}: use two or three short panel lines that fit 500 pixels.`);
}
const brandSource = readFileSync(resolve(ROOT, 'components/brand.tsx'), 'utf8');
const seal = brandSource.match(/<g transform="rotate\(-6 50 50\)"[\s\S]*?<\/g>/)?.[0].replaceAll('fillRule=', 'fill-rule=');
if (!seal) throw new Error('Could not read the real Owarine seal.');
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const smooth = (v) => { const x = clamp(v, 0, 1); return x * x * (3 - 2 * x); };
function geometry(c, t, end) {
  const ramp = Math.min(.5, (end - c.time) / 3);
  const ease = smooth((t - c.time) / ramp) * smooth((end - t - 1 / FPS) / ramp);
  const z = 1 + (c.zoom - 1) * ease;
  const cx = c.box.x + c.box.width / 2, cy = c.box.y + c.box.height / 2;
  const cropX = clamp(cx - viewport.width / (2 * z), 0, viewport.width - viewport.width / z);
  const cropY = clamp(cy - viewport.height / (2 * z), 0, viewport.height - viewport.height / z);
  return { z, cropX, cropY, point: (x, y) => ({ x: SCREEN.x + (x - cropX) * SCREEN.w / viewport.width * z, y: SCREEN.y + (y - cropY) * SCREEN.h / viewport.height * z }) };
}
const mousePoints = actions.flatMap((a) => a.mousePath ?? a.path ?? []).filter((p) => Number.isFinite(p.t) && Number.isFinite(p.x) && Number.isFinite(p.y)).sort((a, b) => a.t - b.t);
function cursorPosition(ms) {
  if (!mousePoints.length) return null;
  if (ms < mousePoints[0].t) return null;
  let lo = 0, hi = mousePoints.length - 1;
  while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (mousePoints[mid].t <= ms) lo = mid; else hi = mid - 1; }
  const a = mousePoints[lo], b = mousePoints[lo + 1];
  if (!b || ms <= a.t) return a;
  // A gap between separately recorded paths is a stationary cursor, not an
  // invented slow movement across an idle or server-wait interval.
  if (b.t - a.t > 100) return a;
  const u = clamp((ms - a.t) / (b.t - a.t), 0, 1);
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
}
function overlay(t) {
  const index = Math.max(0, chapters.findLastIndex((c) => c.time <= t)), c = chapters[index], end = chapters[index + 1]?.time ?? duration;
  const g = geometry(c, t, end), tl = g.point(c.box.x, c.box.y), br = g.point(c.box.x + c.box.width, c.box.y + c.box.height);
  const box = { x: tl.x, y: tl.y, w: br.x - tl.x, h: br.y - tl.y };
  // Tail stays inside the recorded viewport; endpoint is on the measured edge.
  const right = box.x + box.w / 2 < SCREEN.x + SCREEN.w / 2;
  const endX = right ? box.x + box.w : box.x, endY = box.y + box.h / 2;
  const tailX = clamp(endX + (right ? 230 : -230), SCREEN.x + 42, SCREEN.x + SCREEN.w - 42);
  const tailY = clamp(endY + (endY < SCREEN.y + SCREEN.h / 2 ? 160 : -160), SCREEN.y + 42, SCREEN.y + SCREEN.h - 42);
  const ctrlX = tailX, ctrlY = endY;
  const path = `M${tailX},${tailY} Q${ctrlX},${ctrlY} ${endX},${endY}`;
  const annotationStart = Math.max(c.time, c.targetStart === undefined ? c.time : outputTime(c.targetStart));
  const draw = clamp((t - annotationStart) / .25, 0, 1);
  // Use pixel dash lengths: librsvg does not consistently implement pathLength.
  let curveLength = 0, previous = { x: tailX, y: tailY };
  for (let i = 1; i <= 32; i++) {
    const u = i / 32, p = { x: (1 - u) ** 2 * tailX + 2 * (1 - u) * u * ctrlX + u ** 2 * endX, y: (1 - u) ** 2 * tailY + 2 * (1 - u) * u * ctrlY + u ** 2 * endY };
    curveLength += Math.hypot(p.x - previous.x, p.y - previous.y); previous = p;
  }
  const arrowAngle = Math.atan2(endY - ctrlY, endX - ctrlX) * 180 / Math.PI;
  const heading = wrap(c.title.toUpperCase(), 500, 74, true);
  const lines = c.lines ?? wrap(c.text, 480, 31);
  if (lines.length > 3) throw new Error(`Chapter ${index + 1}: shorten the panel text to at most three lines.`);
  const source = sourceTime(t), speed = speedups.some((s) => source >= s.start && source < s.end);
  const annotationVisible = c.annotation !== false && (c.targetStart === undefined || source >= c.targetStart) && (c.targetEnd === undefined || source < c.targetEnd);
  const pointer = cursorPosition(source * 1000 + startMs);
  let cursor = '';
  if (pointer) {
    const p = g.point(pointer.x, pointer.y);
    cursor = `<path transform="translate(${p.x} ${p.y})" d="M0 0V35L9 26L16 43L23 40L16 24L29 24Z" fill="#000" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>`;
  }
  const ripples = actions.filter((a) => a.kind === 'click' && source * 1000 + startMs >= a.t && source * 1000 + startMs < a.t + 550).map((a) => {
    const u = (source * 1000 + startMs - a.t) / 550, p = g.point(a.x ?? a.box.x + a.box.width / 2, a.y ?? a.box.y + a.box.height / 2);
    return `<circle cx="${p.x}" cy="${p.y}" r="${12 + u * 38}" fill="${PINK}" fill-opacity="${.12 * (1 - u)}" stroke="${PINK}" stroke-width="3" opacity="${1 - u}"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><clipPath id="screen"><rect x="${SCREEN.x}" y="${SCREEN.y}" width="${SCREEN.w}" height="${SCREEN.h}"/></clipPath><mask id="spot"><rect x="${SCREEN.x}" y="${SCREEN.y}" width="${SCREEN.w}" height="${SCREEN.h}" fill="white"/><rect x="${box.x - 9}" y="${box.y - 9}" width="${box.w + 18}" height="${box.h + 18}" rx="16" fill="black"/></mask></defs>
    <rect width="${W}" height="130" fill="#F2F2F2"/><rect x="1928" width="632" height="1440" fill="#F2F2F2"/><rect y="1310" width="2560" height="130" fill="#F2F2F2"/><rect width="40" height="1440" fill="#F2F2F2"/>
    <g transform="translate(40 20) scale(.85)">${seal}</g>${text('OWARINE', 145, 77, 55, '#000', true)}${text('FIELD GUIDE', 365, 75, 24)}${text(`${origin.hostname}${origin.pathname}`, 800, 75, 24, '#505050')}
    <path d="M1960 130V1310" stroke="#DCDCDC" stroke-width="2"/>
    ${text('DEVNET · TEST FUNDS', 2000, 175, 23, '#505050')}${text(`${String(index + 1).padStart(2, '0')} / ${String(chapters.length).padStart(2, '0')}`, 2000, 275, 66, PINK, true)}
    ${heading.map((line, i) => text(line, 2000, 390 + i * 78, 74, '#000', true)).join('')}
    <path d="M2000 ${440 + (heading.length - 1) * 78}H2500" stroke="#DCDCDC" stroke-width="2"/>
    ${lines.map((line, i) => text(line, 2000, 535 + (heading.length - 1) * 78 + i * 46, 31)).join('')}
    ${text(speed ? '×4 · WAIT COMPRESSED' : g.z > 1.01 ? 'DETAIL VIEW' : 'NORMAL SPEED', 2000, 1110, 29, speed ? '#000' : '#505050', true)}
    ${speed ? '<rect x="2000" y="1140" width="115" height="74" rx="8" fill="#ADFF02"/>' + text('×4', 2021, 1194, 54, '#000', true) : ''}
    ${excerpt ? text('EDITED EXCERPT', 2000, 1230, 25, '#505050', true) : ''}${text(`CAPTURED ${capture.capturedAt.slice(0, 10)}`, 2000, 1270, 21, '#505050')}
    <g clip-path="url(#screen)">${annotationVisible ? `<rect x="${SCREEN.x}" y="${SCREEN.y}" width="${SCREEN.w}" height="${SCREEN.h}" fill="#000" opacity=".12" mask="url(#spot)"/>
    <rect x="${box.x - 4}" y="${box.y - 4}" width="${box.w + 8}" height="${box.h + 8}" rx="12" fill="none" stroke="#fff" stroke-width="12"/><rect x="${box.x - 4}" y="${box.y - 4}" width="${box.w + 8}" height="${box.h + 8}" rx="12" fill="none" stroke="${PINK}" stroke-width="4"/>
    <path d="${path}" stroke="#fff" stroke-width="18" fill="none" stroke-linecap="round" stroke-dasharray="${Math.max(.001, draw * curveLength)} ${curveLength + 1}"/><path d="${path}" stroke="${PINK}" stroke-width="10" fill="none" stroke-linecap="round" stroke-dasharray="${Math.max(.001, draw * curveLength)} ${curveLength + 1}"/>
    ${draw >= .98 ? `<path d="M-26 -17L0 0L-26 17" transform="translate(${endX} ${endY}) rotate(${arrowAngle})" stroke="#fff" stroke-width="18" fill="none" stroke-linejoin="round"/><path d="M-26 -17L0 0L-26 17" transform="translate(${endX} ${endY}) rotate(${arrowAngle})" stroke="${PINK}" stroke-width="10" fill="none" stroke-linejoin="round"/>` : ''}
    <circle cx="${tailX}" cy="${tailY}" r="31" fill="${PINK}" stroke="#fff" stroke-width="4"/>${text(String(index + 1), tailX - (index + 1 > 9 ? 16 : 9), tailY + 12, 34, '#fff', true)}` : ''}</g><g id="cursor" clip-path="url(#screen)">${ripples}${cursor}</g>
    ${chapters.map((ch, i) => { const x = 40 + i * (2480 / chapters.length), width = 2480 / chapters.length - 8; return `<rect x="${x}" y="1350" width="${width}" height="7" rx="3" fill="${i < index ? PINK : '#DCDCDC'}"/>${i === index ? `<rect x="${x}" y="1350" width="${width * clamp((t - c.time) / (end - c.time), 0, 1)}" height="7" rx="3" fill="${PINK}"/>` : ''}`; }).join('')}
    ${text(spec.title, 40, 1403, 24)}${text(`${index + 1} · ${c.title}`, 1700, 1403, 24, '#505050')}
  </svg>`;
}

function run(command, argv) {
  const result = spawnSync(command, argv, { encoding: 'utf8', maxBuffer: 12 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${command}: ${result.stderr || result.error?.message}`);
  return result.stdout;
}
const panelCache = new Map();
async function rasterOverlay(t) {
  const svg = overlay(t);
  // Font outlines are expensive to rasterize. Cache the unchanged chapter
  // panels in memory and rasterize only sparse annotation geometry each frame.
  const chapterIndex = Math.max(0, chapters.findLastIndex((c) => c.time <= t)), chapter = chapters[chapterIndex];
  const end = chapters[chapterIndex + 1]?.time ?? duration;
  const transient = t - chapter.time < .55 || end - t < .55;
  const dynamicPattern = transient
    ? /<g (?:id="cursor" )?clip-path="url\(#screen\)">[\s\S]*?<\/g>|<rect[^>]*y="1350"[^>]*\/>/g
    : /<g id="cursor" clip-path="url\(#screen\)">[\s\S]*?<\/g>|<rect[^>]*y="1350"[^>]*\/>/g;
  const defs = svg.match(/<defs>[\s\S]*?<\/defs>/)?.[0] ?? '';
  const dynamic = svg.match(dynamicPattern)?.join('') ?? '';
  const panel = (transient ? svg.replace(/<defs>[\s\S]*?<\/defs>/, '') : svg).replace(dynamicPattern, '');
  let raw = panelCache.get(panel);
  if (!raw) {
    raw = await sharp(Buffer.from(panel)).ensureAlpha().raw().toBuffer();
    // Keep memory bounded across many chapters and distinct speed badges.
    if (panelCache.size >= 3) panelCache.delete(panelCache.keys().next().value);
    panelCache.set(panel, raw);
  }
  const moving = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${defs}${dynamic}</svg>`);
  return sharp(raw, { raw: { width: W, height: H, channels: 4 } }).composite([{ input: moving }]).raw().toBuffer();
}
function stamp(seconds) {
  const ms = Math.round(seconds * 1000);
  return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`;
}
const quote = (s) => s.replaceAll("'", "'\\''");
const list = resolve(scratch, 'source.ffconcat');
const entries = [];
for (let i = 0; i < frames.length; i++) {
  const t = (frames[i].t - startMs) / 1000, next = i + 1 < frames.length ? (frames[i + 1].t - startMs) / 1000 : sourceDuration;
  if (next <= t) continue;
  // Split only at declared speed boundaries. This leaves all recorded elapsed
  // time intact, including identical screenshots and slow frame delivery.
  const boundaries = [...new Set([t, ...[...speedups, ...segments].flatMap((s) => [s.start, s.end]).filter((at) => at > t && at < next), next])].sort((a, b) => a - b);
  for (let j = 0; j + 1 < boundaries.length; j++) {
    if (!segments.some((s) => boundaries[j] >= s.start && boundaries[j + 1] <= s.end)) continue;
    entries.push(`file '${quote(resolve(input, frames[i].file))}'\noption framerate 1000\nduration ${(outputTime(boundaries[j + 1]) - outputTime(boundaries[j])).toFixed(9)}`);
  }
}
const finalSourceFrame = frames.findLast((f) => (f.t - startMs) / 1000 < segments.at(-1).end) ?? frames[0];
entries.push(`file '${quote(resolve(input, finalSourceFrame.file))}'\noption framerate 1000`);
writeFileSync(list, `ffconcat version 1.0\n${entries.join('\n')}\n`);
const smoothExpr = (v) => `(pow(clip(${v},0,1),2)*(3-2*clip(${v},0,1)))`;
const zoomTerms = chapters.map((c, i) => {
  const end = chapters[i + 1]?.time ?? duration, ramp = Math.min(.5, (end - c.time) / 3);
  return { c, end, z: `(1+${c.zoom - 1}*${smoothExpr(`(on/${FPS}-${c.time})/${ramp}`)}*${smoothExpr(`(${end}-on/${FPS}-1/${FPS})/${ramp}`)})` };
});
function expression(fn, fallback = '1') { return zoomTerms.reduceRight((rest, { c, end, z }) => `if(between(on/${FPS},${c.time},${end}),${fn(c, z)},${rest})`, fallback); }
const z = expression((_c, zoom) => zoom);
const cropX = expression((c, zoom) => `clip(${(c.box.x + c.box.width / 2) * 2}-iw/(2*${zoom}),0,iw-iw/${zoom})`, '0');
const cropY = expression((c, zoom) => `clip(${(c.box.y + c.box.height / 2) * 2}-ih/(2*${zoom}),0,ih-ih/${zoom})`, '0');
// Convert the sparse source before CFR duplication. Keep all downstream video
// operations planar YUV; an RGBA base would force a full RGB conversion at 60fps.
const screenFilter = chapters.every((c) => c.zoom === 1)
  ? `format=yuv420p,scale=${SCREEN.w}:${SCREEN.h}:flags=lanczos,fps=${FPS}:round=down`
  : `format=yuv420p,fps=${FPS}:round=down,zoompan=z='${z}':x='${cropX}':y='${cropY}':d=1:s=${SCREEN.w}x${SCREEN.h}:fps=${FPS}`;
const filter = `[0:v]${screenFilter},pad=${W}:${H}:${SCREEN.x}:${SCREEN.y}:color=0xF2F2F2,setsar=1[base];[1:v]format=yuva420p[annotations];[base][annotations]overlay=0:0:format=yuv420[out]`;
if (args.includes('--benchmark-overlays')) {
  const started = performance.now();
  for (let i = 0; i < 60; i++) await rasterOverlay(i / FPS);
  console.log(`Overlay rasterization: ${(60000 / (performance.now() - started)).toFixed(1)}fps`); process.exit(0);
}
if (args.includes('--preview-only')) {
  // A real captured source frame, with the same independent overlay used in
  // the video. Useful for reviewing typography and target geometry quickly.
  const at = clamp(Number(arg('--preview-time', Math.min(.75, duration / 2))), 0, duration - 1 / FPS), c = chapters.findLast((c) => c.time <= at), index = chapters.indexOf(c), g = geometry(c, at, chapters[index + 1]?.time ?? duration);
  const sourceAt = sourceTime(at), f = frames.findLast((f) => (f.t - startMs) / 1000 <= sourceAt) ?? frames[0];
  const left = Math.round(g.cropX * 2), top = Math.round(g.cropY * 2);
  const image = await sharp(resolve(input, f.file)).extract({ left, top, width: Math.min(3200 - left, Math.round(3200 / g.z)), height: Math.min(2000 - top, Math.round(2000 / g.z)) }).resize(SCREEN.w, SCREEN.h).png().toBuffer();
  await sharp({ create: { width: W, height: H, channels: 4, background: '#F2F2F2' } }).composite([{ input: image, left: SCREEN.x, top: SCREEN.y }, { input: Buffer.from(overlay(at)) }]).jpeg({ quality: 90 }).toFile(resolve(scratch, 'preview.jpg'));
  console.log(resolve(scratch, 'preview.jpg')); process.exit(0);
}
const pending = resolve(scratch, 'rendering.mp4'), final = resolve(outDir, `${name}.mp4`);
console.log(`Rendering ${name}: ${frames.length} lossless source frames, ${sourceDuration.toFixed(2)}s → ${duration.toFixed(2)}s; 2560×1440 / 60fps / H.264 High / CRF16 slow.`);
const ffmpeg = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-filter_complex_threads', '1', '-f', 'concat', '-safe', '0', '-i', list, '-f', 'rawvideo', '-pixel_format', 'rgba', '-video_size', `${W}x${H}`, '-framerate', String(FPS), '-i', 'pipe:0', '-filter_complex', filter, '-map', '[out]', '-frames:v', String(Math.ceil(duration * FPS)), '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-movflags', '+faststart', '-an', '-threads', '6', pending], { stdio: ['pipe', 'ignore', 'pipe'] });
let errors = '', pipeError;
ffmpeg.stderr.on('data', (b) => { errors = (errors + b.toString()).slice(-20000); });
ffmpeg.stdin.on('error', (e) => { pipeError = e; });
const finished = new Promise((resolveExit) => ffmpeg.on('close', (code) => resolveExit(code)));
try {
  let lastProgress = Date.now();
  for (let i = 0; i < Math.ceil(duration * FPS); i++) {
    if (pipeError) throw pipeError;
    const png = await rasterOverlay(i / FPS);
    if (!ffmpeg.stdin.write(png)) await Promise.race([once(ffmpeg.stdin, 'drain'), finished.then(() => { throw new Error(errors || 'ffmpeg closed early'); })]);
    if (Date.now() - lastProgress > 20000) { console.log(`${name}: overlays ${Math.round(i / (duration * FPS) * 100)}%`); lastProgress = Date.now(); }
  }
  ffmpeg.stdin.end();
  if (await finished !== 0) throw new Error(errors || 'ffmpeg failed.');
} catch (error) { ffmpeg.kill('SIGTERM'); rmSync(pending, { force: true }); throw new Error(`${error.message}\n${errors}`); }
const probe = JSON.parse(run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,codec_name,profile,pix_fmt,r_frame_rate,avg_frame_rate,nb_frames:format=duration,size', '-of', 'json', pending]));
const stream = probe.streams[0];
if (stream.width !== W || stream.height !== H || stream.codec_name !== 'h264' || stream.profile !== 'High' || stream.pix_fmt !== 'yuv420p' || stream.r_frame_rate !== '60/1' || Math.abs(Number(probe.format.duration) - duration) > .04) throw new Error('Encoded output failed the required video quality checks.');
renameSync(pending, final);
const poster = resolve(ROOT, 'public/captures', `${name}-poster.jpg`);
run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(posterTime), '-i', final, '-frames:v', '1', resolve(scratch, 'poster.png')]);
await sharp(resolve(scratch, 'poster.png')).jpeg({ quality: 90 }).toFile(poster);
rmSync(resolve(scratch, 'poster.png'), { force: true });
const publicChapters = chapters.map(({ time, title, text }) => ({ time: Number(time.toFixed(3)), title, text }));
writeFileSync(resolve(outDir, `${name}.vtt`), `WEBVTT\n\n${publicChapters.map((c, i) => `${i + 1}\n${stamp(c.time)} --> ${stamp(publicChapters[i + 1]?.time ?? duration)}\n${c.text}\n`).join('\n')}`);
async function hash(path) { const h = createHash('sha256'); for await (const chunk of createReadStream(path)) h.update(chunk); return h.digest('hex'); }
async function updateJsonAtomic(path, update) {
  const lock = `${path}.lock`, pendingJson = `${path}.${process.pid}.tmp`;
  let acquired = false;
  for (let attempt = 0; attempt < 150; attempt++) {
    try { mkdirSync(lock); acquired = true; break; }
    catch (error) { if (error.code !== 'EEXIST') throw error; await new Promise((r) => setTimeout(r, 20)); }
  }
  if (!acquired) throw new Error(`Could not acquire registry lock: ${lock}`);
  try {
    const current = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
    update(current);
    writeFileSync(pendingJson, `${JSON.stringify(current, null, 2)}\n`);
    renameSync(pendingJson, path);
  } finally { rmSync(pendingJson, { force: true }); rmSync(lock, { recursive: true, force: true }); }
}
const metadata = { origin: origin.href, capturedAt: capture.capturedAt, sourceFrameCount: frames.length, sourceDurationSeconds: sourceDuration, outputDurationSeconds: Number(probe.format.duration), viewport, sourcePixels: { width: firstImage.width, height: firstImage.height, format: 'lossless PNG', modified: false }, timing: (excerpt ? 'Edited excerpt; only the listed source segments are retained in chronological order, with hard cuts. ' : '') + (speedups.length ? 'Source timestamps resampled to constant 60fps. Only declared waits run at a visible ×4; all other time is preserved.' : excerpt ? 'Retained source intervals run at normal speed, resampled by source timestamps to constant 60fps; pauses inside those intervals remain.' : 'Full recording at normal speed, resampled by source timestamps to constant 60fps. No waits removed.'), edits: 'Separate Owarine frame, captions, measured target arrows and spotlight, recorded cursor and click ripples; eased detail zoom returns to full view. Original source frames unchanged. Annotations stop when a control disappears; waiting chapters may omit the target rather than point at empty pixels.', speedups, segments, omittedIntervals: (() => { const gaps = []; let previous = 0; for (const s of segments) { if (s.start > previous) gaps.push({ start: previous, end: s.start, reason: s.reason }); previous = s.end; } if (previous < sourceDuration) gaps.push({ start: previous, end: sourceDuration, reason: 'End of recording excluded; see retained segment reasons.' }); return gaps; })(), chapters: publicChapters, sourceManifests: { framesSha256: await hash(resolve(input, 'frames.json')), actionsSha256: await hash(resolve(input, 'actions.json')) }, annotations: chapters.map((c, i) => ({ chapter: i + 1, action: c.action, sourceTime: c.sourceTime, targetBox: c.box, visible: c.annotation !== false, sourceStart: c.targetStart, sourceEnd: c.targetEnd, zoom: c.zoom, arrowDrawSeconds: .25, arrowStrokePixels: 10, haloPixels: 4 })), video: stream, encoding: { crf: 16, preset: 'slow', faststart: true }, sha256: { video: await hash(final), poster: await hash(poster), captions: await hash(resolve(outDir, `${name}.vtt`)) } };
writeFileSync(resolve(outDir, `${name}.json`), `${JSON.stringify(metadata, null, 2)}\n`);
const registryPath = resolve(ROOT, 'lib/walkthroughs.generated.json');
await updateJsonAtomic(registryPath, (registry) => {
  registry[name] = { title: spec.title, description: spec.description, duration: Number(probe.format.duration), capturedAt: capture.capturedAt, origin: origin.href, poster: `/captures/${name}-poster.jpg`, chapters: publicChapters, sources: [{ src: `/videos/${name}.mp4`, type: 'video/mp4' }], captions: `/videos/${name}.vtt`, metadata: `/videos/${name}.json` };
});
const review = resolve(ROOT, 'evidence/media-review-videos.json');
const metadataSha256 = await hash(resolve(outDir, `${name}.json`));
await updateJsonAtomic(review, (reviews) => {
  reviews[name] = { reviewed: false, reviewRequired: 'Inspect the final video at actual playback scale before publishing.', ...metadata.sha256, metadata: metadataSha256, description: spec.description, origin: origin.href, capturedAt: capture.capturedAt };
});
console.log(`Saved ${final} (${(Number(probe.format.size) / 1048576).toFixed(1)}MiB), captions, provenance, poster and registry entry. Visual review still required.`);
