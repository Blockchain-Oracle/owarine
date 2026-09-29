import { crowdFlow, type Db } from "@agari/db";
import type { SentimentReading } from "@/features/news/protocol";

/** Spec §1.5 (Q-S13-1): the last hour of flow; below 20 fills the share is not a reading. */
export const CROWD_WINDOW_SEC = 3_600;
export const CROWD_MIN_FILLS = 20;

const BPS = 10_000n;

/**
 * On Canton the flow is opt-in publications only (privacy-thesis.md §5; plan: `/api/sentiment` with the k = 5 floor):
 * the Up share of published lots in the last hour. `crowdFlow` answers null below 5 distinct publishers, so a reading
 * never describes one or two people. Lots are summed as NUMERIC and read back as decimal strings.
 */
export async function readCrowd(sql: Db, nowSec: number): Promise<SentimentReading> {
  const row = await crowdFlow(sql, nowSec - CROWD_WINDOW_SEC);
  const fills = row?.fills ?? 0;
  const up = BigInt(row?.up_lots ?? "0");
  const total = up + BigInt(row?.down_lots ?? "0");
  // Integer bps, rounded half up: (up × 10⁴ + total/2) / total.
  const upBps = fills >= CROWD_MIN_FILLS && total > 0n ? Number((up * BPS * 2n + total) / (total * 2n)) : null;
  return { upBps, fills, windowSec: CROWD_WINDOW_SEC, asOfSec: nowSec };
}
