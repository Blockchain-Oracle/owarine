"use client";

import type { Reading } from "@owarine/core/schemas";
import { formatBaseUnits, formatUtc } from "@owarine/core/units";
import type { AuditPayload, Recount } from "./audit";
import { fmtCount, STATS } from "./copy";
import { SectionHead, Stat } from "./StatsSections";

const V = STATS.venue;
const A = STATS.audit;

function RecountBlock({ recount }: { recount: Recount | null }) {
  if (!recount) return <p className="stats-note">{A.recountNone}</p>;
  const reporter = recount.reserve?.reporter ?? null;
  const same = reporter !== null && recount.reserve !== null && reporter.headroomBase === recount.reserve.atOffset.headroomBase && reporter.maxOwedBase === recount.reserve.atOffset.maxOwedBase;
  return (
    <div className="stats-note stats-recount" data-ok={recount.ok ? "true" : "false"} role="status">
      <strong>{A.recountHead(recount.ok, recount.offset === null ? "—" : recount.offset.toLocaleString("en-US"), formatUtc(recount.atMs, { withDate: true }))}</strong>
      <ul>
        {Object.keys(recount.projection.ledger).map((t) => (
          <li key={t}>{A.recountTemplate(t, recount.projection.ledger[t] ?? 0, recount.projection.projection[t] ?? 0)}</li>
        ))}
        {recount.projection.mismatches.map((m) => (
          <li key={m} className="stats-mismatch">
            ✗ {m}
          </li>
        ))}
        {recount.reserve && <li className={recount.reserve.matchesProjection ? undefined : "stats-mismatch"}>{A.recountReserve(recount.reserve.matchesProjection)}</li>}
        {reporter && <li className={same ? undefined : "stats-mismatch"}>{A.recountReporter(same, formatUtc(reporter.asOfMs, { withDate: true }))}</li>}
        {recount.reserve?.reporterWhy && <li>{recount.reserve.reporterWhy}</li>}
      </ul>
    </div>
  );
}

/**
 * `/stats` sections 04 and 05 (C5): the venue's totals behind the k = 5 floor, then the auditor view: the reserve
 * reporter's snapshot and the newest independent recount, read-only.
 */
export function AuditSection({ reading, decimals, symbol }: { reading: Reading<AuditPayload> | null; decimals: number; symbol: string }) {
  const audit = reading?.ok ? reading.value : null;
  const money = (v: string) => formatBaseUnits(BigInt(v), decimals, { maxDp: 2, minDp: 0 });
  const venue = audit?.venue ?? null;
  const reserve = audit?.reserve ?? null;
  return (
    <div className="stats-audit">
      <SectionHead {...V.section} />
      {venue ? (
        <>
          <div className="stats-grid">
            <Stat label={V.windows.label} value={fmtCount(venue.windows)} sub={V.windows.sub(venue.resolved, venue.voided, Math.max(0, venue.windows - venue.resolved - venue.voided))} />
            <Stat label={V.trades.label} value={fmtCount(Number(venue.trades))} sub={V.trades.sub(venue.publicWindows)} />
            <Stat label={V.volume.label} value={money(venue.volumeBase)} sub={V.volume.sub(symbol)} />
            <Stat label={V.fees.label} value={money(venue.feesBase)} sub={V.fees.sub} />
          </div>
          <p className="stats-note">{V.withheld(venue.withheldWindows, venue.floor)}</p>
        </>
      ) : (
        <p className="stats-note">{audit ? V.unavailable : STATS.reading}</p>
      )}

      <SectionHead {...A.section} />
      {reserve?.ok ? (
        <>
          <div className="stats-grid">
            <Stat label={A.free.label} value={money(reserve.value.freeBase)} sub={A.free.sub} />
            <Stat label={A.locked.label} value={money(reserve.value.lockedBase)} sub={A.locked.sub(reserve.value.liveQuotes)} />
            <Stat label={A.backing.label} value={money((BigInt(reserve.value.venueLegBase) + BigInt(reserve.value.userLegBase)).toString())} sub={A.backing.sub} />
            <Stat label={A.owed.label} value={money(reserve.value.maxOwedBase)} sub={A.owed.sub(reserve.value.openLegs)} accent />
          </div>
          <p className="stats-note">{A.headroom(money(reserve.value.headroomBase), symbol, formatUtc(reserve.value.asOfMs))}</p>
        </>
      ) : (
        <p className="stats-note">{reserve ? A.reserveDown(reserve.why) : STATS.reading}</p>
      )}
      <h3 className="stats-section-tag">{A.recountTitle}</h3>
      <RecountBlock recount={audit?.recount ?? null} />
      <p className="stats-note">{A.explain}</p>
    </div>
  );
}
