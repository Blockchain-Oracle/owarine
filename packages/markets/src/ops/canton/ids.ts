/**
 * The venue actors' command ids. Each is stable per logical action, so a crash-retry is deduplicated by the
 * participant instead of executing twice (plan §8). `open:`, `print:` and `resolve:` come from `@agari/ledger`; the
 * rest are built here with the same rules (ledger strings, no `.`, `:` only as the separator).
 *
 * Party ids contain `::`, and a batch is a set of contract ids, so both enter an id as a short sha-256 digest.
 */
import { createHash } from "node:crypto";
import { assertCommandId, openWindowCommandId, printCommandId, resolveCommandId } from "@agari/ledger";

export { openWindowCommandId, printCommandId, resolveCommandId };

/** 32 hex chars of sha-256 over the parts joined by newlines: order-sensitive, so sort a set before hashing. */
export const digest = (...parts: readonly string[]): string => createHash("sha256").update(parts.join("\n")).digest("hex").slice(0, 32);

const safe = (s: string, what: string): string => {
  if (!/^[A-Za-z0-9_\-/# ]+$/.test(s)) throw new Error(`${what} ${JSON.stringify(s)} cannot enter a command id`);
  return s;
};

/** `skip:<series>:<toIndex>`: `Series_SkipTo` after downtime. */
export const skipToCommandId = (series: string, toIndex: number) => assertCommandId(`skip:${safe(series, "series")}:${toIndex}`);

/** `openprint:<termsCid>`: `Terms_RecordOpen` for one Window (at most one ever lands: it consumes the WindowState). */
export const recordOpenCommandId = (termsCid: string) => assertCommandId(`openprint:${safe(termsCid, "termsCid")}`);

/** `quote:<requestId>`: one issuer request (the web's journal id when it sends one). */
export const quoteCommandId = (requestId: string) => assertCommandId(`quote:${safe(requestId, "requestId")}`);

/** `expire:<quoteCid>`: the sweeper's `Quote_Expire`. */
export const expireCommandId = (quoteCid: string) => assertCommandId(`expire:${safe(quoteCid, "quoteCid")}`);

/** `settle:<digest(resolution, sorted legs)>`: one `Desk_SettleBatch`; the same batch retried is the same id. */
export const settleBatchCommandId = (resolutionCid: string, legCids: readonly string[]) => assertCommandId(`settle:${digest(resolutionCid, ...[...legCids].sort())}`);

/** `residual:<residualCid>`: `Residual_Settle`. */
export const residualCommandId = (residualCid: string) => assertCommandId(`residual:${safe(residualCid, "residualCid")}`);

/** `merge:<digest(sorted cash cids)>`: the rebalancer's `VenueCash_Merge`. */
export const mergeCashCommandId = (cids: readonly string[]) => assertCommandId(`merge:${digest(...[...cids].sort())}`);

/** `split:<cashCid>`: the rebalancer's `VenueCash_Split` of one oversized shard. */
export const splitCashCommandId = (cid: string) => assertCommandId(`split:${safe(cid, "cashCid")}`);

/** `net:<digest(legA, legB)>`: the netting job's `Leg_Merge`. */
export const netLegsCommandId = (a: string, b: string) => assertCommandId(`net:${digest(...[a, b].sort())}`);

/** `retire:<oracle>:<beforeEpochSec>`: an oracle archiving its old quotes. */
export const retireCommandId = (oracle: string, beforeSec: number) => assertCommandId(`retire:${safe(oracle, "oracle")}:${beforeSec}`);

/** `invite:<digest(party)>` / `account:<digest(party)>`: a seat's VenueAccount, once per party. */
export const inviteCommandId = (party: string) => assertCommandId(`invite:${digest(party)}`);
export const acceptAccountCommandId = (party: string) => assertCommandId(`account:${digest(party)}`);

/** `credit:<digest(party)>:<leaseId>`: one demo-credit grant per seat lease. */
export const creditCommandId = (party: string, leaseId: string) => assertCommandId(`credit:${digest(party)}:${safe(leaseId, "leaseId")}`);
