/**
 * Canned private calls for `/dev/private` (C8d, L-39): the seat's own legs tagged private, as `/api/private/balance`
 * serves them from the projection — one open, one settled and won by the 0.5.1 engine (waiting for Cash out), one lost,
 * one already home; then, from abu-pm-main 0.5.2 (C2e, K-315), a win, a loss and a void the settle paid straight into the
 * private bucket (their receipt names it).
 */
import type { PrivatePosition } from "@agari/core/private";

export const FIXTURE_SYMBOL = "credits";
const NOW_SEC = 1_791_270_000;

const base = { asset: "BTC", intervalSec: 300, lots: "8", openedUpdateId: "1220aa", result: null, payoutBase: null } as const;

export const POSITIONS: PrivatePosition[] = [
  { ...base, pairId: "6f1c2a10-0001-4000-8000-000000000001", marketId: "BTC-5m:31", expirySec: NOW_SEC + 240, side: "up", costBase: "4120000", status: "open", openedAtSec: NOW_SEC - 50 },
  { ...base, pairId: "6f1c2a10-0002-4000-8000-000000000002", marketId: "BTC-5m:30", expirySec: NOW_SEC - 60, side: "down", costBase: "3980000", status: "settled", result: "won", payoutBase: "8000000", openedAtSec: NOW_SEC - 420 },
  { ...base, asset: "ETH", pairId: "6f1c2a10-0003-4000-8000-000000000003", marketId: "ETH-5m:29", expirySec: NOW_SEC - 400, side: "up", costBase: "2050000", status: "credited", result: "lost", payoutBase: "0", openedAtSec: NOW_SEC - 700 },
  { ...base, pairId: "6f1c2a10-0004-4000-8000-000000000004", marketId: "BTC-60m:12", intervalSec: 3600, expirySec: NOW_SEC - 3000, side: "up", costBase: "5100000", status: "credited", result: "won", payoutBase: "9000000", openedAtSec: NOW_SEC - 6000 },
  { ...base, pairId: "6f1c2a10-0005-4000-8000-000000000005", marketId: "BTC-5m:28", expirySec: NOW_SEC - 700, side: "up", costBase: "4700000", status: "credited", result: "won", payoutBase: "10000000", paidInto: "private", openedAtSec: NOW_SEC - 1000 },
  { ...base, asset: "ETH", pairId: "6f1c2a10-0006-4000-8000-000000000006", marketId: "ETH-5m:27", expirySec: NOW_SEC - 1000, side: "down", costBase: "2600000", status: "credited", result: "lost", payoutBase: "0", paidInto: "private", openedAtSec: NOW_SEC - 1300 },
  { ...base, pairId: "6f1c2a10-0007-4000-8000-000000000007", marketId: "BTC-5m:26", expirySec: NOW_SEC - 1300, side: "down", costBase: "3100000", status: "credited", result: "void", payoutBase: "3100000", paidInto: "private", openedAtSec: NOW_SEC - 1600 },
];
