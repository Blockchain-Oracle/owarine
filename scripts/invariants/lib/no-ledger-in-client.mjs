/**
 * `no-ledger-in-client` (C10a): no module a browser bundle can reach imports `@agari/ledger`'s root at runtime.
 *
 * The root export pulls in the HTTP client, auth and the updates stream, which reach `node:crypto`. On 29 Sep a desk
 * barrel re-exported the operator and client-reachable decoders imported the root, and `next build --webpack` failed on
 * /dev/desk (fixed in 96caadf: code that can land in a browser imports `@agari/ledger/pure`). A `next build` is too
 * slow to be the only guard, so this walks the import graph statically:
 *
 *  - entries: every web/src module that starts with the `"use client"` directive;
 *  - edges: runtime imports only (`import`, `export … from`, side-effect and dynamic `import()`); `import type`,
 *    `export type` and imports whose every binding is `type X` are erased by TypeScript and never bundled;
 *  - resolution: relative paths, web's `@/` alias, and workspace packages through their `package.json` `exports`
 *    (including `./ops/*` patterns). Third-party packages are leaves.
 *
 * A finding names the offending module and the chain from its client entry.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { finding } from "./report.mjs";
import { walkFiles } from "./walk.mjs";

const FORBIDDEN = "@agari/ledger";
const TS = [".ts", ".tsx"];
const RESOLVE_SUFFIXES = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];

const posix = (path) => path.split(sep).join("/");

/** Every workspace package by name: its directory and its `exports` map. */
function workspacePackages(root) {
  const packages = new Map();
  for (const group of ["packages", "services"]) {
    const base = join(root, group);
    if (!existsSync(base)) continue;
    for (const name of readdirSync(base)) {
      const manifest = join(base, name, "package.json");
      if (!existsSync(manifest)) continue;
      const pkg = JSON.parse(readFileSync(manifest, "utf8"));
      if (pkg.name) packages.set(pkg.name, { dir: join(base, name), exports: pkg.exports ?? { ".": pkg.main ?? "./src/index.ts" } });
    }
  }
  return packages;
}

function fileAt(base) {
  for (const suffix of RESOLVE_SUFFIXES) {
    const candidate = base + suffix;
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  // `./x.js` written for ESM resolves to `./x.ts` in this workspace.
  if (base.endsWith(".js")) return fileAt(base.slice(0, -3));
  return null;
}

function resolveExport(pkg, subpath) {
  const key = subpath ? `./${subpath}` : ".";
  const direct = pkg.exports[key];
  if (typeof direct === "string") return fileAt(join(pkg.dir, direct));
  for (const [pattern, target] of Object.entries(pkg.exports)) {
    if (!pattern.includes("*") || typeof target !== "string") continue;
    const [head, tail] = pattern.split("*");
    if (key.startsWith(head) && key.endsWith(tail) && key.length >= head.length + tail.length) {
      const star = key.slice(head.length, key.length - tail.length);
      return fileAt(join(pkg.dir, target.replace("*", star)));
    }
  }
  return null;
}

function resolveSpecifier(root, packages, fromFile, spec) {
  if (spec.startsWith(".")) return fileAt(join(dirname(fromFile), spec));
  if (spec.startsWith("@/")) return fileAt(join(root, "web/src", spec.slice(2)));
  const parts = spec.split("/");
  const name = spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
  const pkg = packages.get(name);
  if (!pkg) return null;
  return resolveExport(pkg, parts.slice(spec.startsWith("@") ? 2 : 1).join("/"));
}

/** Block comments and whole-line `//` comments removed, so prose never counts as an import. */
function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const FROM = /(?:^|[;\n])\s*(import|export)\s+(type\s+)?([^;]*?)\s+from\s+["']([^"']+)["']/g;
const BARE = /(?:^|[;\n])\s*import\s+["']([^"']+)["']/g;
const DYNAMIC = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;

/** The runtime import specifiers of one module (type-only imports dropped). */
export function runtimeImports(text) {
  const code = stripComments(text);
  const specs = [];
  for (const m of code.matchAll(FROM)) {
    if (m[2]) continue;
    const clause = m[3].trim();
    const braces = /^\{([\s\S]*)\}$/.exec(clause);
    if (braces) {
      const names = braces[1].split(",").map((s) => s.trim()).filter(Boolean);
      if (names.length > 0 && names.every((n) => n.startsWith("type "))) continue;
    }
    specs.push(m[4]);
  }
  for (const m of code.matchAll(BARE)) specs.push(m[1]);
  for (const m of code.matchAll(DYNAMIC)) specs.push(m[1]);
  return specs;
}

const isClientEntry = (text) => /^\s*(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*["']use client["']/.test(text);

export function noLedgerInClient(rule, ctx) {
  const { root } = ctx;
  const packages = workspacePackages(root);
  const entries = walkFiles(root, "web/src", TS)
    .filter(({ rel }) => !/\.test\.tsx?$/.test(rel))
    .filter(({ abs }) => isClientEntry(readFileSync(abs, "utf8")));
  const parent = new Map();
  const queue = [];
  for (const { abs } of entries) {
    if (parent.has(abs)) continue;
    parent.set(abs, null);
    queue.push(abs);
  }
  const findings = [];
  const reported = new Set();
  while (queue.length > 0) {
    const file = queue.shift();
    for (const spec of runtimeImports(readFileSync(file, "utf8"))) {
      if (spec === FORBIDDEN) {
        const rel = posix(relative(root, file));
        if (reported.has(rel)) continue;
        reported.add(rel);
        const chain = [];
        for (let at = file; at; at = parent.get(at)) chain.unshift(posix(relative(root, at)));
        findings.push(finding(rule, `imports \`${FORBIDDEN}\` at runtime (use \`${FORBIDDEN}/pure\`); reached ${chain.join(" → ")}`, rel));
        continue;
      }
      const target = resolveSpecifier(root, packages, file, spec);
      if (!target || parent.has(target) || !TS.some((ext) => target.endsWith(ext))) continue;
      parent.set(target, file);
      queue.push(target);
    }
  }
  if (entries.length === 0) return { findings: [], skipped: "no \"use client\" module under web/src" };
  return findings;
}
