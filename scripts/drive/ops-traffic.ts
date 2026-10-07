/**
 * Drives two user parties against the local venue (C3 gate): every Window of one lane gets one quote per user through
 * ops' HMAC-signed `POST /internal/quotes`, called with the web's own client (`@owarine/markets/server` `createOpsClient`,
 * so the replies are checked against the web's wire schema), alice buying Up and bob Down; each user accepts their own
 * quote with `Quote_Accept` submitted as that user through `@owarine/ledger`. Seats are funded through
 * `POST /internal/seats/fund`.
 * One JSON line per trade goes to `TRAFFIC_EVENTS_FILE`.
 *
 *   OPS_URL=http://127.0.0.1:8787 OPS_INTERNAL_SECRET=… LEDGER_JSON_API_URL=… OWARINE_PARTIES_FILE=… \
 *     pnpm --filter @owarine/scripts exec tsx drive/ops-traffic.ts --series BTC-1m --windows 12
 */
import "../../services/ops/src/actors/venue/quiet-codegen";
import { randomUUID } from "node:crypto";
import { appendFileSync } from "node:fs";
import { createLedgerClient, noAuth, parseLedgerEnv, type Party } from "@owarine/ledger";
import { TEMPLATE_IDS } from "@owarine/daml";
import { cmd, decodeVenueCash, pick, readActive } from "@owarine/markets/ops/canton";
import { createOpsClient } from "@owarine/markets/server";
import { isMarketId, type MarketId } from "@owarine/core/types";
import { readPartiesFile } from "../../services/ops/src/runtime/keys";
import { arg } from "./cli";

const OPS = process.env.OPS_URL ?? "http://127.0.0.1:8787";
const SECRET = process.env.OPS_INTERNAL_SECRET ?? "";
const SERIES = arg("--series", "BTC-1m");
const WINDOWS = Number(arg("--windows", "12"));
const STAKE = BigInt(arg("--stake-base", "5000000"));
/** Trades per user per Window (sequential per user): a burst sizes the settler's batches. */
const PER_USER = Number(arg("--quotes-per-user", "1"));
const out = process.env.TRAFFIC_EVENTS_FILE;
const env = parseLedgerEnv(process.env);
if (env.LEDGER_AUTH_MODE !== "none") throw new Error("ops-traffic drives a local sandbox only");
const client = createLedgerClient({ baseUrl: env.LEDGER_JSON_API_URL, auth: noAuth(), userId: env.LEDGER_USER_ID });
const file = readPartiesFile();
const users = Object.entries(file?.users ?? {}).slice(0, 2);
if (users.length < 2) throw new Error("the parties file needs two users: run the bootstrap with --users alice,bob");
const stamp = () => new Date().toISOString().slice(11, 23);
const log = (s: string) => console.log(`${stamp()} [traffic] ${s}`);
const record = (row: Record<string, unknown>) => out && appendFileSync(out, `${JSON.stringify({ atMs: Date.now(), ...row })}\n`);

const ops = createOpsClient({ baseUrl: OPS, secret: SECRET });

const session = (party: Party) => ({ role: "user", party, client, dryRun: false });

async function cashOf(party: Party) {
  return pick(await readActive(session(party), [TEMPLATE_IDS.VenueCash]), TEMPLATE_IDS.VenueCash, decodeVenueCash).filter((c) => c.data.owner === party);
}

let funds = 0;
async function ensureFunded(name: string, party: Party): Promise<void> {
  const total = (await cashOf(party)).reduce((a, c) => a + c.data.amount, 0n);
  if (total >= STAKE * 4n) return;
  const started = Date.now();
  const r = await ops.fundSeat({ party, leaseId: `drive-${name}-${Date.now().toString(36)}-${funds++}`, address: name });
  log(`fund ${name}: ${r.kind}${r.kind === "funded" ? ` ${r.amountBase}` : r.kind === "refused" ? ` ${r.diagnosis.kind}: ${r.diagnosis.technical}` : ""} (${Date.now() - started} ms)`);
}

interface Ladder {
  marketId: string;
  damlMarketId: string;
  seriesKey: string;
  state: string;
  tradingStartSec: number;
  quotingUntilSec: number;
}

async function trade(name: string, party: Party, ladder: Ladder, side: "up" | "down"): Promise<void> {
  const requestId = randomUUID();
  const asked = Date.now();
  if (!isMarketId(ladder.marketId)) throw new Error(`ladder marketId ${ladder.marketId} is not an app market id`);
  const q = await ops.quote({ marketId: ladder.marketId as MarketId, side, stakeBase: STAKE, displayedMaxCostBase: STAKE, party, leaseId: `drive-${name}` });
  const httpMs = Date.now() - asked;
  if (q.kind !== "quote") {
    const why = q.kind === "refused" ? `${q.diagnosis.kind}: ${q.diagnosis.technical}` : `requote at ${q.quote.avgPriceBps} bps`;
    log(`${name} ${ladder.damlMarketId} ${side}: ${q.kind} ${why}`);
    record({ kind: `quote-${q.kind}`, marketId: ladder.damlMarketId, user: name, side, why, httpMs });
    return;
  }
  const cost = q.quote.maxCostBase;
  const cash = (await cashOf(party)).sort((a, b) => (a.data.amount > b.data.amount ? -1 : 1));
  const use: string[] = [];
  let have = 0n;
  for (const c of cash) {
    if (have >= cost) break;
    use.push(c.cid);
    have += c.data.amount;
  }
  const started = Date.now();
  try {
    const r = await client.submitAndWaitForTransaction({ actAs: [party], commandId: `accept:${requestId}`, commands: [cmd.acceptQuote(q.quoteCid, use)] });
    const legs = r.transaction.events.filter((e) => "CreatedEvent" in e && e.CreatedEvent.templateId.endsWith(":PM.Leg:Leg")).length;
    const lots = q.quote.contractsRaw / 1_000_000n;
    log(`${name} ${ladder.damlMarketId} ${side} ${lots} lots @ ${q.quote.avgPriceBps / 10} cost ${cost}: quote in ${httpMs} ms, accepted in ${Date.now() - started} ms, ${legs} leg visible to ${name}`);
    record({ kind: "traded", marketId: ladder.damlMarketId, user: name, side, lots: lots.toString(), priceTicks: q.quote.avgPriceBps / 10, costBase: cost.toString(), httpMs, acceptMs: Date.now() - started });
  } catch (error) {
    log(`${name} ${ladder.damlMarketId} accept failed: ${error instanceof Error ? error.message : String(error)}`);
    record({ kind: "accept-failed", marketId: ladder.damlMarketId, user: name, side, error: String(error).slice(0, 300) });
  }
}

const traded = new Set<string>();
for (const [name, party] of users) await ensureFunded(name, party);
log(`trading ${SERIES} for ${WINDOWS} Windows as ${users.map(([n]) => n).join(", ")}`);
while (traded.size < WINDOWS) {
  try {
    const r = await fetch(`${OPS}/ladders/latest`);
    const { ladders } = (await r.json()) as { ladders: Ladder[] };
    const nowSec = Math.floor(Date.now() / 1000);
    for (const l of ladders) {
      if (l.seriesKey !== SERIES || l.state !== "quoting" || traded.has(l.marketId) || nowSec > l.quotingUntilSec - 8) continue;
      traded.add(l.marketId);
      for (const [name, party] of users) await ensureFunded(name, party);
      const burst = async (name: string, party: Party, side: "up" | "down") => {
        for (let i = 0; i < PER_USER && Math.floor(Date.now() / 1000) < l.quotingUntilSec - 6; i++) await trade(name, party, l, side);
      };
      await Promise.all([burst(users[0]![0], users[0]![1], "up"), burst(users[1]![0], users[1]![1], "down")]);
    }
  } catch (error) {
    log(`poll failed (ops restarting?): ${error instanceof Error ? error.message : String(error)}`);
  }
  await new Promise((res) => setTimeout(res, 1_000));
}
log(`done: ${traded.size} Windows traded`);
