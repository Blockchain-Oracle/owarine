import { describe, expect, it } from "vitest";
import type { Active, LegC, NettedResidualC, QuoteC, ResolutionC, VenueCashC } from "../canton/decode";
import type { BookReceiptC } from "../canton/decode-book";
import { legBookOf } from "../canton/decode-book";
import type { LpShareC, NavStatementC } from "../tickets/decode";
import { legMark, makerNav, MAKER_BOOK, residualMark, type MakerSnapshot } from "./nav";
import { bookTakes, DEFAULT_MAKER_PARAMS, type BookQuoteInput } from "./policy";
import { bookWindows, unsettledExpired } from "./views";

const V = "venue::1";
const act = <T>(cid: string, data: T): Active<T> => ({ cid, data }) as Active<T>;
const leg = (o: Partial<LegC> = {}): LegC => ({
  venue: V, owner: V, termsCid: "t1", marketId: "BTC-300:1", pairId: "p1", outcome: "SideDown", lots: 5n, cashUnit: 1n, backingShare: 2000n, feePaid: 0n,
  refundAfterSec: 9_999, beneficiaryRef: MAKER_BOOK, bookCost: null, ...o,
});
const res = (outcome: ResolutionC["outcome"], termsCid = "t1"): ResolutionC =>
  ({ venue: V, resolver: "r", termsCid, marketId: "BTC-300:1", outcome, voidReason: null, openPriceE8: null, closePriceE8: null, openEvidence: [], closeEvidence: [], signers: 3 }) as ResolutionC;
const quote = (o: Partial<QuoteC> = {}): QuoteC => ({
  venue: V, user: "bob", termsCid: "t1", marketId: "BTC-300:1", pairId: "q1", side: "SideUp", priceTicks: 600, lots: 5n, cashUnit: 1n, fee: 0n,
  validUntilSec: 100, lockAtSec: 200, refundAfterSec: 900, book: MAKER_BOOK, ...o,
});

function snap(o: Partial<MakerSnapshot> = {}): MakerSnapshot {
  return {
    atMs: 0, nav: act<NavStatementC>("nav", { venue: V, auditor: "a", reserveId: "maker", seq: 1, asOfSec: 0, assets: 10_000n, shares: 10_000n }), deskCid: "desk",
    cash: [act<VenueCashC>("c1", { venue: V, owner: V, amount: 8_000n, bucket: MAKER_BOOK })],
    lpShares: [act<LpShareC>("lp", { venue: V, provider: "alice", reserveId: "maker", shares: 10_000n })],
    supplyQuotes: [], withdrawQuotes: [], quotes: [], buyQuotes: [], legs: [], residuals: [], receipts: [], resolutions: new Map(),
    markets: new Map([["t1", { marketId: "BTC-300:1", expirySec: 300 }]]),
    ...o,
  };
}

describe("the maker statement's mark (PM.Maker)", () => {
  it("counts a leg at cost, never above what its Resolution pays, and 0 once expired unresolved", () => {
    expect(legMark(leg(), 100, null, 300)).toBe(2000n);
    expect(legMark(leg(), 100, res("SideDown"), 300)).toBe(2000n); // a known win still counts at cost
    expect(legMark(leg(), 100, res("SideUp"), 300)).toBe(0n); // a known loss counts nothing
    expect(legMark(leg(), 100, res(null), 300)).toBe(2000n); // void: the backing comes back
    expect(legMark(leg(), 300, null, 300)).toBe(0n); // expired, no Resolution passed
  });

  it("counts a buy-back at what the book paid, not the seller's backing", () => {
    expect(legMark(leg({ backingShare: 4000n, bookCost: 1500n }), 100, null, 300)).toBe(1500n);
    expect(legMark(leg({ backingShare: 1000n, bookCost: 1300n }), 100, null, 300)).toBe(1000n);
  });

  it("counts a residual at the lesser of its two values until its Window resolves", () => {
    const x: NettedResidualC = { termsCid: "t1", marketId: "BTC-300:1", pairA: "a", pairB: "b", heldIfVoid: 200n, owedIfResolved: 0n, book: MAKER_BOOK };
    expect(residualMark(x, null)).toBe(0n);
    expect(residualMark(x, res(null))).toBe(200n);
    expect(residualMark(x, res("SideUp"))).toBe(0n);
  });

  it("conserves the book's value across quote → accept, and passes only the Resolutions its legs need", () => {
    const quoted = makerNav(snap({ quotes: [act("q", quote())] }), 100);
    expect(quoted.assets).toBe(10_000n); // 8000 cash + the 5 × 400 lock
    const accepted = makerNav(snap({ legs: [act("l", leg())], resolutions: new Map([["t1", act("r1", res("SideUp"))], ["t9", act("r9", res(null, "t9"))]]) }), 100);
    expect(accepted.assets).toBe(8_000n); // resolved against the book
    expect(accepted.inputs.resolutions).toEqual(["r1"]);
    expect(accepted.inputs.legs).toEqual(["l"]);
    expect(accepted.shares).toBe(10_000n);
  });
});

describe("a book leg", () => {
  it("is only ever a leg the venue itself owns", () => {
    expect(legBookOf(leg())).toBe(MAKER_BOOK);
    expect(legBookOf(leg({ owner: "bob" }))).toBeNull(); // a user's own tag is the user's
    expect(legBookOf(leg({ beneficiaryRef: null }))).toBeNull();
    expect(legBookOf(leg({ beneficiaryRef: "grant" }))).toBeNull();
  });
});

describe("the book's Windows", () => {
  it("reads open inventory, then a settled Window's realised result from its receipts", () => {
    const open = bookWindows(snap({ quotes: [act("q", quote({ pairId: "q2" }))], legs: [act("l", leg())] }), 100);
    expect(open.open).toHaveLength(1);
    expect(open.open[0]).toMatchObject({ marketId: "BTC-300:1", noRaw: 5_000n, yesRaw: 0n, deployedBase: 4_000n, escrowOutBase: 4_000n, settled: false, realizedBase: null });
    const receipt: BookReceiptC = { venue: V, book: MAKER_BOOK, marketId: "BTC-300:1", pairId: "p1", outcome: "SideDown", resolved: "SideDown", kind: "settled", lots: 5n, cost: 2_000n, proceeds: 5_000n };
    const done = bookWindows(snap({ receipts: [act("rc", receipt)] }), 400);
    expect(done.open).toHaveLength(0);
    expect(done.history[0]).toMatchObject({ settled: true, escrowOutBase: 2_000n, payoutBase: 5_000n, realizedBase: 3_000n, quoteCount: 1 });
  });

  it("names the first resolved Window still holding book positions", () => {
    const s = snap({ legs: [act("l", leg())], resolutions: new Map([["t1", act("r1", res("SideUp"))]]) });
    expect(unsettledExpired(bookWindows(s, 400).open, 400)).toBe("BTC-300:1");
    expect(unsettledExpired(bookWindows(s, 250).open, 250)).toBeNull(); // not expired yet
  });
});

describe("when the book takes a quote (MakerParams)", () => {
  const base: BookQuoteInput = {
    params: DEFAULT_MAKER_PARAMS, assets: [], intervals: [300], asset: "BTC", intervalSec: 300, side: "up", priceTicks: 600, lots: 5n, cashUnit: 1000n,
    stakeBase: 2_000_000n, bestUpTicks: 520, bestDownTicks: 520, lockAtSec: 1_000, nowSec: 100, windowDeployedBase: 0n, windowOpen: false, openWindows: 0,
    deployedBase: 0n, assetsBase: 10_000_000_000n,
  };
  it("takes one inside every bound", () => expect(bookTakes(base)).toEqual({ take: true }));
  it.each<[string, Partial<BookQuoteInput>]>([
    ["lane", { intervalSec: 60 }],
    ["asset", { assets: ["ETH"] }],
    ["band", { priceTicks: 980 }],
    ["spread", { bestUpTicks: 505, bestDownTicks: 505 }],
    ["size", { lots: 25n }],
    ["time", { lockAtSec: 120 }],
    ["windows", { openWindows: 8 }],
    ["per-Window", { windowDeployedBase: 199_000_000n }],
    ["exposure", { deployedBase: 5_999_000_000n }],
  ])("leaves it to the desk outside the %s bound", (_, o) => expect(bookTakes({ ...base, ...o }).take).toBe(false));
});
