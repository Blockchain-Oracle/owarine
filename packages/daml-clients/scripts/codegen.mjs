#!/usr/bin/env node
/**
 * `pnpm codegen:daml`: rebuild the Daml workspace and regenerate the TypeScript bindings for abu-pm-main into
 * packages/daml-clients/generated/. The output is committed; CI-style check:
 *
 *   pnpm codegen:daml && git diff --exit-code packages/daml-clients
 *
 * Steps: `dpm build --all` in daml/ -> `dpm codegen-js` on abu-pm-main's DAR into a temp dir -> keep only the
 * packages abu-pm-main's bindings import (its `file:` dependency closure; codegen emits every stdlib module) ->
 * rename `abu-pm-main-<version>` to a version-free `abu-pm-main` (package name `@daml.js/abu-pm-main`) so a
 * daml.yaml version bump never changes an import path. Nothing else in the generated files is edited.
 *
 * Needs dpm (~/.dpm/bin) and a JDK 21 (JAVA_HOME; defaults to Homebrew's openjdk@21 when unset).
 */
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pkgDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repo = resolve(pkgDir, "../..");
const damlDir = join(repo, "daml");
const outDir = join(pkgDir, "generated");
const MAIN = "abu-pm-main";

const env = { ...process.env, PATH: `${join(homedir(), ".dpm/bin")}:${process.env.PATH ?? ""}` };
const brewJdk = "/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home";
if (!env.JAVA_HOME && existsSync(brewJdk)) env.JAVA_HOME = brewJdk;
if (env.JAVA_HOME) env.PATH = `${join(env.JAVA_HOME, "bin")}:${env.PATH}`;

const run = (args, cwd) => execFileSync("dpm", args, { cwd, env, stdio: ["ignore", "inherit", "inherit"] });

const version = /^version:\s*(\S+)\s*$/m.exec(readFileSync(join(damlDir, MAIN, "daml.yaml"), "utf8"))?.[1];
if (!version) throw new Error(`no version in daml/${MAIN}/daml.yaml`);

run(["build", "--all"], damlDir);
const dar = join(damlDir, MAIN, ".daml/dist", `${MAIN}-${version}.dar`);
const tmp = mkdtempSync(join(tmpdir(), "daml-codegen-"));
try {
  run(["codegen-js", dar, "-o", tmp], join(damlDir, MAIN));

  // The `file:` dependency closure of the main package.
  const keep = new Set();
  const visit = (dir) => {
    if (keep.has(dir)) return;
    keep.add(dir);
    const deps = JSON.parse(readFileSync(join(tmp, dir, "package.json"), "utf8")).dependencies ?? {};
    for (const spec of Object.values(deps)) if (spec.startsWith("file:../")) visit(spec.slice("file:../".length));
  };
  visit(`${MAIN}-${version}`);

  rmSync(outDir, { recursive: true, force: true });
  for (const dir of readdirSync(tmp).filter((d) => keep.has(d)).sort()) {
    const target = dir === `${MAIN}-${version}` ? MAIN : dir;
    cpSync(join(tmp, dir), join(outDir, target), { recursive: true });
    if (target === MAIN) {
      const pj = join(outDir, target, "package.json");
      const json = JSON.parse(readFileSync(pj, "utf8"));
      json.name = `@daml.js/${MAIN}`;
      json.description = `${json.description} (${MAIN} ${version}, renamed version-free by packages/daml-clients/scripts/codegen.mjs)`;
      writeFileSync(pj, `${JSON.stringify(json, null, 2)}\n`);
    }
  }
  console.log(`codegen:daml: ${MAIN} ${version} -> ${[...keep].length} packages in packages/daml-clients/generated`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
