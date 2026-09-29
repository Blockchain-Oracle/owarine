/**
 * no-solana (Canton port, C1): no Solana, Solana-oracle or Anchor library in any workspace source or manifest, with a
 * shrinking allowlist that the C1 gate empties (the same trick as the reference's `no-evm`, D-016).
 *
 * `no-solana.allow.json` `files` holds the offenders still being ported: a source path (`web/src/x.ts`), a manifest
 * dependency (`web/package.json#@solana/kit`), or a directory prefix ending in `/` (`packages/clients/`) for a tree that
 * is deleted whole. The list only shrinks: an entry that no longer covers any offender fails, so it can never hide a
 * new import.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { importsOf, WORKSPACE } from "./chain-rules.mjs";
import { finding } from "./report.mjs";
import { walkFiles } from "./walk.mjs";

const SOLANA_MODULES = /@solana\/|@solana-program\/|@solana-mobile\/|@pythnetwork\/|@switchboard-xyz\/|@coral-xyz\/|@agari\/clients(?:\/|["'])/;
const SOLANA_DEPS = /^(@solana\/.+|@solana-program\/.+|@solana-mobile\/.+|@pythnetwork\/.+|@switchboard-xyz\/.+|@coral-xyz\/.+|@agari\/clients)$/;

const readJson = (abs) => JSON.parse(readFileSync(abs, "utf8"));

export function noSolana(rule, ctx) {
  const allowPath = join(ctx.root, "scripts/invariants/no-solana.allow.json");
  const entries = existsSync(allowPath) ? readJson(allowPath).files : [];
  const used = new Set();
  const covers = (key) => {
    const hit = entries.find((entry) => entry === key || (entry.endsWith("/") && key.startsWith(entry)));
    if (hit !== undefined) used.add(hit);
    return hit !== undefined;
  };
  const findings = [];
  for (const hit of importsOf(ctx.root, WORKSPACE, SOLANA_MODULES)) {
    if (!covers(hit.rel)) findings.push(finding(rule, `imports ${hit.module.replace(/["']$/, "")}`, `${hit.rel}:${hit.lineNo}`));
  }
  for (const { rel, abs } of walkFiles(ctx.root, ".", ["package.json"], ["reference"])) {
    const pkg = readJson(abs);
    for (const name of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies })) {
      if (!SOLANA_DEPS.test(name)) continue;
      if (!covers(`${rel}#${name}`)) findings.push(finding(rule, `declares ${name}`, rel));
    }
  }
  for (const entry of entries) if (!used.has(entry)) findings.push(finding(rule, "stale allowlist entry: remove it", `no-solana.allow.json → ${entry}`));
  return findings;
}
