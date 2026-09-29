/**
 * source-probe (C6): asks each attested lane's original source, every few minutes, whether it can be read here, and
 * writes the answer to the source-health store the roller lists by. A lane whose source is down reads
 * `paused: no signed source (<why>)` instead of opening a Window it could not settle ("no dead lane is ever shown").
 *
 *   redstone     the gateway's latest packages answer (keyless)
 *   pyth         Hermes latest for an equity feed with `PYTH_API_KEY` (401 without a key, 403 when not entitled)
 *   pyth-index   the S20 entitlement store: usable only while the key reads a valuation index
 *   switchboard  a Surge simulation of the first pinned xStock feed on the crossbar
 *   prestocks    the running catalogue feed has a read in the last 60 s (else one direct catalogue read)
 *   basket       as prestocks: a basket index is computed from the same catalogue reads
 */
import { ATTESTED_SOURCE_LABEL, PRE_IPO_TICKERS, type AttestedSource } from "@agari/core/market";
import { fetchPreStocks } from "@agari/markets/ops/prints";
import { runActor } from "../../runtime/actor";
import { errorText } from "../../runtime/env";
import { heartbeats } from "../../runtime/heartbeat";
import type { PythEntitlementStore } from "../../runtime/pyth-entitlement";
import type { SourceHealthStore, SourceState } from "../../runtime/source-health";
import { currentPreStocksSpot } from "../../prices/prestocks-spot";
import { SWITCHBOARD_CROSSBAR, surgeValueOf } from "../../prices/attested-read";
import { HERMES } from "../price-relay/hermes-fetch";
const REDSTONE_LATEST_PATH = "/data-packages/latest/redstone-primary-prod";
import type { RelaySources } from "../price-relay/sources";

export const PROBE_EVERY_MS = 5 * 60_000;
/** A source found down is asked again after a minute, so a lane resumes soon after its source does. */
export const PROBE_RETRY_MS = 60_000;
const PROBED: readonly AttestedSource[] = ["redstone", "pyth", "pyth-index", "switchboard", "prestocks", "basket"];

export interface ProbeContext {
  sources: Pick<RelaySources, "gateways" | "pythFeeds">;
  pythKey?: string;
  pythIndex: Pick<PythEntitlementStore, "hasKey" | "feeds">;
  switchboardFeeds: ReadonlyMap<string, string>;
  fetchImpl?: typeof fetch;
  nowSec?: () => number;
}

const short = (text: string, n = 140) => (text.length > n ? `${text.slice(0, n)}…` : text);

async function check(source: AttestedSource, ctx: ProbeContext): Promise<{ ok: boolean; reason: string | null }> {
  const fetchImpl = ctx.fetchImpl ?? fetch;
  switch (source) {
    case "redstone": {
      const failures: string[] = [];
      for (const gateway of ctx.sources.gateways) {
        try {
          const res = await fetchImpl(`${gateway}${REDSTONE_LATEST_PATH}`, { signal: AbortSignal.timeout(20_000) });
          if (res.ok && (await res.text()).startsWith("{")) return { ok: true, reason: null };
          failures.push(`HTTP ${res.status} from ${new URL(gateway).origin}`);
        } catch (error) {
          failures.push(`${new URL(gateway).origin}: ${errorText(error)}`);
        }
      }
      return { ok: false, reason: short(`RedStone gateways failed (${failures.join("; ") || "none configured"})`) };
    }
    case "pyth": {
      if (!ctx.pythKey) return { ok: false, reason: "PYTH_API_KEY is not set: Pyth Hermes answers 401 without a key" };
      const feed = ctx.sources.pythFeeds[0]?.feedIdHex;
      if (!feed) return { ok: false, reason: "no Pyth equity feed configured" };
      const res = await fetchImpl(`${HERMES}/v2/updates/price/latest?ids[]=${feed}&parsed=true`, { headers: { Authorization: `Bearer ${ctx.pythKey}` }, signal: AbortSignal.timeout(10_000) });
      if (res.ok) return { ok: true, reason: null };
      const body = short(await res.text().catch(() => ""), 80);
      return { ok: false, reason: res.status === 401 || res.status === 403 ? `Pyth Hermes refused the key (HTTP ${res.status}${body ? `: ${body}` : ""})` : `Pyth Hermes HTTP ${res.status}` };
    }
    case "pyth-index": {
      if (!ctx.pythIndex.hasKey) return { ok: false, reason: "Pyth feed not entitled (no PYTH_API_KEY)" };
      return ctx.pythIndex.feeds().some((f) => f.state === "entitled") ? { ok: true, reason: null } : { ok: false, reason: "Pyth feed not entitled" };
    }
    case "switchboard": {
      const [surge, feedHash] = [...ctx.switchboardFeeds.entries()][0] ?? [];
      if (!feedHash) return { ok: false, reason: "no Switchboard feed pinned" };
      const res = await fetchImpl(`${SWITCHBOARD_CROSSBAR}/simulate/${feedHash}`, { signal: AbortSignal.timeout(10_000) });
      const v = res.ok ? surgeValueOf(await res.text()) : { error: `crossbar HTTP ${res.status}` };
      return "error" in v ? { ok: false, reason: `Switchboard Surge ${surge}: ${short(v.error, 100)}` } : { ok: true, reason: null };
    }
    case "prestocks":
    case "basket": {
      const feed = currentPreStocksSpot();
      if (feed && PRE_IPO_TICKERS.some((s) => feed.latest(s, 60) !== null)) return { ok: true, reason: null };
      // The running feed is the reading; a second direct request would only add to PreStocks' rate limit (429).
      const beat = heartbeats().find((b) => b.actor === "prestocks-spot");
      if (feed) return { ok: false, reason: short(`no PreStocks catalogue read in the last 60 s${beat?.lastWhy ? ` (${beat.lastWhy})` : ""}`) };
      try {
        await fetchPreStocks({ fetchImpl });
        return { ok: true, reason: null };
      } catch (error) {
        return { ok: false, reason: short(`PreStocks catalogue: ${errorText(error)}`) };
      }
    }
    default:
      return { ok: true, reason: null };
  }
}

/** Probes every source once and writes the store; returns a log line. */
export async function probeAll(store: SourceHealthStore, ctx: ProbeContext): Promise<string> {
  const nowSec = (ctx.nowSec ?? (() => Math.floor(Date.now() / 1000)))();
  const results = await Promise.all(
    PROBED.map(async (source): Promise<[AttestedSource, SourceState]> => {
      try {
        return [source, { ...(await check(source, ctx)), checkedAtSec: nowSec }];
      } catch (error) {
        const text = errorText(error);
        const why = /abort|timeout/i.test(text) ? `${ATTESTED_SOURCE_LABEL[source]} did not answer within 10 s` : `${ATTESTED_SOURCE_LABEL[source]}: ${text}`;
        return [source, { ok: false, reason: short(why), checkedAtSec: nowSec }];
      }
    }),
  );
  for (const [source, state] of results) store.set(source, state);
  return results.map(([s, st]) => (st.ok ? `${s} ok` : `${s} down (${st.reason})`)).join(" · ");
}

export function startSourceProbe(store: SourceHealthStore, ctx: ProbeContext, log: (why: string) => void): { stop: () => void } {
  return runActor({
    name: "source-probe",
    log,
    dryRun: false,
    everyMs: PROBE_EVERY_MS,
    pass: async () => {
      const why = await probeAll(store, ctx);
      const anyDown = Object.values(store.all()).some((st) => !st?.ok);
      return { why, detail: { sources: store.all() }, nextDelayMs: anyDown ? PROBE_RETRY_MS : PROBE_EVERY_MS };
    },
  });
}
