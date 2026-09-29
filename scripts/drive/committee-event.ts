/**
 * A committee-attested yes/no event on a LOCAL sandbox (C6, an Addition; core `committee-event.ts`). Three steps, each
 * idempotent under its command id; the running ops resolver records the open and resolves on its own:
 *
 *   create  the venue creates the event's Series (`EVT-<id>`, print source `attested:committee:<id>`, committee = the
 *           three oracle parties, quorum 2) and opens its one Window: trading starts at the next minute, closes after
 *           `--minutes`
 *   open    each committee member attests the 1.0 baseline at the start (after it has passed)
 *   attest  each committee member attests the outcome at the close: `--outcome yes|no` (2.0 or 0.5)
 *
 *   LEDGER_JSON_API_URL=… LEDGER_AUTH_MODE=none AGARI_PARTIES_FILE=… \
 *     pnpm --filter @agari/scripts exec tsx drive/committee-event.ts create --id DEMO-1 --minutes 10 --question "…"
 */
import { createHash } from "node:crypto";
import { createLedgerClient, noAuth, parseLedgerEnv } from "@agari/ledger";
import { TEMPLATE_IDS } from "@agari/daml";
import { attestedPrintSource, BAR_LEN_SEC, EVENT_BASELINE_E8, EVENT_KEY_PREFIX, eventCloseE8, SOURCE_TIMING, type EventOutcome } from "@agari/core/market";
import { cmd, decodeSeries, decodeTerms, pick, readActive, type RoleSession } from "@agari/markets/ops/canton";
import { ORACLE_ROLES, readPartiesFile } from "../../services/ops/src/runtime/keys";
import { arg } from "./cli";

const env = parseLedgerEnv(process.env);
if (env.LEDGER_AUTH_MODE !== "none") throw new Error("committee-event runs against an unauthenticated local sandbox only");
const client = createLedgerClient({ baseUrl: env.LEDGER_JSON_API_URL, auth: noAuth(), userId: env.LEDGER_USER_ID });
const file = readPartiesFile();
if (!file) throw new Error("no parties file: run bootstrap-local.ts first");
const p = file.parties;
const [step] = process.argv.slice(2);
const id = arg("--id", "DEMO-1");
const key = `${EVENT_KEY_PREFIX}${id}`;
const policyVersion = 1;
const nowSec = () => Math.floor(Date.now() / 1000);
const venue: RoleSession = { role: "venue", party: p.venue!, client, dryRun: false };

async function eventTerms() {
  const t = pick(await readActive(venue, [TEMPLATE_IDS.MarketTerms]), TEMPLATE_IDS.MarketTerms, decodeTerms).find((x) => x.data.seriesKey === key);
  if (!t) throw new Error(`${key} has no Window yet: run create`);
  return t.data;
}

async function attest(boundarySec: number, priceE8: bigint, what: string): Promise<void> {
  if (nowSec() < boundarySec) throw new Error(`${what} can be attested from ${new Date(boundarySec * 1000).toISOString()}, not before`);
  for (const role of ORACLE_ROLES) {
    const member = p[role]!;
    const statement = JSON.stringify({ event: id, question: arg("--question", ""), attests: what, priceE8: priceE8.toString(), member: role, atSec: nowSec() });
    await client.submitAndWaitForTransaction({
      actAs: [member],
      commandId: `event:${id}:${role}:${boundarySec}`,
      commands: [cmd.createPriceQuote({
        oracle: member, venue: p.venue!, resolver: p.resolver!, symbol: key, boundarySec, priceE8, barLenSec: BAR_LEN_SEC.committee,
        fetchedAtSec: nowSec(), payloadHash: createHash("sha256").update(statement).digest("hex"), policyVersion,
      })],
    });
    console.log(`[event] ${role} attested ${what} for ${key} @${new Date(boundarySec * 1000).toISOString()}: ${statement}`);
  }
}

if (step === "create") {
  const minutes = Number(arg("--minutes", "10"));
  const startSec = Math.ceil((nowSec() + 30) / 60) * 60;
  const have = pick(await readActive(venue, [TEMPLATE_IDS.Series]), TEMPLATE_IDS.Series, decodeSeries).find((s) => s.data.seriesKey === key);
  let seriesCid = have?.cid;
  if (!seriesCid) {
    const t = SOURCE_TIMING.committee;
    await client.submitAndWaitForTransaction({
      actAs: [p.venue!], commandId: `event:${id}:series`,
      commands: [cmd.createSeries({
        venue: p.venue!, resolver: p.resolver!, auditor: p.auditor!, seriesKey: key, symbol: key, anchorSec: startSec, cadenceSec: minutes * 60,
        lockLeadSec: 60, settleGraceSec: 300, cashUnit: 1000n, nextIndex: 0, oracles: ORACLE_ROLES.map((r) => p[r]!), quorum: 2, maxDeviationBps: 0,
        policy: { version: policyVersion, effectiveFromSec: startSec, printSource: attestedPrintSource("committee", id), minDelaySec: t.minDelaySec, barLenSec: BAR_LEN_SEC.committee, openAdmissionSec: t.admissionSec, closeAdmissionSec: t.admissionSec },
      })],
    });
    seriesCid = pick(await readActive(venue, [TEMPLATE_IDS.Series]), TEMPLATE_IDS.Series, decodeSeries).find((s) => s.data.seriesKey === key)?.cid;
    console.log(`[event] created Series ${key}: ${minutes} min from ${new Date(startSec * 1000).toISOString()}, committee = the three oracle parties, quorum 2`);
  }
  if (have && have.data.nextIndex > 0) console.log(`[event] ${key} Window already open`);
  else {
    await client.submitAndWaitForTransaction({ actAs: [p.venue!], commandId: `event:${id}:open`, commands: [cmd.openWindow(seriesCid!, 0)] });
    console.log(`[event] opened ${key}:0`);
  }
} else if (step === "open") {
  const t = await eventTerms();
  await attest(t.tradingStartSec, EVENT_BASELINE_E8, "the baseline");
} else if (step === "attest") {
  const outcome = arg("--outcome", "") as EventOutcome;
  if (outcome !== "yes" && outcome !== "no") throw new Error("--outcome yes|no");
  const t = await eventTerms();
  await attest(t.expirySec, eventCloseE8(outcome), outcome.toUpperCase());
} else {
  throw new Error("usage: committee-event.ts create|open|attest --id DEMO-1 [--minutes 10] [--outcome yes|no]");
}
