/**
 * The holdings read (C7b): one party's tokenised share holdings on Canton, read-only, in integers. The reference read a
 * Solana wallet's mainnet Token-2022 accounts through Helius; a Canton seat holds token-standard assets instead: any
 * contract that implements the CIP-56 `Holding` interface, whatever registry's template it is, comes back through an
 * `InterfaceFilter` with its view. Two steps:
 *
 *   `readCip56Holdings`  every holding the party OWNS (a transfer offered to it shows as a locked holding of its sender
 *                        and is not the party's), as atomic units of 10^-10, locked or not;
 *   `readHoldings`       the ones whose (admin, id) the deployment maps to a verified share token (`ShareInstrument`),
 *                        as the cover cards and "Your stocks" read them. An instrument no mapping names is not a share
 *                        and is left out; a party that holds none gets an empty list, which is true, while a failed read
 *                        is a `HoldingsReadError` (never an empty list, which would read as "you hold nothing").
 *
 * Until a deployment maps a tokenised-share instrument the answer is empty, and the cards show the reference's own "no
 * holdings" state. Server-only.
 */
import type { Cluster } from "@agari/core/constants";
import { SHARE_TOKENS, type ShareSymbol } from "@agari/core/market";
import { CIP56_INTERFACE_IDS } from "@agari/daml";
import type { LedgerClient, Party } from "@agari/ledger";
import { decodeHoldingView, interfaceViewOf } from "../ops/cc/decode";
import { MULTIPLIER_SCALE } from "./scaled-amount";

export interface Holding {
  mint: string;
  symbol: (typeof SHARE_TOKENS)[number]["symbol"];
  issuer: (typeof SHARE_TOKENS)[number]["issuer"];
  underlying: (typeof SHARE_TOKENS)[number]["underlying"];
  /** Integers as decimal strings: the wire carries no bigint. */
  rawAmount: string;
  decimals: number;
  multiplierE12: string;
  sharesE8: string;
  /** The newest quote for the token or its underlying, fresh or not; null when there is none. */
  priceE8: string | null;
  /** How old that quote was when read, in seconds; null without a quote. The exposure is sized only from a fresh one. */
  priceAgeSec: number | null;
  priceSource: string | null;
  pricedAs: string | null;
  exposureUsdE6: string | null;
}

export interface HoldingsBody {
  owner: string;
  cluster: Cluster;
  asOfSec: number;
  holdings: Holding[];
}

/** A CIP-56 instrument this deployment treats as one of the verified share tokens. */
export interface ShareInstrument {
  admin: Party;
  id: string;
  symbol: ShareSymbol;
}

export interface Cip56Holding {
  contractId: string;
  /** The created event's template (package-id form): whose registry carries the holding. */
  templateId: string;
  instrumentAdmin: Party;
  instrumentId: string;
  /** Atomic units of 10^-10 of the instrument: exact, never a float. */
  amountAtomic: bigint;
  locked: boolean;
  offset: number;
}

/** A holdings failure with a message that never names the ledger's URL or a credential. */
export class HoldingsReadError extends Error {}

/** Decimal places of a CIP-56 amount (`Numeric 10`). */
export const CIP56_DECIMALS = 10;

/** Every CIP-56 holding `party` owns, from one paged snapshot. A view this build cannot read is skipped. */
export async function readCip56Holdings(client: Pick<LedgerClient, "activeContracts">, party: Party): Promise<Cip56Holding[]> {
  let contracts;
  try {
    contracts = (await client.activeContracts({ parties: [party], interfaceIds: [CIP56_INTERFACE_IDS.Holding], maxPageSize: 500 })).contracts;
  } catch (error) {
    throw new HoldingsReadError(`could not read holdings from the ledger (${error instanceof Error ? error.name : "error"})`);
  }
  const out: Cip56Holding[] = [];
  for (const c of contracts) {
    const raw = interfaceViewOf(c.createdEvent, CIP56_INTERFACE_IDS.Holding);
    if (!raw) continue;
    try {
      const v = decodeHoldingView(raw);
      if (v.owner !== party) continue;
      out.push({ contractId: c.createdEvent.contractId, templateId: c.createdEvent.templateId, instrumentAdmin: v.instrumentAdmin, instrumentId: v.instrumentId, amountAtomic: v.amountAtomic, locked: v.lock !== null, offset: c.createdEvent.offset });
    } catch {
      /* a view this build cannot read is not a holding it can show */
    }
  }
  return out;
}

export interface HoldingsInput {
  client: Pick<LedgerClient, "activeContracts">;
  /** The party whose holdings are read: the leased seat's, from its lease and never from a request. */
  party: Party;
  instruments: readonly ShareInstrument[];
  cluster: Cluster;
  nowSec: number;
}

/** The party's verified share holdings, summed per instrument (a holding is a UTXO; the card shows the position). */
export async function readHoldings(input: HoldingsInput): Promise<HoldingsBody> {
  const all = await readCip56Holdings(input.client, input.party);
  const held = new Map<string, bigint>();
  for (const h of all) {
    if (h.locked) continue; // locked coin is committed elsewhere; the cover card sizes only what the party can use
    const key = `${h.instrumentAdmin}\n${h.instrumentId}`;
    held.set(key, (held.get(key) ?? 0n) + h.amountAtomic);
  }
  const holdings: Holding[] = [];
  for (const inst of input.instruments) {
    const atomic = held.get(`${inst.admin}\n${inst.id}`);
    const token = SHARE_TOKENS.find((t) => t.symbol === inst.symbol);
    if (!atomic || atomic <= 0n || !token) continue;
    holdings.push({
      mint: `${inst.id}@${inst.admin}`, symbol: token.symbol, issuer: token.issuer, underlying: token.underlying,
      rawAmount: atomic.toString(), decimals: CIP56_DECIMALS, multiplierE12: MULTIPLIER_SCALE.toString(),
      // 10 decimals → 8, rounded DOWN: a position is never shown larger than it is.
      sharesE8: (atomic / 100n).toString(),
      priceE8: null, priceAgeSec: null, priceSource: null, pricedAs: null, exposureUsdE6: null,
    });
  }
  return { owner: input.party, cluster: input.cluster, asOfSec: input.nowSec, holdings };
}

/** `CIP56_SHARE_INSTRUMENTS`: a JSON array of `{admin, id, symbol}`; a bad entry is dropped, never guessed at. */
export function parseShareInstruments(raw: string | undefined): ShareInstrument[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const known = new Set<string>(SHARE_TOKENS.map((t) => t.symbol));
  const out: ShareInstrument[] = [];
  for (const e of parsed) {
    if (typeof e !== "object" || e === null) continue;
    const { admin, id, symbol } = e as Record<string, unknown>;
    if (typeof admin === "string" && admin && typeof id === "string" && id && typeof symbol === "string" && known.has(symbol)) out.push({ admin, id, symbol: symbol as ShareSymbol });
  }
  return out;
}
