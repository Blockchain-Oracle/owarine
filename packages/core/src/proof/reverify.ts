/**
 * Re-verify a Window's Resolution from its own evidence (plan "Every remaining capability": `/api/proof/pyth` becomes
 * "re-verify an archived price"). Three independent checks, each reported honestly:
 *
 * 1. **The rule.** Recompute each slot's lower median, spread and the outcome (or the named void) from the evidence
 *    the Resolution embeds, with the ledger's integer rule (`rule.ts`), and compare with what the ledger recorded.
 * 2. **The archive.** The venue archived each oracle's exchange response byte for byte; its sha-256 must equal the
 *    `payloadHash` on the `PriceQuote`, and the close read out of those bytes must equal the posted price.
 * 3. **The exchange.** A fresh fetch of the same public 1-minute candle must show the same close. An exchange that no
 *    longer serves that candle (or cannot be reached) is "can't check", never "fail".
 *
 * Pure: the caller fetches the archive rows and the live candles, this decides. Prices cross as decimal strings.
 */
import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";
import { closeE8FromPayload, isExchange, type Exchange } from "./candles";
import { disagrees, lowerMedian, missingReason, spreadBps, winnerOf, type ProofSide, type ProofSlot, type ProofVoid } from "./rule";

export interface EvidenceItem {
  oracle: string;
  priceE8: bigint;
  payloadHash: string;
  fetchedAtSec: number;
}

export interface ProofResolution {
  symbol: string;
  openBoundarySec: number;
  closeBoundarySec: number;
  quorum: number;
  maxDeviationBps: number;
  tieUp: boolean;
  openPriceE8: bigint | null;
  closePriceE8: bigint | null;
  openEvidence: readonly EvidenceItem[];
  closeEvidence: readonly EvidenceItem[];
  /** null = void, and then `voidReason` names why. */
  outcome: ProofSide | null;
  voidReason: ProofVoid | null;
}

export interface ArchivedPayload {
  exchange: Exchange;
  payload: string;
}

export type Refetch = { kind: "ok"; payload: string } | { kind: "unavailable"; why: string };

export type CheckStatus = "pass" | "fail" | "unavailable";
export type CheckKind = "median" | "spread" | "outcome" | "hash" | "archive" | "exchange";

export interface ProofCheck {
  id: string;
  kind: CheckKind;
  slot: ProofSlot | null;
  oracle: string | null;
  exchange: Exchange | null;
  status: CheckStatus;
  /** What the ledger (or the quote) says, as text. */
  expected: string | null;
  /** What the recount (or the archive, or the exchange) says. */
  found: string | null;
  /** Why a check could not run, or what a spread was measured against. */
  note: string | null;
}

export interface ReverifyReport {
  verdict: "pass" | "fail";
  passed: number;
  failed: number;
  unavailable: number;
  checks: ProofCheck[];
}

/** One evidence item's source, once identified: the exchange and the archived bytes whose hash matched (if any). */
export interface EvidenceSource {
  exchange: Exchange | null;
  /** The archived payload of that exchange at the boundary, matching or not. */
  archive: string | null;
  hashMatches: boolean;
}

export const sha256Hex = (text: string): string => bytesToHex(sha256(utf8ToBytes(text)));

/** The exchange an oracle party speaks for, from its party hint (`agari-oracle-coinbase-<run>::…`); null when unnamed. */
export function exchangeOfParty(party: string): Exchange | null {
  const hint = party.split("::")[0] ?? "";
  const m = /oracle-([a-z]+)/.exec(hint);
  return m && isExchange(m[1]!) ? m[1] : null;
}

/**
 * Which archived payload backs an evidence item: the one whose sha-256 is the quote's `payloadHash` (that also names
 * the exchange). Failing that, the oracle's own exchange from its party hint, whose archive (if any) then fails the hash.
 */
export function identifySource(item: EvidenceItem, archives: readonly ArchivedPayload[]): EvidenceSource {
  const matched = archives.find((a) => sha256Hex(a.payload) === item.payloadHash);
  if (matched) return { exchange: matched.exchange, archive: matched.payload, hashMatches: true };
  const exchange = exchangeOfParty(item.oracle);
  return { exchange, archive: archives.find((a) => a.exchange === exchange)?.payload ?? null, hashMatches: false };
}

interface SlotRecount {
  median: bigint | null;
  spreadBps: bigint | null;
  disagrees: boolean;
  void: ProofVoid | null;
}

function recountSlot(r: ProofResolution, slot: ProofSlot, evidence: readonly EvidenceItem[]): SlotRecount {
  const prices = evidence.map((e) => e.priceE8);
  const base = { median: lowerMedian(prices), spreadBps: spreadBps(prices), disagrees: disagrees(r.maxDeviationBps, prices) };
  if (prices.length < r.quorum) return { ...base, void: missingReason(r.quorum, prices.length, slot) };
  // A quorum voided at the deadline (Terms_Void) is ResolverAbsent whatever its spread: a matter of time, not of price.
  if (r.voidReason?.kind === "ResolverAbsent" && r.voidReason.slot === slot) return { ...base, void: r.voidReason };
  return { ...base, void: base.disagrees ? { kind: "SourceDisagreement", slot } : null };
}

/** What the rule says the Window's result is, from the evidence alone. */
export function recountResolution(r: ProofResolution): { open: SlotRecount; close: SlotRecount | null; outcome: ProofSide | null; void: ProofVoid | null } {
  const open = recountSlot(r, "open", r.openEvidence);
  if (open.void) return { open, close: null, outcome: null, void: open.void };
  const close = recountSlot(r, "close", r.closeEvidence);
  if (close.void) return { open, close, outcome: null, void: close.void };
  return { open, close, outcome: winnerOf(open.median!, close.median!, r.tieUp), void: null };
}

const text = (v: bigint | null) => (v === null ? null : v.toString());
const resultText = (outcome: ProofSide | null, v: ProofVoid | null) => (outcome ? `resolved ${outcome}` : v ? `void: ${v.kind} (${v.slot})` : "undecided");

function ruleChecks(r: ProofResolution): ProofCheck[] {
  const recount = recountResolution(r);
  const checks: ProofCheck[] = [];
  const slots: [ProofSlot, SlotRecount | null, bigint | null, readonly EvidenceItem[]][] = [
    ["open", recount.open, r.openPriceE8, r.openEvidence],
    ["close", recount.close, r.closePriceE8, r.closeEvidence],
  ];
  for (const [slot, s, ledgerPrice, evidence] of slots) {
    if (!s || evidence.length === 0) continue;
    if (ledgerPrice !== null) {
      checks.push({ id: `median:${slot}`, kind: "median", slot, oracle: null, exchange: null, status: s.median === ledgerPrice ? "pass" : "fail", expected: text(ledgerPrice), found: text(s.median), note: `${evidence.length} counted` });
    }
    const ledgerSays = r.voidReason?.kind === "SourceDisagreement" && r.voidReason.slot === slot;
    const ruleSays = s.void?.kind === "SourceDisagreement";
    checks.push({
      id: `spread:${slot}`, kind: "spread", slot, oracle: null, exchange: null, status: ledgerSays === ruleSays ? "pass" : "fail",
      expected: ledgerSays ? "over the limit" : "within the limit", found: text(s.spreadBps), note: `limit ${r.maxDeviationBps} bps`,
    });
  }
  const same = recount.outcome === r.outcome && (recount.void?.kind ?? null) === (r.voidReason?.kind ?? null) && (recount.void?.slot ?? null) === (r.voidReason?.slot ?? null);
  checks.push({ id: "outcome", kind: "outcome", slot: null, oracle: null, exchange: null, status: same ? "pass" : "fail", expected: resultText(r.outcome, r.voidReason), found: resultText(recount.outcome, recount.void), note: null });
  return checks;
}

/** The archive and exchange checks of one evidence item. `refetch` is null when no exchange could be named for it. */
export function sourceChecks(slot: ProofSlot, boundarySec: number, item: EvidenceItem, source: EvidenceSource, refetch: Refetch | null): ProofCheck[] {
  const base = { slot, oracle: item.oracle, exchange: source.exchange, expected: item.priceE8.toString() };
  const id = (kind: CheckKind) => `${kind}:${slot}:${item.oracle}`;
  const hash: ProofCheck = source.hashMatches
    ? { ...base, id: id("hash"), kind: "hash", status: "pass", expected: item.payloadHash, found: item.payloadHash, note: null }
    : source.archive !== null
      ? { ...base, id: id("hash"), kind: "hash", status: "fail", expected: item.payloadHash, found: sha256Hex(source.archive), note: null }
      : { ...base, id: id("hash"), kind: "hash", status: "unavailable", expected: item.payloadHash, found: null, note: "no archived payload for this boundary" };

  const archivedE8 = source.hashMatches && source.exchange && source.archive !== null ? closeE8FromPayload(source.exchange, source.archive, boundarySec) : null;
  const archive: ProofCheck = !source.hashMatches
    ? { ...base, id: id("archive"), kind: "archive", status: "unavailable", found: null, note: "no archived payload matches the quote's hash" }
    : { ...base, id: id("archive"), kind: "archive", status: archivedE8 === item.priceE8 ? "pass" : "fail", found: text(archivedE8), note: null };

  let exchange: ProofCheck;
  if (!source.exchange || refetch === null) exchange = { ...base, id: id("exchange"), kind: "exchange", status: "unavailable", found: null, note: "the oracle's exchange is not named" };
  else if (refetch.kind === "unavailable") exchange = { ...base, id: id("exchange"), kind: "exchange", status: "unavailable", found: null, note: refetch.why };
  else {
    const live = closeE8FromPayload(source.exchange, refetch.payload, boundarySec);
    exchange =
      live === null
        ? { ...base, id: id("exchange"), kind: "exchange", status: "unavailable", found: null, note: "the exchange no longer serves this candle" }
        : { ...base, id: id("exchange"), kind: "exchange", status: live === item.priceE8 ? "pass" : "fail", found: live.toString(), note: null };
  }
  return [hash, archive, exchange];
}

export interface SourceInput {
  slot: ProofSlot;
  item: EvidenceItem;
  source: EvidenceSource;
  refetch: Refetch | null;
}

/** The whole report: the rule's checks, then each evidence item's archive and exchange checks. */
export function reverify(r: ProofResolution, sources: readonly SourceInput[]): ReverifyReport {
  const checks = [
    ...ruleChecks(r),
    ...sources.flatMap((s) => sourceChecks(s.slot, s.slot === "open" ? r.openBoundarySec : r.closeBoundarySec, s.item, s.source, s.refetch)),
  ];
  const count = (status: CheckStatus) => checks.filter((c) => c.status === status).length;
  const failed = count("fail");
  return { verdict: failed > 0 ? "fail" : "pass", passed: count("pass"), failed, unavailable: count("unavailable"), checks };
}
