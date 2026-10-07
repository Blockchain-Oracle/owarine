/**
 * C6e source check, no ledger (K-070): what ops' keys unlock, read the way the oracle parties read it.
 *
 *   1. Calendar. The session service (Alpaca ∩ Pyth schedule) with the keys ops now loads itself: the session state and
 *      the next sessions, the label a Regular lane shows.
 *   2. Monday Gap. The roller's own planner (`planGapSeries`) on that agreed calendar for TSLA (RedStone) and QQQ/VOO
 *      (the new Alpaca version): the real next Gap and when it lists.
 *   3. Prints. At the next minute boundary T, the attested reader (`createAttestedReader`, the lane feeders' own) reads
 *      QQQ and VOO from Alpaca (last IEX trade in [T − 300, T]), TSLA from RedStone, and the four xStocks as the Jupiter
 *      median of T − 40 / T − 20 / T from a live xStock feed. Each line gives the price and the payload's sha-256, as the
 *      `PriceQuote.payloadHash` would.
 *
 *   pnpm --filter @owarine/scripts exec tsx drive/c6e-sources.ts
 */
import { loadedEnvFiles } from "../../services/ops/src/runtime/load-env";
import { createHash } from "node:crypto";
import { attestedPrintSource, parsePrintSource, sessionLabel, XSTOCK_SYMBOLS } from "@owarine/core/market";
import { createSessionService } from "../../services/ops/src/calendar/session-service";
import { alpacaKeys } from "../../services/ops/src/actors/price-relay";
import { loadRelaySources, loadSwitchboardFeeds } from "../../services/ops/src/actors/price-relay/sources";
import { planGapSeries, gapSpanOf } from "../../services/ops/src/actors/window-roller/plan-gap";
import type { PlanClock, PlanSeries } from "../../services/ops/src/actors/window-roller/plan";
import type { VersionWindow } from "../../services/ops/src/actors/window-roller/versions";
import { createAttestedReader } from "../../services/ops/src/prices/attested-read";
import { createXStockSpotFeed } from "../../services/ops/src/prices/xstock-spot";

const iso = (sec: number) => new Date(sec * 1000).toISOString().replace(".000", "");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const sha = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
const nowSec = () => Math.floor(Date.now() / 1000);

console.log(`env files: ${loadedEnvFiles.map((f) => `${f.path.split("/").slice(-3).join("/")} (${f.taken.length} names)`).join(", ") || "none"}`);

// 1. Calendar
const sessions = createSessionService();
console.log(`calendar: ${await sessions.refresh(true)}`);
const status = sessions.status(nowSec());
console.log(`session now: ${status ? sessionLabel(status) : "no calendar"}`);
for (const s of sessions.calendar()?.sessions.filter((x) => x.closeSec > nowSec()).slice(0, 5) ?? []) console.log(`  ${s.date} ${iso(s.openSec)} → ${iso(s.closeSec)}${s.earlyClose ? " (early close)" : ""}`);

// 2. Gap
const ADMIT_UNTIL_LOCK = 0xffff_ffff;
const version = (fromIso: string, untilIso: string | null, printSource: string): VersionWindow => ({
  validFromSec: Date.parse(fromIso) / 1000, validUntilSec: untilIso ? Date.parse(untilIso) / 1000 : null, primarySource: 4, checkSource: 0,
  openAdmissionSec: ADMIT_UNTIL_LOCK, checkAdmissionSec: 0, primaryFeedIdHex: "", printSource,
});
const gapVersions: Record<string, VersionWindow[]> = {
  TSLA: [version("2026-09-11T00:00:00Z", "2026-09-25T20:00:00Z", "attested:pyth:16dad506"), version("2026-09-25T20:00:00Z", null, attestedPrintSource("redstone", "TSLA"))],
  QQQ: [version("2026-09-11T00:00:00Z", "2026-09-25T20:00:00Z", "attested:pyth:9695e2b9"), version("2026-09-29T00:00:00Z", null, attestedPrintSource("alpaca", "QQQ"))],
  VOO: [version("2026-09-11T00:00:00Z", "2026-09-25T20:00:00Z", "attested:pyth:236b30dd"), version("2026-09-29T00:00:00Z", null, attestedPrintSource("alpaca", "VOO"))],
};
const clock: PlanClock = {
  calendar: sessions.calendar(), nowSec: nowSec(), leadSec: 120, gapLeadSec: 172_800, minTradableSec: 60, skips: [], multipliers: [], halts: {}, prelist: true,
  prelistCadencesSec: [300, 900, 3_600], pythUsable: () => false,
};
for (const [symbol, versions] of Object.entries(gapVersions)) {
  const series: PlanSeries = { key: `${symbol}-gap`, symbol: symbol as PlanSeries["symbol"], cadenceSec: 604_800, maxLeadSec: 7 * 86_400, nextIndex: 0n, lastExpirySec: nowSec() - 86_400, versions, freeBooks: ["-"] };
  const plan = planGapSeries(series, clock);
  const v = "policyVersion" in plan ? ` on v${(plan as { policyVersion: number }).policyVersion + 1} ${versions[(plan as { policyVersion: number }).policyVersion]!.printSource}` : "";
  console.log(`gap ${symbol}: ${plan.kind} · ${"window" in plan && plan.window ? gapSpanOf(plan.window) : ""} · ${"state" in plan ? plan.state : ""}${v}`);
}

// 3. Prints at the next boundary
const xstock = createXStockSpotFeed({ log: () => {}, apiKey: process.env.JUPITER_API_KEY || undefined });
xstock.start();
const reader = createAttestedReader({ sources: loadRelaySources(), switchboardFeeds: loadSwitchboardFeeds(), prestocks: () => null, alpaca: alpacaKeys(), xstock: () => xstock });
// The Jupiter median needs samples from T − 40: wait for a boundary at least 45 s after the feed starts.
let T = Math.ceil((nowSec() + 45) / 60) * 60;
console.log(`boundary T = ${iso(T)}; reading at T + 12 s`);
while (nowSec() < T + 12) await sleep(1_000);
const feeds = [attestedPrintSource("alpaca", "QQQ"), attestedPrintSource("alpaca", "VOO"), attestedPrintSource("redstone", "TSLA"), ...XSTOCK_SYMBOLS.map((x) => attestedPrintSource("jupiter", x))];
for (const printSource of feeds) {
  const parts = parsePrintSource(printSource)!;
  const slot = { boundarySec: T, earliestSec: T + 5, deadlineSec: T + (parts.source === "jupiter" ? 60 : 900) };
  const out = await reader.read(parts, slot, nowSec());
  if (out.kind === "ok") console.log(`print ${printSource} @${iso(T)}: ${(Number(out.read.priceE8) / 1e8).toFixed(4)} (${out.read.note}; payload sha-256 ${sha(out.read.payload).slice(0, 16)}…)`);
  else console.log(`print ${printSource} @${iso(T)}: ${out.kind}: ${"why" in out ? out.why : ""}`);
}
xstock.stop();
process.exit(0);
