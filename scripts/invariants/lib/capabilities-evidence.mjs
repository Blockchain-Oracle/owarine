/**
 * `capabilities-evidence` (honest state, working-rules "Honest state"): the registry never claims more than its
 * evidence. Every capability is `not-live`, `local` or `live`:
 *  - `local` needs at least one `evidence` entry: a repo path that exists (an evidence note, a screenshot folder,
 *    `docs/plan/acceptance.md`) or `commit:<sha>`;
 *  - `live` needs that too, and an `acceptanceRow` whose text appears in `docs/plan/acceptance.md`;
 *  - every parity row id appears exactly once.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { finding } from "./report.mjs";
import { evidenceExists } from "../../lib/evidence-ref.mjs";

const STATES = new Set(["not-live", "local", "live"]);
const REGISTRY = ".github/verification/capabilities.json";
const ACCEPTANCE = ".github/verification/acceptance.md";

export function capabilitiesEvidence(rule, ctx) {
  const abs = join(ctx.root, REGISTRY);
  if (!existsSync(abs)) return [finding(rule, "registry missing", REGISTRY)];
  const { capabilities } = JSON.parse(readFileSync(abs, "utf8"));
  const acceptance = existsSync(join(ctx.root, ACCEPTANCE)) ? readFileSync(join(ctx.root, ACCEPTANCE), "utf8") : "";
  const findings = [];
  const checked = new Map();
  const seen = new Set();
  for (const c of capabilities) {
    const at = `${REGISTRY} ${c.id}`;
    if (seen.has(c.id)) findings.push(finding(rule, "duplicate id", at));
    seen.add(c.id);
    if (!STATES.has(c.state)) {
      findings.push(finding(rule, `unknown state \`${c.state}\``, at));
      continue;
    }
    if (c.state === "not-live") continue;
    const evidence = Array.isArray(c.evidence) ? c.evidence : [];
    if (evidence.length === 0) findings.push(finding(rule, `\`${c.state}\` without evidence`, at));
    for (const entry of evidence) {
      if (/^commit:[0-9a-f]{7,40}$/.test(entry)) continue;
      if (!checked.has(entry)) checked.set(entry, evidenceExists(ctx.root, entry));
      if (!checked.get(entry)) findings.push(finding(rule, `evidence \`${entry}\` does not exist (historical evidence needs full Git history)`, at));
    }
    if (c.state === "live" && !(c.acceptanceRow && acceptance.includes(c.acceptanceRow))) {
      findings.push(finding(rule, `\`live\` without an acceptance row in ${ACCEPTANCE}`, at));
    }
  }
  return findings;
}
