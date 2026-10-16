// The ops service's production build: our own TypeScript (the service and every @owarine package) bundled to plain
// JavaScript once, so production runs `node` on it — one process, no TypeScript compiled at runtime by tsx (it was
// pnpm → sh → tsx → node, four processes). Every npm package stays an import, installed as usual. The bundle keeps its
// sources' files read relative to themselves (`new URL("../../config/x.json", import.meta.url)`, from any depth) re-aimed
// at the same file from the bundle's place, so config/*.json and .env.local land where they always did; the reply
// card's fonts are copied next to the bundle.
import { cpSync, readFileSync, rmSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = (path) => fileURLToPath(new URL(path, import.meta.url));
// Ours: the @owarine packages and the Daml bindings generated into packages/daml-clients (linked, never published).
const OWN = /^@(owarine|daml\.js)\//;

const externalNpm = {
  name: "external-npm",
  setup(builder) {
    builder.onResolve({ filter: /^[^./]/ }, (args) => (OWN.test(args.path) ? undefined : { path: args.path, external: true }));
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

rmSync(here("../dist"), { recursive: true, force: true });
await build({
  entryPoints: [here("../src/main.ts")],
  outfile: here("../dist/bundle/main.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  sourcemap: true,
  logLevel: "warning",
  plugins: [externalNpm, reaim],
  banner: { js: "import { createRequire as __owarineRequire } from 'node:module'; const require = __owarineRequire(import.meta.url);" },
});
console.log("ops built: dist/bundle/main.mjs");
