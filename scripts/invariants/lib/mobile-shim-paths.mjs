/**
 * mobile-shim-paths (plan, iOS section step 9b): every path in the app's shim map (`mobile/web-shims.map.cjs`, the list
 * `mobile/metro.config.js` resolves by exact path) exists on both sides. Metro swaps a web file for its stand-in only
 * when the resolved path matches exactly, so a web split that moves the left-hand file would silently bundle the
 * browser version: it crashes at runtime while `tsc` stays green. A missing stand-in fails the bundle outright, and
 * is reported here too so the two sides are checked in one place.
 */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { finding } from "./report.mjs";

const MAP = "mobile/web-shims.map.cjs";

export function mobileShimPaths(rule, ctx) {
  const mapAbs = join(ctx.root, MAP);
  if (!existsSync(mapAbs)) return { findings: [], skipped: `${MAP} not present` };
  const entries = createRequire(import.meta.url)(mapAbs);
  const findings = [];
  for (const [from, to] of entries) {
    if (!existsSync(join(ctx.root, from))) findings.push(finding(rule, `shimmed file no longer exists: move the entry with the web split (${from} → ${to})`, MAP));
    if (!existsSync(join(ctx.root, to))) findings.push(finding(rule, `stand-in does not exist: ${to} (for ${from})`, MAP));
  }
  return findings;
}
