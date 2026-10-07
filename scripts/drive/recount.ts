// The auditor's independent recount (C5, plan "the auditor party checks the reserve"), recorded for /stats.
//   pnpm exec tsx --env-file-if-exists=.env.local scripts/drive/recount.ts [--json] [--no-record]
// Env: DATABASE_URL, VENUE_PARTY (or the bootstrap's parties file), LEDGER_JSON_API_URL (+ LEDGER_AUTH_MODE and its
// variables), PROJECTOR_STREAM; OPS_URL (default NEXT_PUBLIC_PRICE_FEED_URL, else http://127.0.0.1:8787) for /reserve.
//
// Two recounts, neither taken from the process it checks:
//   1. the projection: the venue's active contracts at the projection's cursor offset against the projection's rows
//      (`verifyProjection`, contract-id sets per template, plus the projection's own counters);
//   2. the reserve: free cash, locked quote stakes, the venue's and users' leg backing and the most the venue can owe,
//      summed here from those same contracts, then compared with the reserve reporter's live `/reserve` snapshot and
//      with the projection's open legs and live quotes at the same offset.
// Exits 0 when the projection recount has zero diffs and the reserve at the offset matches the projection, else 1.
import "../../services/ops/src/actors/venue/quiet-codegen";
import { TEMPLATE_IDS } from "@owarine/daml";
import { getDb, indexWriter, recordRecount } from "@owarine/db";
import { ledgerClientFromEnv, parseLedgerEnv, type ActiveContract } from "@owarine/ledger";
import { decodeLeg, decodeQuote, decodeVenueCash, pick } from "@owarine/markets/ops/canton";
import { verifyProjection } from "../../services/ops/src/actors/projector/verify";
import { roleParty } from "../../services/ops/src/runtime/keys";
import { flag } from "./cli";

interface Reserve {
  freeBase: string;
  lockedBase: string;
  venueLegBase: string;
  userLegBase: string;
  maxOwedBase: string;
  headroomBase: string;
  openLegs: number;
  liveQuotes: number;
}

/** Buckets that are the venue's trading cash; `reserve*` and `private*` are other books (the pricer's rule, restated). */
const tradingBucket = (bucket: string) => !bucket.startsWith("reserve") && !bucket.startsWith("private");

function reserveOf(contracts: readonly ActiveContract[], venue: string): Reserve {
  let free = 0n, locked = 0n, venueLegs = 0n, userLegs = 0n, maxOwed = 0n;
  for (const c of pick(contracts, TEMPLATE_IDS.VenueCash, decodeVenueCash)) if (c.data.owner === venue && tradingBucket(c.data.bucket)) free += c.data.amount;
  const quotes = pick(contracts, TEMPLATE_IDS.Quote, decodeQuote).filter((q) => q.data.venue === venue);
  for (const q of quotes) locked += q.data.lots * BigInt(1000 - q.data.priceTicks) * q.data.cashUnit;
  const legs = pick(contracts, TEMPLATE_IDS.Leg, decodeLeg).filter((l) => l.data.venue === venue);
  for (const l of legs) {
    if (l.data.owner === venue) venueLegs += l.data.backingShare;
    else {
      userLegs += l.data.backingShare + l.data.feePaid;
      maxOwed += l.data.lots * 1000n * l.data.cashUnit + l.data.feePaid;
    }
  }
  const s = (v: bigint) => v.toString();
  return {
    freeBase: s(free), lockedBase: s(locked), venueLegBase: s(venueLegs), userLegBase: s(userLegs), maxOwedBase: s(maxOwed),
    headroomBase: s(free + locked + venueLegs + userLegs - maxOwed), openLegs: legs.length, liveQuotes: quotes.length,
  };
}

const db = getDb();
const party = process.env.VENUE_PARTY || roleParty("venue");
if (!db || !party) {
  console.error("DATABASE_URL and VENUE_PARTY (or a parties file naming the venue) are required");
  process.exit(2);
}
const ledger = ledgerClientFromEnv(parseLedgerEnv());
const stream = process.env.PROJECTOR_STREAM ?? "venue";
const atMs = Date.now();
const projection = await verifyProjection({ db, ledger, party, stream });

let reserve: { atOffset: Reserve; projected: { userLegBase: string; maxOwedBase: string; venueLegBase: string; lockedBase: string; openLegs: number; liveQuotes: number }; reporter: (Reserve & { asOfMs: number }) | null; reporterWhy: string | null; matchesProjection: boolean } | null = null;
const cursor = await indexWriter(db).cursor(stream);
if (cursor) {
  const contracts: ActiveContract[] = [];
  for await (const page of ledger.iterateActiveContracts({ parties: [party], templateIds: [TEMPLATE_IDS.VenueCash, TEMPLATE_IDS.Quote, TEMPLATE_IDS.Leg], activeAtOffset: cursor.offset, maxPageSize: 500 })) {
    contracts.push(...page.contracts);
  }
  const atOffset = reserveOf(contracts, party);
  const [p] = await db<{ user_leg: string; max_owed: string; venue_leg: string; open_legs: number; locked: string; live_quotes: number }[]>`
    SELECT
      (SELECT COALESCE(sum(backing_share + fee_paid) FILTER (WHERE NOT is_venue), 0) FROM idx_legs WHERE status = 'open')::text AS user_leg,
      (SELECT COALESCE(sum(lots * 1000 * cash_unit + fee_paid) FILTER (WHERE NOT is_venue), 0) FROM idx_legs WHERE status = 'open')::text AS max_owed,
      (SELECT COALESCE(sum(backing_share) FILTER (WHERE is_venue), 0) FROM idx_legs WHERE status = 'open')::text AS venue_leg,
      (SELECT count(*) FROM idx_legs WHERE status = 'open')::int AS open_legs,
      (SELECT COALESCE(sum(lots * (1000 - price_ticks) * cash_unit), 0) FROM idx_quotes WHERE status = 'issued')::text AS locked,
      (SELECT count(*) FROM idx_quotes WHERE status = 'issued')::int AS live_quotes`;
  const projected = { userLegBase: p!.user_leg, maxOwedBase: p!.max_owed, venueLegBase: p!.venue_leg, lockedBase: p!.locked, openLegs: p!.open_legs, liveQuotes: p!.live_quotes };
  const matchesProjection = (Object.keys(projected) as (keyof typeof projected)[]).every((k) => String(projected[k]) === String(atOffset[k]));

  const base = (process.env.OPS_URL || process.env.NEXT_PUBLIC_PRICE_FEED_URL || "http://127.0.0.1:8787").replace(/\/$/, "");
  let reporter: (Reserve & { asOfMs: number }) | null = null;
  let reporterWhy: string | null = null;
  try {
    const r = await fetch(`${base}/reserve`, { signal: AbortSignal.timeout(5_000) });
    if (r.ok) reporter = (await r.json()) as Reserve & { asOfMs: number };
    else reporterWhy = `ops /reserve answered ${r.status}`;
  } catch (error) {
    reporterWhy = `ops /reserve unreachable: ${error instanceof Error ? error.message : String(error)}`;
  }
  reserve = { atOffset, projected, reporter, reporterWhy, matchesProjection };
}

const ok = projection.ok && (reserve?.matchesProjection ?? false);
const report = { atMs, offset: projection.offset, projection, reserve };
if (!flag("--no-record")) await recordRecount(db, { atMs, offset: projection.offset, ok, report });
await db.end();

if (flag("--json")) console.log(JSON.stringify(report, null, 2));
else {
  console.log(`recount at offset ${projection.offset ?? "-"}: ${ok ? "OK" : "DIFFERS"}`);
  for (const t of Object.keys(projection.ledger)) console.log(`  ${t.padEnd(28)} ledger ${String(projection.ledger[t]).padStart(5)}  projection ${String(projection.projection[t]).padStart(5)}`);
  for (const m of projection.mismatches) console.log(`  ✗ ${m}`);
  if (reserve) {
    console.log(`  reserve at offset: free ${reserve.atOffset.freeBase} · locked ${reserve.atOffset.lockedBase} · legs ${reserve.atOffset.venueLegBase}+${reserve.atOffset.userLegBase} · max owed ${reserve.atOffset.maxOwedBase} · headroom ${reserve.atOffset.headroomBase}`);
    console.log(`  projection's legs and quotes ${reserve.matchesProjection ? "match" : "DIFFER"}; reporter ${reserve.reporter ? `headroom ${reserve.reporter.headroomBase} as of ${new Date(reserve.reporter.asOfMs).toISOString()}` : reserve.reporterWhy}`);
  }
}
process.exit(ok ? 0 : 1);
