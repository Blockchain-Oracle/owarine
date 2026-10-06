/**
 * Which package a built DAR carries (C2y): its main package's name, version and id, read from the DAR's
 * `META-INF/MANIFEST.MF` (`Main-Dalf: <name>-<version>-<package id>/….dalf`). The DevNet bootstrap compares these ids
 * with `GET /v2/packages` so it never runs against a DAR Abu did not upload, or against an older build of it.
 *
 * A DAR is a zip; this reads its central directory with `node:zlib` only (no dependency). Zip64 is not handled: a DAR
 * of this repo is a few MB.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { inflateRawSync } from "node:zlib";

export interface DarMain {
  name: string;
  version: string;
  packageId: string;
}

const EOCD = 0x06054b50;
const CEN = 0x02014b50;
const LOC = 0x04034b50;

/** The named entry's bytes, or undefined when the zip has no such entry. */
export function zipEntry(zip: Buffer, name: string): Buffer | undefined {
  let eocd = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 22 - 0xffff); i--) {
    if (zip.readUInt32LE(i) === EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("not a zip file (no end-of-central-directory record)");
  const count = zip.readUInt16LE(eocd + 10);
  let p = zip.readUInt32LE(eocd + 16);
  for (let n = 0; n < count; n++) {
    if (zip.readUInt32LE(p) !== CEN) throw new Error("corrupt zip central directory");
    const method = zip.readUInt16LE(p + 10);
    const compressed = zip.readUInt32LE(p + 20);
    const nameLen = zip.readUInt16LE(p + 28);
    const extraLen = zip.readUInt16LE(p + 30);
    const commentLen = zip.readUInt16LE(p + 32);
    const local = zip.readUInt32LE(p + 42);
    const entry = zip.toString("utf8", p + 46, p + 46 + nameLen);
    if (entry === name) {
      if (zip.readUInt32LE(local) !== LOC) throw new Error(`corrupt zip local header for ${name}`);
      const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
      const data = zip.subarray(start, start + compressed);
      if (method === 0) return Buffer.from(data);
      if (method === 8) return inflateRawSync(data);
      throw new Error(`${name}: unsupported zip compression method ${method}`);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return undefined;
}

/** A manifest header's value, with the 72-column continuation lines (a leading space) folded back. */
export function manifestValue(manifest: string, key: string): string | undefined {
  const unfolded = manifest.replace(/\r?\n /g, "");
  const line = unfolded.split(/\r?\n/).find((l) => l.startsWith(`${key}:`));
  return line?.slice(key.length + 1).trim();
}

export function darMain(dar: Buffer): DarMain {
  const manifest = zipEntry(dar, "META-INF/MANIFEST.MF");
  if (!manifest) throw new Error("the DAR has no META-INF/MANIFEST.MF");
  const main = manifestValue(manifest.toString("utf8"), "Main-Dalf");
  const m = main?.match(/(?:^|\/)([^/]+)-(\d[^-/]*)-([0-9a-f]{64})\.dalf$/);
  if (!m) throw new Error(`the DAR's Main-Dalf does not name <name>-<version>-<package id>.dalf (got ${main ?? "nothing"})`);
  return { name: m[1]!, version: m[2]!, packageId: m[3]! };
}

export interface RepoDar {
  name: string;
  version: string;
  /** The DAR file to compare against: `daml/released/<name>-<version>.dar`, else the package's `.daml/dist` build. */
  path: string | undefined;
}

/**
 * The DevNet release set, in upload order (`devnet-r1.md` step 5). Only these go to Noders: `abu-pm-governance` is the
 * BitSafe add-on's LocalNet package (K-150) and is never part of a DevNet release, so it is not listed here.
 * `abu-pm-cc` (the Canton Coin rail) rides with R1 so one Console session uploads everything (K-249).
 */
export const RELEASE_PACKAGES = ["abu-pm-main", "abu-pm-tickets", "abu-pm-agents", "abu-pm-games", "abu-pm-cc"] as const;

/**
 * The release set's packages at the versions their `daml.yaml` names, main first. The DAR is looked up in
 * `daml/released/` (what Abu uploads), then in `.daml/dist/`.
 */
export function repoDars(root = resolve(import.meta.dirname, "..", "..")): RepoDar[] {
  const daml = join(root, "daml");
  const order: readonly string[] = RELEASE_PACKAGES;
  const dirs = readdirSync(daml).filter((d) => existsSync(join(daml, d, "daml.yaml")) && order.includes(d));
  dirs.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return dirs.map((d) => {
    const yaml = readFileSync(join(daml, d, "daml.yaml"), "utf8");
    const name = yaml.match(/^name:\s*(\S+)/m)?.[1] ?? d;
    const version = yaml.match(/^version:\s*(\S+)/m)?.[1] ?? "0.0.0";
    const file = `${name}-${version}.dar`;
    const path = [join(daml, "released", file), join(daml, d, ".daml", "dist", file)].find((p) => existsSync(p));
    return { name, version, path };
  });
}
