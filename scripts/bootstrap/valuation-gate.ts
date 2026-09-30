/**
 * S20 (D-125) at registration (C8j.2): a valuation lane (OPENAIV, ANTHROPICV) is registered only while the venue's
 * Pyth key may read its index. The reference's `scripts/deploy/init-valuation-series.ts` probes first and refuses, with
 * no `--force`, because a Series on a feed the key cannot read would read as a lane and never settle: no dead lane is
 * ever shown. Here `--lanes …,valuation` is refused the same way before anything is written. The probe is ops' own
 * entitlement store, one Hermes request per index, alone; nothing is probed unless `valuation` is among the lanes.
 */
import { createPythEntitlementStore, describeFeed, type FeedEntitlement } from "../../services/ops/src/runtime/pyth-entitlement";

export interface ValuationGate {
  /** `valuation` was among the lanes. */
  requested: boolean;
  /** Every valuation index answered 200 (always true when not requested). */
  entitled: boolean;
  /** One line per index, as ops' heartbeat reads it (`OPENAI denied (403 pyth-indices)`); never the key. */
  lines: string[];
}

export async function valuationGate(lanes: ReadonlySet<string>, input: { key: string | undefined; fetch?: typeof globalThis.fetch }): Promise<ValuationGate> {
  if (!lanes.has("valuation")) return { requested: false, entitled: true, lines: [] };
  const store = createPythEntitlementStore({ key: input.key, log: () => undefined, ...(input.fetch ? { fetch: input.fetch } : {}) });
  const answers: FeedEntitlement[] = [];
  for (const feed of store.feeds()) answers.push(await store.probe(feed.feedIdHex));
  return { requested: true, entitled: answers.length > 0 && answers.every((f) => f.state === "entitled"), lines: answers.map(describeFeed) };
}

/** The refusal, in the reference script's words. */
export const valuationRefusal = (gate: ValuationGate): string =>
  `refusing --lanes valuation: the venue's Pyth key is not entitled to every valuation index (${gate.lines.join(" · ")}). ` +
  "Nothing registers while a feed is denied and there is no --force: a Series on a feed the key cannot read would read as a lane and never settle. " +
  "Run again without valuation, or once PYTH_API_KEY reads the pyth-indices group.";
