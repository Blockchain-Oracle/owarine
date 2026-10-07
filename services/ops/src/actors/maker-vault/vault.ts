/**
 * The maker vault in ops (`MAKER_MODE=vault`, abu-pm-main 0.5.0, K-092, K-200): one writer over the book.
 *
 *   pool       the `reserve:maker` shards: what the issuer locks a book quote or buy-back from, and what a provider's
 *              withdrawal is paid from (never the venue desk's shards)
 *   queue      every statement publish and every supply / withdraw quote runs on it, since each reads or consumes the
 *              one live `NavStatement`
 *   publish    `Maker_PublishNav` when the book's value or shares moved, or once a minute; the ledger recomputes it
 *   decide     whether the book takes a pair quote or an exit (`bookTakes`), else the venue desk does
 *   state      what `/api/ledger/tickets/state` serves as `maker`
 */
import { marketIdFromDaml } from "@owarine/core/market";
import { inactiveCids, isInactive, submit, templateSuffix, type RoleSession, type SubmitOutcome } from "@owarine/markets/ops/canton";
import { bcmd, bookTakes, bookWindows, makerNav, unsettledExpired, type BookWindow, type MakerSnapshot } from "@owarine/markets/ops/book";
import type { MakerParams } from "@owarine/core/maker";
import { TEMPLATE_IDS } from "@owarine/daml";
import type { LadderEntry } from "../market-maker/seat/ladder-board";
import { ShardPool } from "../quote-issuer/pool";
import { readMakerSnapshot } from "./state";
import type { MakerVaultEnv } from "./env";

/** A statement is republished at least this often even when nothing moved, so its `asOf` stays recent. */
export const MAKER_NAV_EVERY_SEC = 60;

export interface MakerVault {
  venue: RoleSession;
  env: MakerVaultEnv;
  pool: ShardPool;
  snap: MakerSnapshot | null;
  /** The live statement id (a publish replaces it before the next snapshot sees it). */
  navCid: string | null;
  log: (why: string) => void;
  lock<T>(fn: () => Promise<T>): Promise<T>;
  refresh(): Promise<MakerSnapshot>;
  /** Publishes the next statement when it is due (moved, or older than a minute, or `force`). On the queue. */
  publishNav(o?: { force?: boolean }): Promise<{ published: boolean; note: string }>;
  /** Whether the book takes this pair quote (the issuer asks before leasing). */
  takesQuote(entry: LadderEntry, q: { side: "up" | "down"; priceTicks: number; lots: bigint; stakeBase: bigint }): { take: boolean; why: string };
  /** Whether the book buys these legs back: only legs whose pair's other half the book holds, so it can net them. */
  takesExit(entry: LadderEntry, q: { side: "up" | "down"; pairIds: readonly string[]; priceTicks: number; lots: bigint; lockBase: bigint }): { take: boolean; why: string };
  /** Tells the book a write it took part in landed, so the next decision sees it. */
  touched(): void;
  state(): MakerStateWireOut | null;
}

/** What ops sends as `maker` in `/internal/tickets/state` (bigints as decimal strings on the wire). */
export interface MakerStateWireOut {
  navSeq: number;
  asOfMs: number;
  assetsBase: bigint;
  shares: bigint;
  liquidBase: bigint;
  deployedBase: bigint;
  paused: boolean;
  quoting: boolean;
  params: MakerParams;
  open: MakerWindowWireOut[];
  history: MakerWindowWireOut[];
  unsettledExpired: string | null;
}

export interface MakerWindowWireOut {
  marketId: string;
  escrowOutBase: bigint;
  escrowBackBase: bigint;
  mergedBase: bigint;
  payoutBase: bigint;
  openedAtSec: number;
  settledAtSec: number | null;
  quoteCount: number;
  settled: boolean;
  yesRaw: bigint;
  noRaw: bigint;
  deployedBase: bigint;
  realizedBase: bigint | null;
}

const HISTORY = 20;

const windowWire = (w: BookWindow): MakerWindowWireOut => ({
  marketId: marketIdFromDaml(w.marketId),
  escrowOutBase: w.escrowOutBase,
  escrowBackBase: w.escrowBackBase,
  mergedBase: w.mergedBase,
  payoutBase: w.payoutBase,
  openedAtSec: 0,
  settledAtSec: null,
  quoteCount: w.quoteCount,
  settled: w.settled,
  yesRaw: w.yesRaw,
  noRaw: w.noRaw,
  deployedBase: w.deployedBase,
  realizedBase: w.realizedBase,
});

export function createMakerVault(input: { venue: RoleSession; env: MakerVaultEnv; log: (why: string) => void }): MakerVault {
  let queue: Promise<unknown> = Promise.resolve();
  let writes = 0;
  const pool = new ShardPool({ venue: input.venue.party, maxWaitMs: 3_000, bucket: (b) => b === "reserve:maker" });
  const nowSec = () => Math.floor(Date.now() / 1000);

  const vault: MakerVault = {
    venue: input.venue,
    env: input.env,
    pool,
    snap: null,
    navCid: null,
    log: input.log,
    lock<T>(fn: () => Promise<T>): Promise<T> {
      const next = queue.catch(() => undefined).then(fn);
      queue = next.catch(() => undefined);
      return next;
    },
    async refresh() {
      const before = writes;
      const snap = await readMakerSnapshot(input.venue, (cid, error) => input.log(`undecodable ${cid.slice(0, 12)}…: ${String(error)}`));
      vault.snap = snap;
      // A publish that landed while this snapshot was read left a newer statement than the snapshot's.
      if (writes === before) vault.navCid = snap.nav?.cid ?? null;
      pool.sync(snap.cash);
      return snap;
    },
    publishNav(o = {}) {
      return vault.lock(async () => {
        const snap = await vault.refresh();
        const nav = snap.nav;
        if (!nav || !snap.deskCid || vault.navCid !== nav.cid) return { published: false, note: nav ? "no MakerDesk: run the bootstrap" : "no maker statement: run the bootstrap" };
        const now = nowSec();
        if (now < nav.data.asOfSec) return { published: false, note: "the live statement is dated ahead of this clock" };
        const v = makerNav(snap, now);
        const moved = v.assets !== nav.data.assets || v.shares !== nav.data.shares;
        if (!o.force && !moved && now - nav.data.asOfSec < MAKER_NAV_EVERY_SEC) return { published: false, note: "unchanged" };
        try {
          const out = await submit(input.venue, { commandId: `mnav:${nav.data.seq}`, commands: [bcmd.publishMakerNav(snap.deskCid, nav.cid, now, v.inputs)] });
          adopt(out);
          return { published: out.kind === "done", note: moved ? `maker NAV ${nav.data.assets}/${nav.data.shares} → ${v.assets}/${v.shares}` : "maker NAV restated" };
        } catch (error) {
          // Something the statement counts moved between the read and the publish: the next pass counts it.
          if (isInactive(error) && inactiveCids(error, [nav.cid]).length > 0) await vault.refresh();
          throw error;
        }
      });
    },
    takesQuote(entry, q) {
      const snap = vault.snap;
      if (!input.env.enabled || !snap?.nav || snap.nav.data.shares === 0n) return { take: false, why: "the vault is not quoting" };
      const views = bookWindows(snap, nowSec());
      const here = views.open.find((w) => w.marketId === entry.damlMarketId);
      const v = makerNav(snap, nowSec());
      const up = entry.up[0]?.[0] ?? null;
      const down = entry.down[0]?.[0] ?? null;
      const d = bookTakes({
        params: input.env.params, assets: input.env.assets, intervals: input.env.intervals, asset: entry.symbol, intervalSec: entry.expirySec - entry.tradingStartSec,
        side: q.side, priceTicks: q.priceTicks, lots: q.lots, cashUnit: entry.cashUnit, stakeBase: q.stakeBase, bestUpTicks: up, bestDownTicks: down,
        lockAtSec: entry.lockAtSec, nowSec: nowSec(), windowDeployedBase: here?.deployedBase ?? 0n, windowOpen: here !== undefined,
        openWindows: views.open.length, deployedBase: v.locked + v.positions, assetsBase: snap.nav.data.assets,
      });
      return d.take ? { take: true, why: "inside the vault's bounds" } : { take: false, why: d.why };
    },
    takesExit(entry, q) {
      const snap = vault.snap;
      if (!input.env.enabled || !snap?.nav || snap.nav.data.shares === 0n) return { take: false, why: "the vault is not quoting" };
      const bookPairs = new Set(snap.legs.filter((l) => l.data.termsCid === entry.termsCid).map((l) => l.data.pairId));
      if (!q.pairIds.every((p) => bookPairs.has(p))) return { take: false, why: "the book does not hold the other half" };
      // A buy-back is the book buying the held side: the same bounds as selling the other side at 1000 − price.
      return vault.takesQuote(entry, { side: q.side === "up" ? "down" : "up", priceTicks: 1000 - q.priceTicks, lots: q.lots, stakeBase: q.lockBase });
    },
    touched() {
      void vault.refresh().catch(() => undefined);
    },
    state() {
      const snap = vault.snap;
      if (!snap) return null;
      const now = nowSec();
      const nav = snap.nav;
      const v = makerNav(snap, now);
      const { open, history } = bookWindows(snap, now);
      const assets = nav?.data.assets ?? 0n;
      const liquid = v.liquid < assets ? v.liquid : assets;
      return {
        navSeq: nav?.data.seq ?? 0,
        asOfMs: (nav?.data.asOfSec ?? 0) * 1000,
        assetsBase: assets,
        shares: nav?.data.shares ?? 0n,
        liquidBase: liquid,
        deployedBase: assets - liquid,
        paused: !nav || !snap.deskCid,
        quoting: input.env.enabled,
        params: input.env.params,
        open: open.map(windowWire),
        history: history.slice(0, HISTORY).map(windowWire),
        unsettledExpired: (() => {
          const m = unsettledExpired(open, now);
          return m ? marketIdFromDaml(m) : null;
        })(),
      };
    },
  };

  function adopt(out: SubmitOutcome): void {
    if (out.kind !== "done") return;
    for (const e of out.created) {
      if (templateSuffix(e.templateId) === templateSuffix(TEMPLATE_IDS.NavStatement) && (e.createArgument as { reserveId?: unknown }).reserveId === "maker") {
        vault.navCid = e.contractId;
        writes++;
      }
    }
  }
  return vault;
}
