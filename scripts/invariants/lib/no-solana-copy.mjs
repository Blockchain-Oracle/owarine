import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { finding } from "./report.mjs";
import { readText, walkFiles } from "./walk.mjs";

/**
 * no-solana-copy (Canton port, C4c): the product never claims Solana. `no-solana` bans the libraries; this rule bans the
 * words a person reads — string literals and JSX text in the apps and the shared copy tables, and every line of the docs.
 *
 * Code is not copy: identifiers (`b.lamports`, `status.tusdc`), comments and machine keys (a literal that is one
 * lowercase token such as `"tusdc"`, `"why-solana"` or `"solana:mainnet"`) are the chain lanes' business, not this rule's.
 * Tests may say what the reference did.
 *
 * `no-solana-copy.allow.json` holds the lines that name Solana on purpose (the lineage), each with a reason. An entry is
 * `{ file, match, why }` where `match` is a substring of the line; the rule fails on an entry that matches nothing.
 *
 * C10b widened it from the Solana name to the Solana-era vocabulary a reader would still see: the SOL ticker (upper
 * case only, so `sol` in code and "Sol" in prose pass), Solana wallets (Backpack beside Phantom and Solflare), Solana
 * infrastructure (Helius, Solscan, Jupiter), "on chain", block explorers and gas. Scopes grew to every string in
 * `packages/core` and `packages/markets` (their error and refusal texts reach the page) and the PWA manifest. Jupiter
 * is also a named price source, so `Jupiter Price v3` / `jupiter-price-v3` (PRICE_SOURCES) pass without an entry.
 * Words with a true Canton meaning (seat signature, transaction, network fee, the venue's sponsor refusals) are not here.
 */
export const FORBIDDEN = /\b(solana|devnet sol|lamports?|phantom|solflare|backpack|helius|solscan|jupiter|tusdc|on[- ]chain|onchain|block explorers?|gas fees?|out of gas)\b/i;
/** The SOL ticker: case-sensitive, so identifiers and prose that merely contain "sol" never trip it. */
export const FORBIDDEN_TICKER = /\bSOL\b/;
/** Named price sources that share a word with FORBIDDEN; removed from a string before it is checked. */
export const PRICE_SOURCES = /\bJupiter Price v3\b|\bjupiter-price-v3\b/gi;
const SCOPES = ["web/src", "web/public/manifest.webmanifest", "mobile/src", "packages/core/src", "packages/markets/src", "docs-site/content"];
const CODE = [".ts", ".tsx"];
const PROSE = [".md", ".mdx", ".webmanifest"];
const SKIP_FILE = /\.test\.tsx?$|\/__tests__\//;
/**
 * One lowercase token (letters, digits, `_`, `-`, one optional `:` part, which may be a template's open end such as
 * `onchain:${id}`): a key or an id, never a sentence. A module specifier (`./jupiter`) or a bare URL is code too.
 */
const MACHINE_KEY = /^[a-z0-9_-]+(?::[a-z0-9_-]*)?$|^(?:\.{1,2}\/|[@~]\/?)[\w@.\/-]*$|^https?:\/\/\S+$/;
/** Characters after which a `/` starts a regex literal rather than a division. */
const REGEX_PREFIX = /[(,=:[!&|?{};+\-*%<>~^]$|(?:^|[^\w$])(?:return|typeof|case|in|of|delete|void|throw|new)$/;

/**
 * The string literals of a TS/TSX file with their line numbers, and (for TSX) the text between tags. A small scanner,
 * not a parser: it tracks comments, the three quote kinds, `${}` nesting in templates and regex literals.
 */
export function visibleStrings(text, jsx) {
  const out = [];
  let i = 0;
  let line = 1;
  const templates = []; // brace depth at which each open `${` returns to its template
  let depth = 0;
  let code = "";
  const push = (value, at) => { if (value.trim()) out.push({ value, line: at }); };
  const readString = (quote) => {
    const start = line;
    let value = "";
    i += 1;
    while (i < text.length) {
      const c = text[i];
      if (c === "\\") { value += text.slice(i, i + 2); if (text[i + 1] === "\n") line += 1; i += 2; continue; }
      if (c === "\n") { line += 1; if (quote !== "`") { i += 1; break; } }
      if (c === quote) { i += 1; return { value, start, open: false }; }
      if (quote === "`" && c === "$" && text[i + 1] === "{") { i += 2; return { value, start, open: true }; }
      value += c;
      i += 1;
    }
    return { value, start, open: false };
  };
  const template = () => {
    const part = readString("`");
    push(part.value, part.start);
    if (part.open) { templates.push(depth); depth += 1; }
  };
  const jsxText = () => {
    // Text between `>` and the next `<` or `{`, e.g. `<p>AGENTS · SOLANA DEVNET</p>`.
    const m = /^>([^<>{}=;()]*)(?=[<{])/.exec(text.slice(i));
    if (m && /[A-Za-z]/.test(m[1])) push(m[1], line);
  };
  while (i < text.length) {
    const c = text[i];
    const next = text[i + 1];
    if (c === "\n") { line += 1; i += 1; code = ""; continue; }
    if (c === "/" && next === "/") { while (i < text.length && text[i] !== "\n") i += 1; continue; }
    if (c === "/" && next === "*") {
      const end = text.indexOf("*/", i + 2);
      const stop = end === -1 ? text.length : end + 2;
      for (let k = i; k < stop; k += 1) if (text[k] === "\n") line += 1;
      i = stop;
      continue;
    }
    if (c === "/" && REGEX_PREFIX.test(code.trimEnd() || "(")) {
      i += 1;
      let inClass = false;
      while (i < text.length && text[i] !== "\n") {
        if (text[i] === "\\") { i += 2; continue; }
        if (text[i] === "[") inClass = true;
        else if (text[i] === "]") inClass = false;
        else if (text[i] === "/" && !inClass) { i += 1; break; }
        i += 1;
      }
      while (/[a-z]/.test(text[i] ?? "")) i += 1;
      code += "0";
      continue;
    }
    if (c === '"' || c === "'") { const s = readString(c); push(s.value, s.start); code += "0"; continue; }
    if (c === "`") { template(); code += "0"; continue; }
    if (c === "{") depth += 1;
    if (c === "}") {
      depth -= 1;
      if (templates.length && templates[templates.length - 1] === depth) { templates.pop(); template(); code += "0"; continue; }
    }
    if (jsx && c === ">") jsxText();
    code += c;
    i += 1;
  }
  return out;
}

export function noSolanaCopy(rule, ctx) {
  const allow = JSON.parse(readFileSync(join(ctx.root, "scripts/invariants/no-solana-copy.allow.json"), "utf8")).entries;
  const used = new Set();
  const findings = [];
  const check = (rel, lineNo, value, raw) => {
    const text = value.replace(PRICE_SOURCES, "");
    const match = FORBIDDEN.exec(text) ?? FORBIDDEN_TICKER.exec(text);
    if (!match) return;
    const entry = allow.findIndex((e) => e.file === rel && raw.includes(e.match));
    if (entry >= 0) { used.add(entry); return; }
    findings.push(finding(rule, `\`${match[0]}\` in copy — say what is true on Canton, or allowlist the line with a reason`, `${rel}:${lineNo}`));
  };
  for (const scope of SCOPES) {
    const abs = join(ctx.root, scope);
    const files = existsSync(abs) && statSync(abs).isFile() ? [{ rel: scope, abs }] : walkFiles(ctx.root, scope, [...CODE, ...PROSE]);
    for (const { rel, abs } of files) {
      if (SKIP_FILE.test(rel)) continue;
      const text = readText(abs);
      const lines = text.split("\n");
      if (PROSE.some((ext) => rel.endsWith(ext))) {
        lines.forEach((raw, index) => check(rel, index + 1, raw, raw));
        continue;
      }
      for (const { value, line } of visibleStrings(text, rel.endsWith(".tsx"))) {
        if (MACHINE_KEY.test(value)) continue;
        check(rel, line, value, lines[line - 1] ?? value);
      }
    }
  }
  allow.forEach((e, i) => {
    if (!used.has(i)) findings.push(finding(rule, `stale allowlist entry (\`${e.match}\`): remove it`, e.file));
  });
  return findings;
}
