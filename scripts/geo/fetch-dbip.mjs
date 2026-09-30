#!/usr/bin/env node
// Downloads DB-IP's free "IP to Country Lite" CSV (CC BY 4.0, no account; attribution on the web's /legal page) to
// web/data/geo/dbip-country-lite.csv.gz, where the region hold reads it (web/src/lib/geo/country-db.server.ts, K-003).
//
//   node scripts/geo/fetch-dbip.mjs            # this month's file, else last month's
//   node scripts/geo/fetch-dbip.mjs --out <path>
//
// About 4.5 MB (2026-09). DB-IP publishes a new file each month; re-run to refresh. The file is gitignored and never
// committed. Exits 0 with a warning when the download fails, so a build never breaks on it: the region hold then
// reads every visitor as open (AGARI_REGION_OVERRIDE still forces the held state) until the file is present.
import { mkdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const outArg = process.argv.indexOf("--out");
const out = outArg > -1 ? resolve(process.argv[outArg + 1]) : resolve(root, "web/data/geo/dbip-country-lite.csv.gz");
const MAX_BYTES = 50 * 1024 * 1024;

const month = (offset) => {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - offset);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

async function tryMonth(ym) {
  const url = `https://download.db-ip.com/free/dbip-country-lite-${ym}.csv.gz`;
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  const length = Number(res.headers.get("content-length") ?? 0);
  if (length > MAX_BYTES) throw new Error(`${url} is ${length} bytes, over the 50 MB ceiling`);
  const body = Buffer.from(await res.arrayBuffer());
  if (body.length > MAX_BYTES) throw new Error(`${url} is over the 50 MB ceiling`);
  const head = gunzipSync(body).subarray(0, 200).toString("utf8");
  if (!/^[0-9a-f.:]+,[0-9a-f.:]+,[A-Z]{2}/m.test(head)) throw new Error(`${url} does not look like the country CSV`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(`${out}.tmp`, body);
  renameSync(`${out}.tmp`, out);
  console.log(`DB-IP Lite ${ym}: ${statSync(out).size} bytes → ${out} (CC BY 4.0, IP Geolocation by DB-IP, https://db-ip.com)`);
}

let done = false;
for (const offset of [0, 1]) {
  try {
    await tryMonth(month(offset));
    done = true;
    break;
  } catch (error) {
    console.warn(`fetch-dbip: ${error instanceof Error ? error.message : String(error)}`);
  }
}
if (!done) console.warn("fetch-dbip: no database downloaded; the region hold reads visitors as open until it is present.");
