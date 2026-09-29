import type { CheckKind, ProofSlot, VoidKind } from "@agari/core/proof";

/**
 * `/proof/<market>` on Canton (proof-analytics.md §2.6, re-pointed): the evidence behind a Window's result. The page is
 * built from Masayume's parts only (the status table, the cream receipt, the numbered section header), so its words
 * carry the Canton meaning: which oracle quoted what, the median the ledger took, and a re-verify anyone can run.
 */
export const PROOF = {
  title: "Print proof",
  section: { index: "00", title: "Print proof" },
  intro:
    "Every Window settles on oracle prints: three exchange feeders each post the close of that exchange's public 1-minute candle as a ledger contract, and the Resolution takes their lower median. Here is each quote at the open and at the close, the median and spread the ledger took, who signed the result, and a re-verify you can run yourself.",
  window: (asset: string, cadence: string, close: string) => `${asset} · ${cadence} Window · closes ${close}`,
  unreachable: "The venue's projection is unreachable, so the prints cannot be shown. The Resolution is still on the ledger.",
  none: "No print recorded for this Window yet. The opening prints land a few seconds after its start boundary.",
  slot: { open: "Open", close: "Close" } satisfies Record<ProofSlot, string>,
  tableTitle: (n: number) => `Oracle prints (${n})`,
  counted: "counted",
  notCounted: "posted, not counted",
  missing: "no quote before the deadline",
  fetched: (after: string) => `fetched ${after}`,
  median: (slot: string) => `Median · ${slot}`,
  medianDetail: (counted: number, quorum: number, spread: string, limit: number, over: boolean) =>
    `${counted} counted (quorum ${quorum}) · spread ${spread} bps · limit ${limit} bps${over ? " · over the limit" : ""}`,
  noMedian: (counted: number, quorum: number) => `${counted} counted, quorum ${quorum}: no median`,
  result: "Result",
  pending: "not decided yet",
  resolved: (side: string, word: string) => `${side}: the close median finished ${word} the open`,
  voided: (reason: string) => `Void: ${reason}`,
  voidReason: {
    MissingPrint: "no oracle quoted before the deadline",
    QuorumNotMet: "too few oracles quoted before the deadline",
    ResolverAbsent: "the resolver did not decide in time",
    SourceDisagreement: "the quotes were further apart than the limit",
  } satisfies Record<VoidKind, string>,
  voidSlot: { open: "open", close: "close" } satisfies Record<ProofSlot, string>,
  signedBy: "Signed by",
  signatories: "resolver and venue, both required by the Resolution contract",
  receipt: {
    title: "RESOLUTION PROOF",
    figureClose: "Close median",
    figureVoid: "Void",
    footer: "Quoted by three exchange oracles · decided on Canton · archived by the venue",
    rows: {
      open: "Open print",
      close: "Close median",
      spread: "Close spread",
      quorum: "Counted",
      outcome: "Outcome",
      resolver: "Resolver",
      venue: "Venue",
      update: "Ledger update",
    },
    spread: (bps: string, limit: number) => `${bps} bps of ${limit}`,
    quorum: (counted: number, oracles: number, quorum: number) => `${counted} of ${oracles} (quorum ${quorum})`,
  },
  reverify: "Re-verify",
  reverifying: "Checking…",
  reverifyTitle: "Check it yourself",
  reverifyBody:
    "Re-verify recomputes the medians, the spread and the outcome from the Resolution's own evidence with the ledger's integer rule, checks each archived exchange response against the hash on its quote, and fetches each exchange's candle again.",
  verdict: {
    pass: (passed: number, unavailable: number) => `Re-verified: ${passed} checks pass${unavailable ? `, ${unavailable} could not run` : ""}`,
    fail: (failed: number) => `${failed} check${failed === 1 ? "" : "s"} failed`,
  },
  checkedAt: (clock: string) => `checked ${clock}`,
  check: {
    median: "median",
    spread: "spread",
    outcome: "outcome",
    hash: "archive hash",
    archive: "archived close",
    exchange: "exchange candle",
  } satisfies Record<CheckKind, string>,
  status: { pass: "matches", fail: "differs", unavailable: "can't check" } as const,
  tones: { pass: "good", fail: "bad", unavailable: "off" } as const,
  refused: {
    unresolved: "This Window has no Resolution yet, so there is nothing to re-verify.",
    unavailable: "Re-verify is unavailable on this deployment: the venue's projection is not reachable.",
    "no-print": "The venue's projection does not hold this Window.",
    failed: "The re-verify could not run. Please retry.",
  },
} as const;
