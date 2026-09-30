/** Test fixture: builds a minimal zip, enough to stand in for a DAR (`dar.test.ts`, `devnet-http.test.ts`). */
import { deflateRawSync } from "node:zlib";

/** A minimal zip (stored or deflated entries), enough to stand in for a DAR. */
export function zip(entries: Array<{ name: string; data: Buffer; deflate?: boolean }>): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const e of entries) {
    const body = e.deflate ? deflateRawSync(e.data) : e.data;
    const name = Buffer.from(e.name, "utf8");
    const loc = Buffer.alloc(30);
    loc.writeUInt32LE(0x04034b50, 0);
    loc.writeUInt16LE(e.deflate ? 8 : 0, 8);
    loc.writeUInt32LE(body.length, 18);
    loc.writeUInt32LE(e.data.length, 22);
    loc.writeUInt16LE(name.length, 26);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(e.deflate ? 8 : 0, 10);
    cen.writeUInt32LE(body.length, 20);
    cen.writeUInt32LE(e.data.length, 24);
    cen.writeUInt16LE(name.length, 28);
    cen.writeUInt32LE(offset, 42);
    locals.push(loc, name, body);
    centrals.push(cen, name);
    offset += 30 + name.length + body.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

/** A DAR whose manifest names `<name>-<version>-<packageId>.dalf` as its main package. */
export function fakeDar(name: string, version: string, packageId: string): Buffer {
  const dalf = `${name}-${version}-${packageId}/${name}-${version}-${packageId}.dalf`;
  return zip([
    { name: dalf, data: Buffer.from("dalf") },
    { name: "META-INF/MANIFEST.MF", data: Buffer.from(`Manifest-Version: 1.0\r\nMain-Dalf: ${dalf}\r\n`), deflate: true },
  ]);
}
