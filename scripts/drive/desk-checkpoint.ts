/**
 * Seals one live desk's daily checkpoint now (C8g drive), through the desk runner's own code: the same runner context
 * `startDeskRunner` builds (venue sessions, the agent-runner operator, the PreStocks feed) and the same
 * `wakeDesk(…, { trigger: "checkpoint" })` the actor calls in its 00:05 UTC window, so a drive can show the record and
 * the `Mandate_Checkpoint` exercise without waiting for midnight. It claims the wake for today's day slot exactly as
 * the actor does, so the actor never seals the same day twice. A local sandbox only.
 *
 *   LEDGER_JSON_API_URL=… LEDGER_AUTH_MODE=none OWARINE_PARTIES_FILE=… DATABASE_URL=… DRY_RUN=0 \
 *   OPS_INTERNAL_URL=http://localhost:8767 OPS_INTERNAL_SECRET=… \
 *     pnpm --filter @owarine/scripts exec tsx drive/desk-checkpoint.ts --desk <uuid>
 */
import { deskQueries, getDb } from "@owarine/db";
import { createRunnerContext } from "../../services/ops/src/actors/desk-runner";
import { daySlotSec } from "../../services/ops/src/actors/desk-runner/checkpoint";
import { wakeDesk } from "../../services/ops/src/actors/desk-runner/wake";
import { createVenueContext } from "../../services/ops/src/actors/venue/context";
import { createPreStocksSpotFeed } from "../../services/ops/src/prices/prestocks-spot";
import { arg } from "./cli";

if (process.env.LEDGER_AUTH_MODE !== "none") throw new Error("desk-checkpoint drives a local sandbox only");
const deskId = arg("--desk", "");
if (!deskId) throw new Error("--desk <uuid> is required");
const log = (why: string) => console.log(`[desk-checkpoint] ${why}`);

const db = getDb();
if (!db) throw new Error("DATABASE_URL is not set");
const desk = await deskQueries(db).getDeskById(deskId);
if (!desk) throw new Error(`no desk ${deskId}`);
if (!desk.address) throw new Error(`desk ${deskId} is a practice desk: only a live desk seals a checkpoint on the ledger`);

const prestocks = createPreStocksSpotFeed({ log });
const ctx = await createRunnerContext({ log, prestocks, venue: createVenueContext() });
if (!ctx?.operator) throw new Error("no operator: the runner context could not act as the agent-runner party (see the lines above)");

const nowSec = Math.floor(Date.now() / 1000);
const claimed = await ctx.q.claimWake({ deskId, scheduledForSec: daySlotSec(nowSec), trigger: "checkpoint", nowSec });
if (!claimed) throw new Error("today's checkpoint is already claimed for this desk");
const report = await wakeDesk(ctx, { desk, trigger: "checkpoint", scheduledForSec: daySlotSec(nowSec), wakeId: claimed.id });
log(`${report.status}${report.note ? ` (${report.note})` : ""}: ${report.records.map((r) => `record ${r.seq} ${r.outcome}`).join(", ") || "no record"}`);
const actions = await db<{ kind: string; state: string; signature: string | null; chain_seq: number | null }[]>`
  SELECT kind, state, signature, chain_seq FROM desk_actions WHERE desk_id = ${deskId}::uuid AND kind = 'checkpoint' ORDER BY sent_at_sec DESC LIMIT 1`;
log(`checkpoint action: ${JSON.stringify(actions[0] ?? null)}`);
process.exit(report.status === "completed" && actions[0]?.state === "confirmed" ? 0 : 1);
