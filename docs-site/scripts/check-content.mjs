#!/usr/bin/env node
/** Verify the docs' local contract and the Owarine source revision they were reviewed against. */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { legacyRedirects } from '../lib/legacy-redirects.mjs';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// The docs live in the app's own repository at docs-site/, so the app source is the parent directory.
const source = resolve(process.env.OWARINE_SOURCE_DIR || resolve(root, '..'));
const content = resolve(root, 'content/docs');
// One pin: `site.revision` in lib/site.ts is the app commit every page was last checked against.
const pinned = readFileSync(resolve(root, 'lib/site.ts'), 'utf8').match(/revision:\s*'([0-9a-f]{7,40})'/)?.[1] ?? null;
const appPaths = ['web', 'mobile', 'packages', 'services', 'daml'];
const captureSource = readFileSync(resolve(root, 'lib/captures.ts'), 'utf8');
const captureEntries = [...captureSource.matchAll(/^  ([A-Za-z]\w*): (\{.+\}),$/gm)].map(([, name, json]) => [name, JSON.parse(json)]);
const captureNames = new Set(captureEntries.map(([name]) => name));
const captureRegistry = Object.fromEntries(captureEntries);
const walkthroughFile = resolve(root, 'lib/walkthroughs.generated.json');
const walkthroughs = existsSync(walkthroughFile) ? JSON.parse(readFileSync(walkthroughFile, 'utf8')) : {};
const graphs = JSON.parse(readFileSync(resolve(root, 'lib/architecture.json'), 'utf8'));
const failures = [];
const warnings = [];
let pages = 0, links = 0, media = 0, appRoutes = 0;

function fail(message) { failures.push(message); }
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(resolve(dir, entry.name)) : [resolve(dir, entry.name)]);
}
function git(...args) {
  try { return execFileSync('git', ['-C', source, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return null; }
}
function docRoute(path) {
  const route = path.split('#')[0].replace(/\/$/, '') || '/';
  if (route === '/') return resolve(content, 'index.mdx');
  return resolve(content, `${route.slice(1)}.mdx`);
}
/** An app route exists when each segment matches a folder, a literal one first, else a `[param]` one. */
function appRouteExists(path) {
  let dir = resolve(source, 'web/src/app');
  for (const segment of path.split(/[?#]/)[0].split('/').filter(Boolean)) {
    if (existsSync(resolve(dir, segment))) { dir = resolve(dir, segment); continue; }
    const param = readdirSync(dir, { withFileTypes: true }).find(entry => entry.isDirectory() && /^\[[^.\]]+\]$/.test(entry.name));
    if (!param) return false;
    dir = resolve(dir, param.name);
  }
  return existsSync(resolve(dir, 'page.tsx'));
}

if (!pinned) fail('lib/site.ts has no revision to check against');
else if (!existsSync(resolve(source, 'web/src/app'))) fail(`Owarine source missing: ${source}`);
else if (git('cat-file', '-e', `${pinned}^{commit}`) === null) fail(`Pinned revision ${pinned} is not in ${source}'s history`);
else if (git('merge-base', '--is-ancestor', pinned, 'HEAD') === null) fail(`Pinned revision ${pinned} is not an ancestor of HEAD: the docs were reviewed against a different line of history`);
else {
  for (const path of ['packages/core/src/market/baskets.ts', 'packages/core/src/market/print-source.ts', 'packages/core/src/desk/gate.ts', 'daml/abu-pm-main/daml.yaml', 'daml/abu-pm-agents/daml/PM/Agents/Desk.daml', '.github/verification/capabilities.json', 'services/ops/config/price-sources.json']) {
    if (!existsSync(resolve(source, path))) fail(`Source path missing: ${path}`);
  }
  // App changes since the review are a reason to re-read the guides, not a broken build.
  const since = git('log', '--format=%h %s', `${pinned}..HEAD`, '--', ...appPaths)?.split('\n').filter(Boolean) ?? [];
  if (since.length) warnings.push(`${since.length} app commit(s) since the reviewed revision ${pinned}; review them, update the guides, then advance site.revision:`, ...since.slice(0, 15).map(line => `  ${line.slice(0, 120)}`), ...(since.length > 15 ? [`  … and ${since.length - 15} more`] : []));
}

const mdx = files(content).filter(path => path.endsWith('.mdx'));
const redirectSources = new Set();
for (const [from, to] of legacyRedirects) {
  if (redirectSources.has(from)) fail(`Duplicate redirect source: ${from}`);
  redirectSources.add(from);
  if (existsSync(docRoute(from))) fail(`Redirect shadows a docs page: ${from}`);
  if (!existsSync(docRoute(to))) fail(`Redirect destination missing: ${from} → ${to}`);
}
for (const [, to] of legacyRedirects) if (redirectSources.has(to)) fail(`Redirect chain: ${to}`);
for (const path of mdx) {
  pages++;
  const body = readFileSync(path, 'utf8');
  const label = relative(root, path);
  for (const [, route] of body.matchAll(/\]\((\/[^)\s]+)\)/g)) {
    links++;
    if (route.startsWith('/captures/') || route.startsWith('/videos/')) {
      media++;
      if (!existsSync(resolve(root, 'public', route.slice(1)))) fail(`${label}: missing media ${route}`);
    } else if (!existsSync(docRoute(route))) fail(`${label}: missing docs page ${route}`);
  }
  for (const [, route] of body.matchAll(/<AppLink\s+href="(\/[^"]+)"/g)) {
    appRoutes++;
    if (!appRouteExists(route)) fail(`${label}: missing app route ${route}`);
  }
  for (const [, name] of body.matchAll(/<GuideCapture\s+name="([^"]+)"/g)) {
    media++;
    if (!captureNames.has(name)) fail(`${label}: unknown capture ${name}`);
  }
  for (const [, name] of body.matchAll(/<Walkthrough\s+name="([^"]+)"/g)) {
    media++;
    if (!(name in walkthroughs)) fail(`${label}: unknown walkthrough ${name}`);
  }
  for (const [, name] of body.matchAll(/<Architecture\s+name="([^"]+)"/g)) {
    media++;
    if (!(name in graphs)) fail(`${label}: unknown architecture ${name}`);
    else if (!existsSync(resolve(root, 'public/diagrams', `${name}.svg`))) fail(`${label}: missing ${name} diagram`);
  }
}

for (const path of files(content).filter(path => path.endsWith('meta.json'))) {
  const label = relative(root, path);
  let meta;
  try { meta = JSON.parse(readFileSync(path, 'utf8')); }
  catch { fail(`${label}: invalid JSON`); continue; }
  for (const page of meta.pages || []) {
    if (page.startsWith('---')) continue;
    const target = resolve(dirname(path), page);
    if (!existsSync(`${target}.mdx`) && !existsSync(resolve(target, 'meta.json'))) fail(`${label}: missing nav entry ${page}`);
  }
}

// Hosted capture originals and video exports are checked independently of ignored raw evidence.
function readJson(path, label) {
  try { return JSON.parse(readFileSync(path, 'utf8')); }
  catch { fail(`${label}: missing or invalid JSON`); return null; }
}
function sha256(path) { return createHash('sha256').update(readFileSync(path)).digest('hex'); }
function hosted(value) {
  try { const url = new URL(value); return url.origin === 'https://owarine.xyz' && !url.username && !url.password && !/^\/dev(?:\/|$)/.test(url.pathname); }
  catch { return false; }
}
function publicFile(path, prefix, label) {
  if (typeof path !== 'string' || !path.startsWith(prefix) || path.includes('..') || /[?#]/.test(path)) { fail(`${label}: invalid public path ${path}`); return null; }
  const file = resolve(root, 'public', path.slice(1));
  if (!existsSync(file)) { fail(`${label}: missing ${path}`); return null; }
  return file;
}
function inBounds(annotation, width, height) {
  const box = annotation?.box, tail = annotation?.tail;
  return typeof annotation?.label === 'string' && annotation.label.length > 0 && box && tail
    && [box.x, box.y, box.width, box.height, tail.x, tail.y].every(Number.isFinite)
    && box.x >= 0 && box.y >= 0 && box.width > 0 && box.height > 0
    && box.x + box.width <= width && box.y + box.height <= height
    && tail.x >= 0 && tail.y >= 0 && tail.x <= width && tail.y <= height;
}
const provenance = readJson(resolve(root, 'public/captures/provenance-devnet-2026-10.json'), 'Hosted capture provenance');
const published = new Map();
for (const capture of provenance?.captures ?? []) {
  media++;
  const label = `Capture ${capture.name}`;
  if (published.has(capture.name)) fail(`${label}: duplicate provenance entry`);
  published.set(capture.name, capture);
  if (!hosted(capture.origin)) fail(`${label}: must name a hosted Owarine source`);
  if (!Number.isFinite(Date.parse(capture.capturedAt)) || !capture.capturedAtSource) fail(`${label}: missing actual capture time and its source`);
  if (capture.sourcePixelsModified !== false || capture.deviceScaleFactor !== 2) fail(`${label}: original pixels must be unchanged at 2× density`);
  const file = publicFile(`/captures/${capture.file}`, '/captures/', label);
  if (file) {
    if (sha256(file) !== capture.sha256) fail(`${label}: PNG SHA-256 does not match provenance`);
    const image = await sharp(file).metadata();
    if (image.format !== 'png' || image.width !== capture.width * 2 || image.height !== capture.height * 2 || image.width !== capture.pixelWidth || image.height !== capture.pixelHeight) fail(`${label}: PNG dimensions/density do not match provenance`);
  }
  const registry = captureRegistry[capture.name];
  if (!registry) fail(`${label}: missing registry entry`);
  else for (const field of ['title', 'file', 'alt', 'state', 'date', 'width', 'height', 'annotations']) if (JSON.stringify(registry[field]) !== JSON.stringify(capture[field])) fail(`${label}: registry ${field} differs from provenance`);
  if (!Array.isArray(capture.annotations) || capture.annotations.some(annotation => !inBounds(annotation, capture.width, capture.height))) fail(`${label}: annotation is outside its viewport`);
}
for (const [name] of captureEntries) if (!published.has(name)) fail(`Capture ${name}: missing hosted provenance`);
for (const file of readdirSync(resolve(root, 'public/captures'))) if (file.endsWith('-canton.jpg') || file === 'provenance-canton-2026-09-30.json') fail(`Obsolete sandbox capture remains: ${file}`);

for (const [name, movie] of Object.entries(walkthroughs)) {
  media++;
  const label = `Walkthrough ${name}`;
  if (!hosted(movie.origin) || !Number.isFinite(Date.parse(movie.capturedAt))) fail(`${label}: missing hosted capture origin/time`);
  const metadataFile = publicFile(movie.metadata, '/videos/', label);
  const captions = publicFile(movie.captions, '/videos/', label);
  const poster = publicFile(movie.poster, '/captures/', label);
  const sources = movie.sources ?? [];
  const videoSource = sources.find(source => source.type === 'video/mp4');
  const video = videoSource ? publicFile(videoSource.src, '/videos/', label) : null;
  if (!videoSource) fail(`${label}: missing MP4 source`);
  for (const source of sources) publicFile(source.src, '/videos/', label);
  if (movie.metadata !== `/videos/${name}.json` || movie.captions !== `/videos/${name}.vtt` || movie.poster !== `/captures/${name}-poster.jpg` || videoSource?.src !== `/videos/${name}.mp4`) fail(`${label}: file names must match the registry key`);
  const metadata = metadataFile ? readJson(metadataFile, label) : null;
  if (!metadata) continue;
  if (metadata.origin !== movie.origin || metadata.capturedAt !== movie.capturedAt) fail(`${label}: metadata origin/time differs from registry`);
  if (metadata.viewport?.width !== 1600 || metadata.viewport?.height !== 1000 || metadata.viewport?.deviceScaleFactor !== 2 || metadata.sourcePixels?.width !== 3200 || metadata.sourcePixels?.height !== 2000 || metadata.sourcePixels?.format !== 'lossless PNG' || metadata.sourcePixels?.modified !== false || metadata.sourceFrameCount < 2) fail(`${label}: missing 1600×1000 lossless 2× source evidence`);
  if (metadata.encoding?.crf < 14 || metadata.encoding?.crf > 16 || metadata.encoding?.preset !== 'slow' || metadata.encoding?.faststart !== true) fail(`${label}: encoding must declare CRF 14–16, slow and faststart`);
  if (!metadata.timing || !metadata.edits || !/^[a-f0-9]{64}$/.test(metadata.sourceManifests?.framesSha256 ?? '') || !/^[a-f0-9]{64}$/.test(metadata.sourceManifests?.actionsSha256 ?? '')) fail(`${label}: missing timing, edits or source manifest hashes`);
  if (!Array.isArray(movie.chapters) || !movie.chapters.length || JSON.stringify(movie.chapters) !== JSON.stringify(metadata.chapters) || movie.chapters.some((chapter, index) => !chapter.title || !chapter.text || !Number.isFinite(chapter.time) || chapter.time < 0 || chapter.time >= movie.duration || (index > 0 && chapter.time <= movie.chapters[index - 1].time))) fail(`${label}: invalid or inconsistent chapters`);
  if (captions) {
    if (sha256(captions) !== metadata.sha256?.captions) fail(`${label}: captions SHA-256 mismatch`);
    const text = readFileSync(captions, 'utf8');
    if (!text.startsWith('WEBVTT') || (text.match(/ --> /g) ?? []).length !== movie.chapters.length) fail(`${label}: captions must contain one WebVTT cue per chapter`);
  }
  if (poster) {
    if (sha256(poster) !== metadata.sha256?.poster) fail(`${label}: poster SHA-256 mismatch`);
    const image = await sharp(poster).metadata();
    if (image.width !== 2560 || image.height !== 1440 || image.format !== 'jpeg') fail(`${label}: poster must be 2560×1440 JPEG`);
  }
  if (video) {
    if (sha256(video) !== metadata.sha256?.video) fail(`${label}: video SHA-256 mismatch`);
    try {
      const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,codec_name,profile,pix_fmt,r_frame_rate,avg_frame_rate:format=duration', '-of', 'json', video], {encoding:'utf8'}));
      const stream = probe.streams[0];
      if (stream?.width !== 2560 || stream.height !== 1440 || stream.codec_name !== 'h264' || stream.profile !== 'High' || stream.pix_fmt !== 'yuv420p' || stream.r_frame_rate !== '60/1' || stream.avg_frame_rate !== '60/1') fail(`${label}: actual video must be 2560×1440, H.264 High, yuv420p at constant 60fps`);
      const duration = Number(probe.format.duration);
      if (duration < 20 || duration > 60 || Math.abs(duration - movie.duration) > .05 || Math.abs(duration - metadata.outputDurationSeconds) > .05) fail(`${label}: video length must be 20–60s and agree with registry/metadata`);
      for (const field of ['width', 'height', 'codec_name', 'profile', 'pix_fmt', 'r_frame_rate', 'avg_frame_rate']) if (stream[field] !== metadata.video?.[field]) fail(`${label}: actual ${field} differs from metadata`);
      const bytes = readFileSync(video), moov = bytes.indexOf(Buffer.from('moov')), mdat = bytes.indexOf(Buffer.from('mdat'));
      if (moov < 0 || mdat < 0 || moov > mdat) fail(`${label}: MP4 is missing faststart atom order`);
    } catch (error) { fail(`${label}: ffprobe verification failed (${error.message})`); }
  }
}
for (const [name, graph] of Object.entries(graphs)) {
  if (graph.rows.length !== 3 || graph.rows.some(row => row.nodes.length !== 4 || row.arrows.length !== 3)) fail(`Invalid architecture ${name}`);
  for (const path of graph.sources) if (!existsSync(resolve(source, path))) fail(`Architecture ${name}: missing source ${path}`);
  if (!existsSync(resolve(root, 'public/diagrams', `${name}.svg`))) fail(`Missing architecture SVG ${name}`);
}

console.log(`Content: ${pages} pages, ${links} docs links, ${appRoutes} app links, ${media} media references, ${legacyRedirects.length} redirects`);
for (const item of warnings) console.warn(item.startsWith('  ') ? item : `! ${item}`);
if (failures.length) { for (const item of failures) console.error(`✗ ${item}`); process.exitCode = 1; }
else console.log(`✓ source ${pinned}, navigation, links and media`);
