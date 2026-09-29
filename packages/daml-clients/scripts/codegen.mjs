#!/usr/bin/env node
/**
 * `pnpm codegen:daml`: rebuild the Daml workspace and regenerate the TypeScript bindings for abu-pm-main,
 * abu-pm-tickets (C8c), abu-pm-games (C9b) and abu-pm-agents (C8f) into packages/daml-clients/generated/. The output
 * is committed; CI-style check:
 *
 *   pnpm codegen:daml && git diff --exit-code packages/daml-clients
 *
 * Steps: `dpm build --all` in daml/ -> `dpm codegen-js` on the abu-pm-tickets, abu-pm-games and abu-pm-agents DARs (each
 * carries abu-pm-main as a data-dependency, same package id) into a temp dir -> keep only the packages the bindings
 * import (their `file:` dependency closure; codegen emits every stdlib module) -> rename `<name>-<version>` to a
 * version-free `<name>` (package name `@daml.js/<name>`) so a daml.yaml version bump never changes an import path.
 * Nothing else in the generated files is edited: their own modules still `require("@daml.js/abu-pm-main-<version>")`,
 * which packages/daml-clients/package.json aliases to the same generated/abu-pm-main directory.
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
const TICKETS = "abu-pm-tickets";
const GAMES = "abu-pm-games";
const AGENTS = "abu-pm-agents";
/** The packages whose bindings the app imports; each carries abu-pm-main as a data-dependency (same package id). */
const ROOTS = [TICKETS, GAMES, AGENTS];
const RENAMED = [MAIN, ...ROOTS];

const env = { ...process.env, PATH: `${join(homedir(), ".dpm/bin")}:${process.env.PATH ?? ""}` };
const brewJdk = "/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home";
if (!env.JAVA_HOME && existsSync(brewJdk)) env.JAVA_HOME = brewJdk;
if (env.JAVA_HOME) env.PATH = `${join(env.JAVA_HOME, "bin")}:${env.PATH}`;

const run = (args, cwd) => execFileSync("dpm", args, { cwd, env, stdio: ["ignore", "inherit", "inherit"] });

const versionOf = (name) => {
  const v = /^version:\s*(\S+)\s*$/m.exec(readFileSync(join(damlDir, name, "daml.yaml"), "utf8"))?.[1];
  if (!v) throw new Error(`no version in daml/${name}/daml.yaml`);
  return v;
};
const versions = Object.fromEntries(RENAMED.map((n) => [n, versionOf(n)]));
const versioned = (name) => `${name}-${versions[name]}`;

run(["build", "--all"], damlDir);
const dars = ROOTS.map((name) => join(damlDir, name, ".daml/dist", `${versioned(name)}.dar`));
const tmp = mkdtempSync(join(tmpdir(), "daml-codegen-"));
try {
  run(["codegen-js", ...dars, "-o", tmp], join(damlDir, TICKETS));

  // The `file:` dependency closure of the main package.
  const keep = new Set();
  const visit = (dir) => {
    if (keep.has(dir)) return;
    keep.add(dir);
    const deps = JSON.parse(readFileSync(join(tmp, dir, "package.json"), "utf8")).dependencies ?? {};
    for (const spec of Object.values(deps)) if (spec.startsWith("file:../")) visit(spec.slice("file:../".length));
  };
  for (const root of ROOTS) visit(versioned(root));
  if (!keep.has(versioned(MAIN))) throw new Error(`${ROOTS.map(versioned).join(", ")} do not depend on ${versioned(MAIN)}`);

  rmSync(outDir, { recursive: true, force: true });
  for (const dir of readdirSync(tmp).filter((d) => keep.has(d)).sort()) {
    const name = RENAMED.find((n) => dir === versioned(n));
    const target = name ?? dir;
    cpSync(join(tmp, dir), join(outDir, target), { recursive: true });
    if (name) {
      const pj = join(outDir, target, "package.json");
      const json = JSON.parse(readFileSync(pj, "utf8"));
      json.name = `@daml.js/${name}`;
      json.description = `${json.description} (${name} ${versions[name]}, renamed version-free by packages/daml-clients/scripts/codegen.mjs)`;
      writeFileSync(pj, `${JSON.stringify(json, null, 2)}\n`);
    }
  }
  console.log(`codegen:daml: ${RENAMED.map((n) => `${n} ${versions[n]}`).join(", ")} -> ${[...keep].length} packages in packages/daml-clients/generated`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
