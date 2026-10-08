import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { evidenceExists } from "./evidence-ref.mjs";

test("historical evidence survives removal from the working tree, but invented paths fail", () => {
  const root = mkdtempSync(join(tmpdir(), "owarine-evidence-"));
  const git = (...args) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  try {
    git("init");
    mkdirSync(join(root, "docs"));
    writeFileSync(join(root, "docs", "record.md"), "dated evidence\n");
    git("add", "docs");
    git("-c", "user.name=Evidence test", "-c", "user.email=evidence@example.invalid", "-c", "commit.gpgsign=false", "commit", "-m", "fixture");
    const revision = git("rev-parse", "HEAD");
    rmSync(join(root, "docs"), { recursive: true });
    assert.equal(evidenceExists(root, `git:${revision}:docs/record.md#result`), true);
    assert.equal(evidenceExists(root, `git:${revision}:docs`), true);
    assert.equal(evidenceExists(root, `git:${revision}:docs/invented.md`), false);
    assert.equal(evidenceExists(root, `git:${"0".repeat(40)}:docs/record.md`), false);
    assert.equal(evidenceExists(root, `git:${revision}:../record.md`), false);
    assert.equal(evidenceExists(root, "docs/record.md"), false);
    writeFileSync(join(root, "current.json"), "{}\n");
    assert.equal(evidenceExists(root, "current.json#row"), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
