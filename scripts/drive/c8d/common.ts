/**
 * What every C8d drive part shares: the parties file, the ledger kit (reads with offsets, so each row names its update),
 * the web client with leased seats, and the step runner that prints one acceptance-shaped row per check.
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { TEMPLATE_IDS } from "@owarine/daml";
import type { LedgerClient } from "@owarine/ledger";
import { appMarketId } from "@owarine/markets/server";
import { decodeOpenPrint, decodeQuote, decodeTerms, type TermsC } from "@owarine/markets/ops/canton";
import type { CheckRow } from "../../bootstrap/rows";
import { ledgerKit, type Roles, type Row } from "../first-call/ledger";
import { newSeat, type Seat, type WebClient } from "../first-call/seat";

export interface PartiesJson {
  parties: Record<string, string>;
  users: Record<string, string>;
}

export interface Ctx {
  client: LedgerClient;
  parties: PartiesJson;
  roles: Roles;
  kit: ReturnType<typeof ledgerKit>;
  web: WebClient;
  webUrl: string;
  opsUrl: string;
  run: string;
  step: (check: string, body: () => Promise<Omit<CheckRow, "check"> | null>) => Promise<boolean>;
  log: (s: string) => void;
  /** Seats leased so far by name (A, B, …), reused across parts. */
  seats: Map<string, Seat>;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const credits = (base: bigint) => (Number(base) / 1_000_000).toFixed(2);
export const short = (cid: string) => `${cid.slice(0, 12)}…`;
export const hint = (party: string) => `${party.split("::")[0]}::…`;

export function readParties(path: string): PartiesJson {
  const file = JSON.parse(readFileSync(path, "utf8")) as PartiesJson;
  return file;
}

export function rolesOf(p: PartiesJson): Roles {
  return {
    venue: p.parties.venue!,
    resolver: p.parties.resolver!,
    auditor: p.parties.auditor!,
    oracles: [p.parties["oracle-coinbase"]!, p.parties["oracle-kraken"]!, p.parties["oracle-bitstamp"]!],
  };
}

export { ledgerKit, newSeat, randomUUID, TEMPLATE_IDS };

/** A seat leased through the web (`/api/seat`), once per name. */
export async function seat(ctx: Ctx, name: string): Promise<Seat> {
  const had = ctx.seats.get(name);
  if (had) return had;
  const s = await newSeat(name);
  const r = await ctx.web.lease(s);
  if (r.json.kind !== "leased") throw new Error(`seat ${name} not leased: ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`);
  ctx.seats.set(name, s);
  return s;
}

/** The lane's Window ops is quoting now: open print recorded, at least `leadSec` before lock. */
export async function quotingWindow(ctx: Ctx, seriesKey: string, leadSec = 15): Promise<Row<TermsC> | undefined> {
  const now = Date.now() / 1000;
  const terms = (await ctx.kit.acs(ctx.roles.venue, TEMPLATE_IDS.MarketTerms, decodeTerms)).filter((t) => t.data.seriesKey === seriesKey && t.data.tradingStartSec <= now && t.data.lockAtSec - now >= leadSec);
  if (!terms.length) return undefined;
  const opened = new Set((await ctx.kit.acs(ctx.roles.venue, TEMPLATE_IDS.OpenPrint, decodeOpenPrint)).map((o) => o.data.termsCid));
  return terms.find((t) => opened.has(t.cid));
}

/** A firm quote from ops through the web, requoting once if the displayed cap is low; retries for `forMs`. */
export async function firmQuote(ctx: Ctx, s: Seat, seriesKey: string, side: "up" | "down", stakeBase: bigint, forMs = 150_000, leadSec = 15) {
  const until = Date.now() + forMs;
  let last = "no Window with an open print yet";
  for (;;) {
    const win = await quotingWindow(ctx, seriesKey, leadSec);
    if (win) {
      const body = { marketId: appMarketId(win.data.marketId), side, stakeBase, displayedMaxCostBase: (stakeBase * 12n) / 10n };
      let r = await ctx.web.call(s, "POST", "/api/ledger/quotes", body);
      if (r.json.kind === "requote") r = await ctx.web.call(s, "POST", "/api/ledger/quotes", { ...body, displayedMaxCostBase: BigInt(r.json.quote.maxCostBase) });
      if (r.json.kind === "quote") {
        const q = (await ctx.kit.acs(s.party!, TEMPLATE_IDS.Quote, decodeQuote)).find((x) => x.cid === r.json.quoteCid);
        if (q) return { win, q };
      }
      last = `${r.status} ${r.json.kind ?? ""} ${r.json.diagnosis?.kind ?? ""}: ${String(r.json.diagnosis?.technical ?? r.json.error ?? "").slice(0, 160)}`;
    }
    if (Date.now() > until) throw new Error(`no firm quote on ${seriesKey} in ${Math.round(forMs / 1000)} s (last: ${last})`);
    await sleep(3_000);
  }
}
