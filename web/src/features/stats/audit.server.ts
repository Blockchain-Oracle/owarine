import "server-only";
import { getDb, K_ANON_FLOOR, latestRecount, venueStats } from "@owarine/db";
import { webEnv } from "@/lib/env";
import { recountSchema, reserveSchema, type AuditPayload } from "./audit";

const DAY_SEC = 86_400;
const OPS_TIMEOUT_MS = 5_000;

/** The reserve reporter's latest snapshot from ops `/reserve` (the same ops the status page reads). */
async function readReserve(): Promise<AuditPayload["reserve"]> {
  const base = webEnv.markets.priceFeedUrl;
  if (!base) return { ok: false, why: "ops is not configured on this deployment" };
  try {
    const r = await fetch(`${base.replace(/\/$/, "")}/reserve`, { cache: "no-store", signal: AbortSignal.timeout(OPS_TIMEOUT_MS) });
    if (!r.ok) return { ok: false, why: `ops /reserve answered ${r.status}` };
    const parsed = reserveSchema.safeParse(await r.json());
    return parsed.success ? { ok: true, value: parsed.data } : { ok: false, why: "no reserve snapshot yet" };
  } catch {
    return { ok: false, why: "ops /reserve is unreachable" };
  }
}

/** The whole auditor view; each part fails on its own, never the page. */
export async function readAudit(nowMs = Date.now()): Promise<AuditPayload> {
  const sql = getDb();
  const [venue, reserve, recount] = await Promise.all([
    sql
      ? venueStats(sql, Math.floor(nowMs / 1000) - DAY_SEC, Math.floor(nowMs / 1000))
          .then((v) => ({
            windows: v.windows, resolved: v.resolved, voided: v.voided, publicWindows: v.public_windows, withheldWindows: v.withheld_windows,
            trades: v.trades, volumeBase: v.volume_base, feesBase: v.fees_base, payoutsBase: v.payouts_base, floor: K_ANON_FLOOR,
          }))
          .catch(() => null)
      : Promise.resolve(null),
    readReserve(),
    sql
      ? latestRecount(sql)
          .then((row) => {
            if (!row) return null;
            const parsed = recountSchema.safeParse({ ...(row.report as object), atMs: row.atMs, offset: row.offset, ok: row.ok });
            return parsed.success ? parsed.data : null;
          })
          .catch(() => null)
      : Promise.resolve(null),
  ]);
  return { checkedAtMs: nowMs, venue, reserve, recount };
}
