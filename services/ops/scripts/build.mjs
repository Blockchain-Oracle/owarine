// The ops service's production build: our own TypeScript (the service and every @owarine package) bundled to plain
// JavaScript once, so production runs `node` on it — one process, no TypeScript compiled at runtime by tsx (it was
// pnpm → sh → tsx → node, four processes). Every npm package stays an import, installed as usual. The bundle keeps its
// sources' files read relative to themselves (`new URL("../../config/x.json", import.meta.url)`, from any depth) re-aimed
// at the same file from the bundle's place, so config/*.json and .env.local land where they always did; the reply
// card's fonts are copied next to the bundle.
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = (path) => fileURLToPath(new URL(path, import.meta.url));
// Ours: the @owarine packages and the Daml bindings generated into packages/daml-clients (linked, never published).
const OWN = /^@(owarine|daml\.js)\//;
/** The package.json Node would load for `name` from `dir`: node_modules/<name> in this folder or the nearest above. */
function findManifest(dir, name) {
  for (let at = dir; ; at = dirname(at)) {
    const manifest = resolve(at, "node_modules", name, "package.json");
    if (existsSync(manifest)) return manifest;
    if (dirname(at) === at) return null;
  }
}
const packageName = (spec) => (spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0]);
/** npm packages bundled with our code instead of installed (their installed version differed from the one our code resolves). */
const BUNDLED = new Set(["@ai-sdk/anthropic", "@ai-sdk/google", "@ai-sdk/openai", "ai", "zod"]);


const externalNpm = {
  name: "external-npm",
  setup(builder) {
    builder.onResolve({ filter: /^[^./]/ }, (args) => {
      if (args.path.startsWith("node:")) return { path: args.path, external: true };
      // Only bundled files are ever importers here, so a bundled package's own imports follow it into the bundle.
      if (OWN.test(args.path) || BUNDLED.has(packageName(args.path)) || args.importer.includes("node_modules")) return undefined;
      const manifest = findManifest(dirname(args.importer), packageName(args.path));
      if (manifest) expected.set(packageName(args.path), JSON.parse(readFileSync(manifest, "utf8")).version);
      return { path: args.path, external: true };
    });
  },
};

const OUT_DIR = here("../dist/bundle");
const RELATIVE_URL = /new URL\((["'])(\.\.?\/[^"']+)\1,\s*import\.meta\.url\)/g;

/** Rewrites each relative `new URL("…", import.meta.url)` so it names the same file from the bundle's folder. */
const reaim = {
  name: "reaim-relative-urls",
  setup(builder) {
    builder.onLoad({ filter: /\.ts$/ }, (args) => {
      if (args.path.includes("node_modules")) return undefined;
      const source = readFileSync(args.path, "utf8");
      if (!source.includes("import.meta.url")) return undefined;
      const contents = source.replace(RELATIVE_URL, (_match, quote, rel) => {
        let target = relative(OUT_DIR, resolve(dirname(args.path), rel));
        if (!target.startsWith(".")) target = `./${target}`;
        return `new URL(${quote}${target}${quote}, import.meta.url)`;
      });
      return { contents, loader: "ts" };
    });
  },
};

// `--check <dir>`: after `pnpm deploy`, every external package our code imports must be installed at the version our
// code resolved when it was bundled; a different one (a flat install's hoisting pick) fails the image build.
if (process.argv[2] === "--check") {
  const installed = process.argv[3];
  const wanted = JSON.parse(readFileSync(here("../dist/bundle/externals.json"), "utf8"));
  const wrong = Object.entries(wanted).filter(([name, version]) => {
    const manifest = `${installed}/node_modules/${name}/package.json`;
    return !existsSync(manifest) || JSON.parse(readFileSync(manifest, "utf8")).version !== version;
  });
  if (wrong.length > 0) {
    console.error(`installed versions differ from the bundle's: ${wrong.map(([name, version]) => `${name}@${version}`).join(", ")} — add them to BUNDLED`);
    process.exit(1);
  }
  console.log(`${Object.keys(wanted).length} external packages at the versions the bundle expects`);
  process.exit(0);
}

const expected = new Map();
rmSync(here("../dist"), { recursive: true, force: true });
await build({
  entryPoints: { main: here("../src/main.ts") },
  outdir: OUT_DIR,
  // Dynamic import()s become their own chunks with Node's own module order (one-file output wraps modules in lazy
  // initialisers, and a constant read before its wrapper ran is undefined: Agari's ops crash-looped on that, 16 Oct).
  // Chunks sit beside main.mjs, so paths re-aimed from the bundle's folder hold in every chunk.
  splitting: true,
  outExtension: { ".js": ".mjs" },
  chunkNames: "[name]-[hash]",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  sourcemap: true,
  logLevel: "warning",
  plugins: [externalNpm, reaim],
  banner: { js: "import { createRequire as __owarineRequire } from 'node:module'; const require = __owarineRequire(import.meta.url);" },
});
writeFileSync(here("../dist/bundle/externals.json"), `${JSON.stringify(Object.fromEntries([...expected].sort()), null, 2)}\n`);
console.log("ops built: dist/bundle/main.mjs");
