/**
 * A committee-attested yes/no event on a LOCAL sandbox (C6, an Addition; engine 0.4.0 `PM.Event`, core
 * `committee-event.ts`). Two steps, each idempotent under its command id; the running ops resolver decides on its own:
 *
 *   create  the venue creates the event's Series once (`EVT-<id>`, print source `attested:committee:<id>`, committee =
 *           the three oracle parties, quorum 2) and lists the event through `Series_OpenEvent` with its question:
 *           trading starts at the next minute, locks `--lock-lead` seconds before the close, closes after `--minutes`
 *   attest  after the close, each named member posts an `EventAttestation` (YES or NO) whose `statementHash` is the
 *           sha-256 of its full statement (question, answer, the source it read, member, time). `--answers yes,yes,no`
 *           gives each of the three members its answer in order (a mix is a conflict: the resolver's `Event_Resolve`
 *           voids it as SourceDisagreement); `--source` names what the members read
 *
 *   LEDGER_JSON_API_URL=… LEDGER_AUTH_MODE=none OWARINE_PARTIES_FILE=… \
 *     pnpm --filter @owarine/scripts exec tsx drive/committee-event.ts create --id DEMO-1 --minutes 5 --question "…"
 *     pnpm --filter @owarine/scripts exec tsx drive/committee-event.ts attest --id DEMO-1 --answers yes,yes,yes --source https://…
 */
import { createHash } from "node:crypto";
import { createLedgerClient, noAuth, parseLedgerEnv } from "@owarine/ledger";
import { TEMPLATE_IDS } from "@owarine/daml";
import { attestedPrintSource, BAR_LEN_SEC, EVENT_KEY_PREFIX, eventStatementText, SOURCE_TIMING, type EventOutcome } from "@owarine/core/market";
import { attestCommandId, cmd, decodeEventTerms, decodeSeries, openEventCommandId, pick, readActive, type RoleSession } from "@owarine/markets/ops/canton";
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
const nowSec = () => Math.floor(Date.now() / 1000);
const venue: RoleSession = { role: "venue", party: p.venue!, client, dryRun: false };
const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

/** The newest listed event of this Series (the venue sees every `EventTerms`). */
async function latestEvent() {
  const all = pick(await readActive(venue, [TEMPLATE_IDS.EventTerms]), TEMPLATE_IDS.EventTerms, decodeEventTerms).filter((e) => e.data.marketId.startsWith(`${key}:`));
  const last = all.sort((a, b) => Number(b.data.marketId.split(":").pop()) - Number(a.data.marketId.split(":").pop()))[0];
  if (!last) throw new Error(`${key} has no event yet: run create`);
  return last.data;
}

if (step === "create") {
  const minutes = Number(arg("--minutes", "5"));
  const lockLeadSec = Number(arg("--lock-lead", "30"));
  const question = arg("--question", "");
  if (!question.trim()) throw new Error("--question is required: an event asks one");
  const startSec = Math.ceil((nowSec() + 30) / 60) * 60;
  const closeSec = startSec + minutes * 60;
  const readSeries = async () => pick(await readActive(venue, [TEMPLATE_IDS.Series]), TEMPLATE_IDS.Series, decodeSeries).find((s) => s.data.seriesKey === key);
  let series = await readSeries();
  if (!series) {
    const t = SOURCE_TIMING.committee;
    await client.submitAndWaitForTransaction({
      actAs: [p.venue!], commandId: `event:${id}:series`,
      commands: [cmd.createSeries({
        venue: p.venue!, resolver: p.resolver!, auditor: p.auditor!, seriesKey: key, symbol: key, anchorSec: startSec, cadenceSec: minutes * 60,
        lockLeadSec: Math.min(lockLeadSec, minutes * 60 - 1), settleGraceSec: 300, cashUnit: 1000n, nextIndex: 0, oracles: ORACLE_ROLES.map((r) => p[r]!), quorum: 2,
        maxDeviationBps: 0,
        policy: { version: 1, effectiveFromSec: startSec, printSource: attestedPrintSource("committee", id), minDelaySec: t.minDelaySec, barLenSec: BAR_LEN_SEC.committee, openAdmissionSec: t.admissionSec, closeAdmissionSec: t.admissionSec },
      })],
    });
    series = await readSeries();
    console.log(`[event] created Series ${key}: committee = the three oracle parties, quorum 2, attestations admitted for ${t.admissionSec} s after the close`);
  }
  const s = series!.data;
  const out = await client.submitAndWaitForTransaction({
    actAs: [p.venue!], commandId: openEventCommandId(key, s.nextIndex),
    commands: [cmd.openEvent(series!.cid, { index: s.nextIndex, question, tradingStartSec: Math.max(startSec, s.lastExpirySec ?? 0), lockAtSec: closeSec - lockLeadSec, closeTimeSec: closeSec })],
  });
  console.log(`[event] listed ${key}:${s.nextIndex} "${question}" ${new Date(startSec * 1000).toISOString()} → ${new Date(closeSec * 1000).toISOString()} · update ${out.transaction.updateId}`);
} else if (step === "attest") {
  const e = await latestEvent();
  if (nowSec() < e.closeTimeSec) throw new Error(`${e.marketId} can be attested from ${new Date(e.closeTimeSec * 1000).toISOString()}, not before`);
  const answers = arg("--answers", "yes,yes,yes").split(",").map((a) => a.trim()) as EventOutcome[];
  const source = arg("--source", "");
  if (!source.trim()) throw new Error("--source is required: each member names what it read");
  for (const [i, role] of ORACLE_ROLES.entries()) {
    const answer = answers[i];
    if (!answer) continue;
    if (answer !== "yes" && answer !== "no") throw new Error(`--answers takes yes|no per member, got ${answer}`);
    const member = p[role]!;
    const attestedAtSec = nowSec();
    const statement = eventStatementText({ marketId: e.marketId, question: e.question, answer, source, member: role, attestedAtSec });
    const out = await client.submitAndWaitForTransaction({
      actAs: [member], commandId: attestCommandId(member, e.marketId),
      commands: [cmd.createEventAttestation({ attestor: member, venue: p.venue!, resolver: p.resolver!, marketId: e.marketId, answer: answer === "yes", attestedAtSec, statementHash: sha256(statement) })],
    });
    console.log(`[event] ${role} attested ${answer.toUpperCase()} on ${e.marketId} · update ${out.transaction.updateId} · statement ${statement}`);
  }
} else {
  throw new Error("usage: committee-event.ts create --id DEMO-1 --question … [--minutes 5] [--lock-lead 30] | attest --id DEMO-1 --answers yes,yes,no --source <url>");
}
