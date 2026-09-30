/**
 * mobile-identity (plan, iOS section "Distribution"; K-126): the Canton app never carries the reference app's live
 * identifiers. The reference (Agari on Solana) has real TestFlight users on its own EAS project and App Store Connect
 * record; an EAS update or submit from this repo under those ids would reach them. So:
 *  - the reference's EAS project id, its update URL and its App Store Connect app id never appear in any code or
 *    config file in the repo (the prose history in `*.md` may name them);
 *  - `mobile/app.identity.json` (the one file app.config.js builds every identifier from) exists, is complete, and names
 *    none of the reference's bundle id, package, scheme, slug, App Group or storage namespaces;
 *  - `mobile/app.json` does not come back beside app.config.js (Expo would read both, and an old copy would win silently);
 *  - no app source spells the reference's deep-link scheme; links go through `appUrl` (`mobile/src/lib/identity.ts`);
 *  - the web's copy of the scheme (the seat link QR, `APP_LINK_SCHEME`) equals the identity's (web never imports mobile).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { finding } from "./report.mjs";
import { codeLines, readText, walkFiles } from "./walk.mjs";

// Spelled in pieces so this file never matches itself.
const FORBIDDEN = [
  ["the reference's EAS project id", ["9a7235af", "d606-46ad-b488", "537846b2c072"].join("-")],
  ["the reference's App Store Connect app id", ["68161", "16543"].join("")],
];
const CONFIG_EXTS = [".json", ".js", ".cjs", ".mjs", ".ts", ".tsx", ".yml", ".yaml", ".plist", ".entitlements", ".xml", ".gradle", ".pbxproj", ".env", ".example", ".toml"];
const SKIP = ["scripts/invariants", "refs", "daml/.daml", ".expo", "mobile/dist", "mobile/ios", "mobile/android"];

const IDENTITY = "mobile/app.identity.json";
const REQUIRED = ["displayName", "slug", "bundleId", "androidPackage", "scheme", "appGroup", "widgetExtensionId", "storagePrefix", "mmkvId"];
/** What the reference app shipped as; none may be reused (a shared App Group or scheme crosses the two apps). */
const REFERENCE = {
  slug: /^agari$/,
  bundleId: /^xyz\.useagari\.app$/,
  androidPackage: /^xyz\.useagari\.app$/,
  scheme: /^agari$/,
  appGroup: /^group\.xyz\.useagari\.app$/,
  widgetExtensionId: /^xyz\.useagari\.app\./,
  storagePrefix: /^agari[.:]?$/,
  mmkvId: /^agari$/,
};
const OLD_SCHEME = /["'`]agari:\/\//;
const WEB_SCHEME = "web/src/features/canton-ux/seat/link.ts";

export function mobileIdentity(rule, ctx) {
  const findings = [];
  for (const { rel, abs } of walkFiles(ctx.root, ".", CONFIG_EXTS, SKIP)) {
    const text = readText(abs);
    for (const [what, value] of FORBIDDEN) if (text.includes(value)) findings.push(finding(rule, `${what} is back: this repo must never publish or submit to the reference app`, rel));
  }

  const idAbs = join(ctx.root, IDENTITY);
  if (!existsSync(idAbs)) findings.push(finding(rule, "missing: app.config.js builds every identifier from it", IDENTITY));
  else {
    const identity = JSON.parse(readFileSync(idAbs, "utf8"));
    for (const key of REQUIRED) if (typeof identity[key] !== "string" || identity[key] === "") findings.push(finding(rule, `\`${key}\` must be a non-empty string`, IDENTITY));
    for (const [key, pattern] of Object.entries(REFERENCE)) if (typeof identity[key] === "string" && pattern.test(identity[key])) findings.push(finding(rule, `\`${key}\` reuses the reference app's \`${identity[key]}\``, IDENTITY));
    const web = existsSync(join(ctx.root, WEB_SCHEME)) ? /APP_LINK_SCHEME = "([^"]+)"/.exec(readFileSync(join(ctx.root, WEB_SCHEME), "utf8"))?.[1] : null;
    if (web !== undefined && web !== null && web !== identity.scheme) findings.push(finding(rule, `APP_LINK_SCHEME is "${web}" but the app's scheme is "${identity.scheme}"`, WEB_SCHEME));
    if (identity.easProjectId !== null && typeof identity.easProjectId !== "string") findings.push(finding(rule, "`easProjectId` is null until the new EAS project exists, then its id", IDENTITY));
  }
  if (existsSync(join(ctx.root, "mobile/app.json"))) findings.push(finding(rule, "app.json is back beside app.config.js: keep one config, built from app.identity.json", "mobile/app.json"));

  for (const { rel, abs } of walkFiles(ctx.root, "mobile/src", [".ts", ".tsx"])) {
    for (const [lineNo, line] of codeLines(readText(abs))) if (OLD_SCHEME.test(line)) findings.push(finding(rule, "the reference's `agari://` scheme: build links with `appUrl`", `${rel}:${lineNo}`));
  }
  return findings;
}
