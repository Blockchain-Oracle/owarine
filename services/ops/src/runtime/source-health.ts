/**
 * Whether each attested print source can sign here and now (C6, plan "Prices and lanes"). Every lane on Canton settles
 * on prints our oracle parties attest, and each print names its original source (core `parsePrintSource`). A lane
 * whose source cannot be read must not list a Window it could not settle: the roller asks this store and, when the
 * source is down, reports the reference's honest state with the reason, `paused: no signed source (<why>)`.
 *
 * Written only by the `source-probe` actor (one probe per source every few minutes; see `probeSource`), read by the
 * roller, the lane feeders and `/session`. A source that has not been probed yet is not usable: nothing lists on a
 * guess. Crypto's exchanges and the committee need no probe (the feeders themselves are the reading).
 */
import { parsePrintSource, type AttestedSource } from "@owarine/core/market";

export interface SourceState {
  ok: boolean;
  /** Why not, in words a lane card can show; null when ok. */
  reason: string | null;
  checkedAtSec: number;
}

export interface SourceHealthStore {
  set(source: AttestedSource, state: SourceState): void;
  get(source: AttestedSource): SourceState | null;
  all(): Partial<Record<AttestedSource, SourceState>>;
  /** Why the source a `printSource` names cannot sign now, or null when it can. An unparseable text is refused. */
  unavailable(printSource: string): string | null;
}

/** Sources that need no probe: the crypto feeders read their exchanges directly; a committee attests by hand. */
const ALWAYS_READY: ReadonlySet<AttestedSource> = new Set(["exchanges", "committee"]);

export function createSourceHealthStore(): SourceHealthStore {
  const states = new Map<AttestedSource, SourceState>();
  return {
    set: (source, state) => void states.set(source, state),
    get: (source) => states.get(source) ?? null,
    all: () => Object.fromEntries(states),
    unavailable(printSource) {
      const parts = parsePrintSource(printSource);
      if (!parts) return `unknown print source "${printSource}"`;
      if (ALWAYS_READY.has(parts.source)) return null;
      const state = states.get(parts.source);
      if (!state) return `${parts.source} not checked yet`;
      return state.ok ? null : (state.reason ?? `${parts.source} unavailable`);
    },
  };
}
