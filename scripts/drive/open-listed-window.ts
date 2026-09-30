/**
 * Lists one Regular (stock) Window before its bell on a LOCAL stack, the way the roller does at a session's close, for
 * the pre-open UI (C7c). The roller lists stock Windows only with a market calendar (Alpaca keys); a sandbox without
 * them lists none, so the drive opens one with `Series_OpenWindowSpan` as the venue: it starts `--start-in` seconds from
 * now (default 3 h), locks 60 s before it expires and lasts `--length` seconds (default 300).
 *
 *   source <env>; pnpm --filter @agari/scripts exec tsx drive/open-listed-window.ts [--series TSLA-5m] [--start-in 10800]
 */
import "../../services/ops/src/actors/venue/quiet-codegen";
import { readFileSync } from "node:fs";
import { TEMPLATE_IDS } from "@agari/daml";
import { ledgerClientFromEnv, parseLedgerEnv } from "@agari/ledger";
import { cmd, decodeSeries, pick, readActive, submit, type RoleSession } from "@agari/markets/ops/canton";

const arg = (name: string, fallback: string): string => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback;
};
const seriesKey = arg("--series", "TSLA-5m");
const startIn = Number(arg("--start-in", "10800"));
const length = Number(arg("--length", "300"));

const parties = JSON.parse(readFileSync(process.env.AGARI_PARTIES_FILE ?? "", "utf8")) as { parties: Record<string, string> };
const venue: RoleSession = { role: "venue", party: parties.parties.venue!, client: ledgerClientFromEnv(parseLedgerEnv(process.env)), dryRun: false };
const series = pick(await readActive(venue, [TEMPLATE_IDS.Series]), TEMPLATE_IDS.Series, decodeSeries).find((s) => s.data.seriesKey === seriesKey);
if (!series) throw new Error(`no Series ${seriesKey}`);
const now = Math.floor(Date.now() / 1000);
const tradingStartSec = now + startIn;
const out = await submit(venue, {
  commandId: `open-listed:${seriesKey}:${tradingStartSec}`,
  commands: [cmd.openWindowSpan(series.cid, { index: series.data.nextIndex, tradingStartSec, lockAtSec: tradingStartSec + length - 60, expirySec: tradingStartSec + length })],
});
if (out.kind !== "done") throw new Error("the session is dry");
console.log(`listed ${seriesKey} #${series.data.nextIndex}: bell ${new Date(tradingStartSec * 1000).toISOString()}, update ${out.transaction.updateId}`);
