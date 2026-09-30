/**
 * mobile-review-hygiene (plan, iOS section "Review hygiene"): what App Review reads in the binary stays true.
 *  - `ITSAppUsesNonExemptEncryption = false` (`ios.config.usesNonExemptEncryption: false` in app.config.js);
 *  - the first-run gate says "demo credits", "no cash value" and "test network" (`SEAT.terms`, the last onboarding page);
 *  - no purchase path of any kind, and no real-money connector (the Grofty/PartyLayer rail is web-only, guideline
 *    2.3.1): no in-app purchase or payment module in the app's manifest or source.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { finding } from "./report.mjs";
import { codeLines, readText, walkFiles } from "./walk.mjs";

const CONFIG = "mobile/app.config.js";
const GATE = "mobile/src/wallet/seat-copy.ts";
const PURCHASE = /(expo-in-app-purchases|react-native-iap|expo-iap|react-native-purchases|@revenuecat\/|@stripe\/|@partylayer\/|grofty|StoreKit|SKPaymentQueue)/i;

export function mobileReviewHygiene(rule, ctx) {
  const findings = [];
  const config = join(ctx.root, CONFIG);
  if (!existsSync(config) || !/usesNonExemptEncryption:\s*false/.test(readFileSync(config, "utf8"))) findings.push(finding(rule, "ios.config.usesNonExemptEncryption must be false (ITSAppUsesNonExemptEncryption)", CONFIG));
  const gate = existsSync(join(ctx.root, GATE)) ? readFileSync(join(ctx.root, GATE), "utf8") : "";
  for (const words of ["demo credits", "no cash value", "test network"]) if (!gate.toLowerCase().includes(words)) findings.push(finding(rule, `the first-run gate no longer says "${words}"`, GATE));
  const pkg = JSON.parse(readFileSync(join(ctx.root, "mobile/package.json"), "utf8"));
  for (const name of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })) if (PURCHASE.test(name)) findings.push(finding(rule, `a purchase or payment module in the app: ${name}`, "mobile/package.json"));
  for (const { rel, abs } of walkFiles(ctx.root, "mobile/src", [".ts", ".tsx"])) {
    for (const [lineNo, line] of codeLines(readText(abs))) if (PURCHASE.test(line)) findings.push(finding(rule, "a purchase or real-money path in the app", `${rel}:${lineNo}`));
  }
  return findings;
}
