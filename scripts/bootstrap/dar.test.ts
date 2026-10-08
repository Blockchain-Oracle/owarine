import { describe, expect, it } from "vitest";
import { darMain, manifestValue, repoDars, zipEntry } from "./dar";
import { zip } from "./zip.fixture";

const PKG = "ab".repeat(32);
const DALF = `abu-pm-main-0.5.0-${PKG}/abu-pm-main-0.5.0-${PKG}.dalf`;
/** The manifest folds lines at 72 bytes; a continuation line starts with a space. */
const fold = (line: string) => [line.slice(0, 72), ...(line.slice(72).match(/.{1,71}/g) ?? []).map((l) => ` ${l}`)].join("\r\n");
const MANIFEST = ["Manifest-Version: 1.0", "Created-By: dpm", fold(`Main-Dalf: ${DALF}`), "Format: daml-lf", ""].join("\r\n");

describe("DAR reading", () => {
  it("reads the main package's name, version and id from a deflated manifest with folded lines", () => {
    const dar = zip([
      { name: `${DALF}`, data: Buffer.from("not a real dalf") },
      { name: "META-INF/MANIFEST.MF", data: Buffer.from(MANIFEST), deflate: true },
    ]);
    expect(darMain(dar)).toEqual({ name: "abu-pm-main", version: "0.5.0", packageId: PKG });
  });

  it("finds stored entries and reports absent ones", () => {
    const z = zip([{ name: "a.txt", data: Buffer.from("hello") }]);
    expect(zipEntry(z, "a.txt")?.toString()).toBe("hello");
    expect(zipEntry(z, "b.txt")).toBeUndefined();
    expect(() => darMain(z)).toThrow(/no META-INF\/MANIFEST.MF/);
    expect(() => zipEntry(Buffer.from("plain text, not a zip at all"), "x")).toThrow(/not a zip/);
  });

  it("unfolds manifest continuation lines", () => {
    expect(manifestValue(MANIFEST, "Main-Dalf")).toBe(DALF);
    expect(manifestValue(MANIFEST, "Absent")).toBeUndefined();
  });

  it("lists the release's packages (R1's five, then R2's seat package), main first, at their daml.yaml versions", () => {
    const dars = repoDars();
    expect(dars.map((d) => d.name)).toEqual(["abu-pm-main", "abu-pm-tickets", "abu-pm-agents", "abu-pm-games", "abu-pm-cc", "abu-pm-seat"]);
    for (const d of dars) expect(d.version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
