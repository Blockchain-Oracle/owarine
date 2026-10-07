/**
 * halt-watch (session-lanes.md §3.1, D-057): a lane is halted when the signed price it settles on stops being printable
 * (C6f: judged on the source the lane's newest policy version names, the same table the bootstrap registers the Series
 * from). RedStone staleness for the seven single names, Alpaca last-trade age for QQQ and VOO, PreStocks read age for the
 * pre-IPO names and baskets, the xStocks issuer flag and Jupiter quote failures for the token lane, and Pyth's confidence
 * and staleness only for a lane whose primary is Pyth (none today, so Hermes is never called) → the process's halt board.
 * It is the board's only writer and never signs: the roller lists nothing for a halted asset, the maker pulls, the ticket
 * shows `halted`, and an open Window voids by itself. Crypto is not covered.
 *
 * Stock lanes are watched in regular hours only (after a short boot grace, so a source not yet read isn't a halt);
 * the 24/7 lanes always. A change needs two observations in a row (the issuer flag one), so one late tick or one failed
 * read never flips a lane. `HALT_WATCH_FIXTURE=<json>` injects raw observations for a proof run (`fixture.ts`).
 */
import { HALT_ASSETS, haltLabel, primarySourceAt, TICKER_SYMBOLS, XSTOCK_SYMBOLS } from "@owarine/core/market";
import { currentPreStocksSpot, PRESTOCKS_BOOT_SPREAD_MS } from "../../prices/prestocks-spot";
import { runActor, type PassResult, type VenueDeps } from "../../runtime";
import { alpacaKeys } from "../price-relay";
import { loadRelaySources } from "../price-relay/sources";
import { emptyHaltState, observeHalts, pythFeedsToRead, stepHalts, type Observations } from "./decide";
import { applyFixture, loadHaltFixture } from "./fixture";
import { quoteFailureStreak } from "./quote-failures";
import {
  ALPACA_OWN_READ_MS, emptySignals, followSpot, ISSUER_READ_MS, loadSourceVersions, prestocksNewest, readAlpaca, readIssuer, readPyth, readRedstone, REDSTONE_OWN_READ_MS,
} from "./signals";

const PASS_MS = 5_000;
/** Seconds after boot before an unread stock source can halt: the spot feed's first RedStone read lands within ≈ 5 s. */
const BOOT_GRACE_SEC = 20;
/** The PreStocks feed's first read waits up to its boot spread (15 s) and one fetch; nothing pre-IPO can halt before it. */
const PRESTOCKS_BOOT_GRACE_SEC = Math.ceil(PRESTOCKS_BOOT_SPREAD_MS / 1000) + BOOT_GRACE_SEC;
const IN_HOURS = new Set(["regular", "early-close", "halted"]);

const hhmmss = (sec: number) => new Date(sec * 1000).toISOString().slice(11, 19);

export async function startHaltWatch(deps: VenueDeps): Promise<{ stop: () => void }> {
  const sources = loadRelaySources();
  const versions = loadSourceVersions();
  const pythKey = process.env.PYTH_API_KEY || undefined;
  const alpaca = alpacaKeys();
  const fixture = loadHaltFixture(process.env.HALT_WATCH_FIXTURE);
  const startedSec = Math.floor(Date.now() / 1000);
  const book = emptySignals();
  const state = emptyHaltState();
  const unfollow = deps.spot ? followSpot(book, deps.spot) : null;
  let redstoneReadMs = 0;
  let alpacaReadMs = 0;
  let issuerReadMs = 0;
  if (fixture) deps.log(`FIXTURE ${fixture.name}: injected observations replace live ones for the assets it names`);

  const pass = async (): Promise<PassResult> => {
    const calendarNote = await deps.sessions.refresh();
    const nowSec = Math.floor(Date.now() / 1000);
    const status = deps.sessions.status(nowSec);
    const inHours = fixture?.session === "regular" || (status !== null && IN_HOURS.has(status.state));
    const watchingStocks = inHours && nowSec - startedSec >= BOOT_GRACE_SEC;
    // The PreStocks catalogue is read by the process's own feed (a second reader would only add to its rate limit); a
    // process without one has nothing to judge the pre-IPO lanes on.
    const prestocks = currentPreStocksSpot();
    const watchingPrestocks = prestocks !== null && nowSec - startedSec >= PRESTOCKS_BOOT_GRACE_SEC;

    // The source each lane settles on now, from the table the bootstrap registers the Series from.
    const primary = Object.fromEntries(HALT_ASSETS.map((asset) => [asset, primarySourceAt(versions[asset] ?? [], nowSec)]));
    const settlingOn = (source: string) => TICKER_SYMBOLS.filter((symbol) => primary[symbol] === source);

    book.problems = [];
    const reads: Promise<void>[] = [];
    if (inHours) {
      // Hermes only for the feeds of lanes whose primary is Pyth: none today, so normally no Pyth call is made at all.
      reads.push(readPyth(book, pythFeedsToRead(sources.pythFeeds, primary), pythKey));
      if (!deps.spot && Date.now() - redstoneReadMs >= REDSTONE_OWN_READ_MS) {
        redstoneReadMs = Date.now();
        reads.push(readRedstone(book, sources));
      }
      if (!deps.spot && Date.now() - alpacaReadMs >= ALPACA_OWN_READ_MS) {
        alpacaReadMs = Date.now();
        reads.push(readAlpaca(book, settlingOn("alpaca"), alpaca ?? null));
      }
    }
    if (Date.now() - issuerReadMs >= ISSUER_READ_MS) {
      issuerReadMs = Date.now();
      reads.push(readIssuer(book));
    }
    await Promise.all(reads);
    if (prestocks) book.prestocksNewestSec = prestocksNewest(prestocks.snapshots());

    const observations: Observations = {
      nowSec,
      inRegularHours: watchingStocks,
      watchingPrestocks,
      primary,
      pyth: { ...book.pyth },
      redstoneNewestSec: { ...book.redstoneNewestSec },
      alpacaNewestSec: { ...book.alpacaNewestSec },
      prestocksNewestSec: { ...book.prestocksNewestSec },
      issuer: { ...book.issuer },
      quoteFailures: Object.fromEntries(XSTOCK_SYMBOLS.map((x) => [x, quoteFailureStreak(x)])),
    };
    if (fixture) applyFixture(observations, fixture);
    const observed = observeHalts(observations);
    const confirmed = stepHalts(state, observed, observations.inRegularHours);
    for (const [asset, reason] of confirmed) {
      if (reason) deps.halts.set(asset, reason, nowSec);
      else deps.halts.clear(asset);
    }

    const board = deps.halts.board();
    const halted = HALT_ASSETS.flatMap((a) => (board[a] ? [`${a} ${board[a]!.reason} since ${hhmmss(board[a]!.sinceSec)}Z`] : []));
    const session = status?.state ?? "no calendar";
    const stocks = watchingStocks ? "stocks watched" : inHours ? "stocks: boot grace" : `stocks idle (${session})`;
    const preIpo = prestocks === null ? "PreStocks lanes unwatched (no feed in this process)" : watchingPrestocks ? null : "PreStocks lanes: boot grace";
    const issuerRead = XSTOCK_SYMBOLS.filter((x) => book.issuer[x] !== undefined).length;
    const problems = [...new Set(book.problems)];
    const why = [
      halted.length ? `halted: ${halted.join(", ")}` : "no halts",
      stocks,
      ...(preIpo ? [preIpo] : []),
      `issuer flags ${issuerRead}/${XSTOCK_SYMBOLS.length}`,
      ...(fixture ? [`FIXTURE ${fixture.name}`] : []),
      ...(calendarNote === "calendar fresh" ? [] : [calendarNote]),
      ...problems,
    ].join(" · ");
    const ages = (times: Partial<Record<string, number>>) => Object.fromEntries(Object.entries(times).map(([k, t]) => [k, nowSec - (t ?? nowSec)]));
    return {
      why,
      detail: {
        halts: board,
        labels: Object.fromEntries(Object.entries(board).map(([a, e]) => [a, haltLabel(e!.reason)])),
        session,
        watchingStocks,
        watchingPrestocks,
        // The source each covered lane is judged on now (an asset with none is absent: paused, never halted).
        settlesOn: Object.fromEntries(Object.entries(primary).filter(([, source]) => source !== null)),
        observed: Object.fromEntries(Object.entries(observed).filter(([, r]) => r !== null)),
        pending: Object.fromEntries([...state.streaks].filter(([, s]) => s !== null)),
        pythAgeSec: ages(Object.fromEntries(Object.entries(observations.pyth).map(([s, t]) => [s, t!.publishTimeSec]))),
        pythConfBps: Object.fromEntries(Object.entries(observations.pyth).map(([s, t]) => [s, t!.price > 0n ? Number((t!.conf * 10_000n) / t!.price) : null])),
        redstoneAgeSec: ages(observations.redstoneNewestSec),
        alpacaAgeSec: ages(observations.alpacaNewestSec),
        prestocksAgeSec: ages(observations.prestocksNewestSec),
        issuer: observations.issuer,
        quoteFailures: observations.quoteFailures,
        redstoneFrom: deps.spot ? "spot feed" : "own read",
        alpacaFrom: deps.spot ? "spot feed" : alpaca ? "own read" : "no keys",
        fixture: fixture?.name ?? null,
        problems,
      },
    };
  };

  const actor = runActor({ name: "halt-watch", log: deps.log, dryRun: false, everyMs: PASS_MS, pass });
  return {
    stop: () => {
      unfollow?.();
      actor.stop();
    },
  };
}
