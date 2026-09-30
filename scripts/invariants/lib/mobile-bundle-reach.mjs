/**
 * mobile-bundle-reach (plan, iOS step 9b, generalised): no module Metro would bundle into the phone app imports a
 * browser- or server-only package. The app reuses web's hooks through `@/`, and Metro neither tree-shakes nor skips a
 * barrel's other exports, so one web file that imports a barrel (`@/features/markets/balance`) drags that barrel's DOM
 * components in. `tsc` stays green while `expo export` fails, or the app crashes at launch (C11a found `@base-ui/react`
 * reached through `useMoney` → `balance/index.ts` → … → `desk-kit/primitives.tsx`).
 *
 * This walks the bundle the way Metro resolves it: from `mobile/index.ts` and every route under `mobile/src/app`
 * (expo-router's require.context), through value imports only (`import type` / `export type` are erased), with `~/`,
 * `@/`, relative paths and the workspace packages' `exports`, and with `mobile/web-shims.map.cjs` and the module shims
 * of `mobile/metro.config.js` applied, and reports each file that imports a denied package with one path from a route.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { finding } from "./report.mjs";
import { walkFiles } from "./walk.mjs";

/** Packages a native bundle must never reach: DOM-only UI, Next internals, server-only code, Node built-ins. */
const DENIED = /^(@base-ui\/|react-dom(\/|$)|next(\/|$)|@number-flow\/react|lightweight-charts|motion(\/|$)|framer-motion|server-only$|@agari\/db(\/|$)|@agari\/ledger$|@agari\/brain(\/|$)|@ai-sdk\/|ai$|@anthropic-ai\/|node:|postgres$)/;
/** Module shims in mobile/metro.config.js: resolved to the app's own stand-ins, so never a finding. */
const MODULE_SHIMS = new Set(["next/navigation", "lucide-react", "undici", "crypto"]);
const EXTS = [".native.tsx", ".native.ts", ".ios.tsx", ".ios.ts", ".tsx", ".ts", ".mjs", ".js", ".cjs"];
const IMPORT = /(?:^|[;\n}])\s*(?:import|export)\s+(type\s+)?(?:[\w*{}\s,$]*?\s+from\s+)?["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)|\brequire\s*\(\s*["']([^"']+)["']\s*\)/g;

const isFile = (p) => existsSync(p) && statSync(p).isFile();

function withExtension(base) {
  if (isFile(base)) return base;
  for (const ext of EXTS) if (isFile(base + ext)) return base + ext;
  for (const ext of EXTS) if (isFile(join(base, `index${ext}`))) return join(base, `index${ext}`);
  return null;
}

function workspacePackages(root) {
  const map = new Map();
  for (const dir of ["packages", "services"]) {
    for (const { abs } of walkFiles(root, dir, ["package.json"])) {
      if (abs.includes("node_modules")) continue;
      const pkg = JSON.parse(readFileSync(abs, "utf8"));
      if (pkg.name?.startsWith("@agari/")) map.set(pkg.name, { dir: dirname(abs), exports: pkg.exports ?? { ".": pkg.main ?? "./index.ts" } });
    }
  }
  return map;
}

function exportTarget(entry) {
  if (typeof entry === "string") return entry;
  if (entry && typeof entry === "object") return exportTarget(entry["react-native"] ?? entry.import ?? entry.default ?? entry.types);
  return null;
}

/** Imports that survive compilation: `import type` and `export type … from` are erased, as Babel erases them. */
function valueImports(text) {
  const found = [];
  for (const m of text.matchAll(IMPORT)) {
    if (m[1]) continue;
    const spec = m[2] ?? m[3] ?? m[4];
    if (spec) found.push(spec);
  }
  return found;
}

export function mobileBundleReach(rule, ctx) {
  const root = ctx.root;
  const mobile = join(root, "mobile");
  if (!existsSync(join(mobile, "index.ts"))) return { findings: [], skipped: "mobile/ not present" };
  const shims = new Map(createRequire(import.meta.url)(join(mobile, "web-shims.map.cjs")).map(([from, to]) => [join(root, from), join(root, to)]));
  const packages = workspacePackages(root);

  const resolveSpec = (spec, from) => {
    let base = null;
    if (spec.startsWith(".")) base = resolve(dirname(from), spec);
    else if (spec.startsWith("~/")) base = join(mobile, "src", spec.slice(2));
    else if (spec.startsWith("@/")) base = join(root, "web/src", spec.slice(2));
    else {
      const name = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0];
      const pkg = packages.get(name);
      if (!pkg) return { external: spec };
      const sub = spec === name ? "." : `./${spec.slice(name.length + 1)}`;
      const target = exportTarget(pkg.exports[sub]);
      if (!target) return { external: spec };
      base = join(pkg.dir, target);
    }
    const file = withExtension(base);
    if (!file) return { missing: spec };
    return { file: shims.get(file) ?? file };
  };

  const entries = [join(mobile, "index.ts"), ...walkFiles(root, "mobile/src/app", [".ts", ".tsx"]).map((f) => f.abs)];
  const parent = new Map(entries.map((e) => [e, null]));
  const queue = [...entries];
  const findings = [];
  const reported = new Set();
  const chainOf = (file) => {
    const chain = [];
    for (let f = file; f; f = parent.get(f)) chain.push(relative(root, f));
    return chain.reverse().join(" → ");
  };

  while (queue.length > 0) {
    const file = queue.shift();
    if (/\.(json|css)$/.test(file)) continue;
    for (const spec of valueImports(readFileSync(file, "utf8"))) {
      if (spec.endsWith(".css") || spec.endsWith(".json")) continue;
      if (MODULE_SHIMS.has(spec)) continue;
      const r = resolveSpec(spec, file);
      if (r.external !== undefined) {
        const key = `${file}|${spec}`;
        if (DENIED.test(spec) && !reported.has(key)) {
          reported.add(key);
          findings.push(finding(rule, `imports \`${spec}\`, which the phone cannot bundle; reached by ${chainOf(file)}`, relative(root, file)));
        }
        continue;
      }
      if (r.file && !parent.has(r.file)) {
        parent.set(r.file, file);
        queue.push(r.file);
      }
    }
  }
  return findings;
}
