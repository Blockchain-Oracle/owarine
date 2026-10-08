#!/usr/bin/env node
/** Publish lossless hosted-product PNGs without transforming their source pixels. */
import { copyFileSync, existsSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rawDir = resolve(root, 'evidence/raw-captures');
const output = resolve(root, 'public/captures');
const catalogFile = resolve(rawDir, 'catalog.json');
if (!existsSync(catalogFile)) throw new Error('Write evidence/raw-captures/catalog.json before publishing captures.');
const catalog = JSON.parse(readFileSync(catalogFile, 'utf8'));
const entries = Array.isArray(catalog) ? catalog : catalog.captures;
if (!Array.isArray(entries) || entries.length === 0) throw new Error('The capture catalog must contain at least one live capture.');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const names = new Set();
const files = new Set();
const captures = entries.map(entry => {
  if (!/^[A-Za-z]\w*$/.test(entry.name) || names.has(entry.name)) throw new Error(`Invalid or duplicate capture name: ${entry.name}`);
  names.add(entry.name);
  for (const field of ['raw', 'title', 'alt', 'state', 'origin']) if (typeof entry[field] !== 'string' || !entry[field].trim()) throw new Error(`${entry.name}: missing ${field}`);
  const origin = new URL(entry.origin);
  if (origin.origin !== 'https://owarine.xyz' || origin.username || origin.password || /^\/dev(?:\/|$)/.test(origin.pathname)) throw new Error(`${entry.name}: capture must come from https://owarine.xyz outside /dev`);
  const rawFile = entry.raw.endsWith('.png') ? entry.raw : `${entry.raw}.png`;
  const source = resolve(rawDir, rawFile);
  if (!source.startsWith(`${rawDir}${sep}`)) throw new Error(`${entry.name}: source must remain inside raw-captures`);
  const bytes = readFileSync(source);
  if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || bytes.subarray(12, 16).toString() !== 'IHDR') throw new Error(`${entry.name}: source is not a PNG`);
  const pixelWidth = bytes.readUInt32BE(16), pixelHeight = bytes.readUInt32BE(20);
  if (pixelWidth % 2 || pixelHeight % 2 || pixelWidth < 2 || pixelHeight < 2) throw new Error(`${entry.name}: source must have even dimensions at 2× density`);
  const width = pixelWidth / 2, height = pixelHeight / 2;
  if (!((width === 1600 && height === 1000) || (width === 390 && height === 844))) throw new Error(`${entry.name}: expected 1600×1000 or 390×844 at 2×, got ${width}×${height}`);
  const annotations = entry.annotations ?? [];
  for (const annotation of annotations) {
    const box = annotation.box, tail = annotation.tail;
    if (!annotation.label || !box || !tail || ![box.x, box.y, box.width, box.height, tail.x, tail.y].every(Number.isFinite) || box.x < 0 || box.y < 0 || box.width <= 0 || box.height <= 0 || box.x + box.width > width || box.y + box.height > height || tail.x < 0 || tail.x > width || tail.y < 0 || tail.y > height) throw new Error(`${entry.name}: annotation outside captured viewport`);
  }
  const sidecarFile = source.replace(/\.png$/, '.json');
  const sidecar = existsSync(sidecarFile) ? JSON.parse(readFileSync(sidecarFile, 'utf8')) : null;
  const capturedAt = entry.capturedAt ?? sidecar?.capturedAt ?? statSync(source).mtime.toISOString();
  if (!Number.isFinite(Date.parse(capturedAt))) throw new Error(`${entry.name}: invalid capture timestamp`);
  const capturedAtSource = entry.capturedAt ? 'capture catalog' : sidecar?.capturedAt ? 'source sidecar' : 'original PNG file modification time';
  const file = `${basename(rawFile, '.png')}-devnet-2026-10-08.png`;
  if (files.has(file)) throw new Error(`Duplicate published file: ${file}`);
  files.add(file);
  return { name: entry.name, title: entry.title, file, alt: entry.alt, state: entry.state, date: new Date(capturedAt).toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }), width, height, annotations, origin: origin.href, capturedAt, capturedAtSource, deviceScaleFactor: 2, pixelWidth, pixelHeight, sha256: hash(bytes), source: rawFile, sourcePixelsModified: false };
});

// Prepare the whole output first. Files are copied byte for byte; annotations stay in the component layer.
for (const capture of captures) copyFileSync(resolve(rawDir, capture.source), resolve(output, capture.file));
const publicFields = ['title', 'file', 'alt', 'state', 'date', 'width', 'height', 'annotations'];
const registry = captures.map(capture => `  ${capture.name}: ${JSON.stringify(Object.fromEntries(publicFields.map(field => [field, capture[field]])))},`).join('\n');
writeFileSync(resolve(root, 'lib/captures.ts'), `export type Annotation = { label: string; box: { x: number; y: number; width: number; height: number }; tail: { x: number; y: number } };\nexport type Capture = { title: string; file: string; alt: string; state: string; date: string; width: number; height: number; annotations: readonly Annotation[] };\n\n/** Generated by scripts/publish-captures.mjs from actual hosted DevNet PNGs. Source pixels are unchanged. */\nexport const captures = {\n${registry}\n} as const satisfies Record<string, Capture>;\n\nexport type CaptureName = keyof typeof captures;\n`);
writeFileSync(resolve(output, 'provenance-devnet-2026-10.json'), `${JSON.stringify({ origin: 'https://owarine.xyz', publishedAt: new Date().toISOString(), captureMethod: 'Isolated browser; lossless PNG at 2× density. Original bytes copied unchanged; numbered arrows are a separate component layer.', captures }, null, 2)}\n`);
for (const file of readdirSync(output)) if (file.endsWith('-canton.jpg') || file === 'provenance-canton-2026-09-30.json' || (file.endsWith('-devnet-2026-10-08.png') && !files.has(file))) unlinkSync(resolve(output, file));
console.log(`Published ${captures.length} hosted captures; lossless PNG hashes and capture times recorded. Removed obsolete sandbox captures and provenance.`);
