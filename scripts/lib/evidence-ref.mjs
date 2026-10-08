import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

/** Dated evidence stays addressable after local research is removed from the public tree. */
export function evidenceExists(root, reference) {
  const value = reference.split("#")[0];
  if (!value.startsWith("git:")) return existsSync(join(root, value));
  const match = /^git:([0-9a-f]{40}):(.+)$/.exec(value);
  if (!match || match[2].startsWith("/") || match[2].split("/").includes("..")) return false;
  try {
    execFileSync("git", ["-C", root, "cat-file", "-e", `${match[1]}:${match[2]}`], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
