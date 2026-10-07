/**
 * The duel settler (C9b): the venue's side of every duel after the players' own choices. One pass every few seconds
 * over the arena desk's snapshot; each crank is decided by `decide.ts` and sent with a stable command id, so a
 * crash-retry is deduplicated by the participant and two passes racing a player merely find the match already moved.
 *
 *   refund-unjoined    Open_RefundUnjoined     past the join deadline               duel:refund-unjoined:<digest>
 *   reveal             Duel_Reveal             the sealed deck, verified locally first (the ledger checks sha256 again)
 *   refund-unrevealed  Duel_RefundUnrevealed   the deck never opened: both pots home, nobody forfeits
 *   lock               Duel_Lock               past the pick deadline: settle, forfeit the absent seat, or refund both
 *   score              Duel_Score              every recorded pick on a resolved Window, the engine's `legPayout`
 *   finalize           Duel_Finalize           the pot, once every recorded pick is scored
 *   refund-stale       Duel_RefundStale        past the last card's refund deadline with the pot undecided
 *
 * The cards themselves are ordinary legs: the venue's settler pays them leg by leg, independent of the pot.
 */
import { duelDeckHash } from "@owarine/markets/games";
import type { Command } from "@owarine/ledger";
import { failureText, isInactive, submit } from "@owarine/markets/ops/canton";
import { duelCommandId, gcmd, type DuelMatchC } from "@owarine/markets/ops/games";
import { getDeck, isDbConfigured, markDeckRevealed } from "@owarine/db";
import type { PassResult } from "../../runtime/actor";
import type { ArenaDesk } from "../arena-desk/desk";
import { deckKey, fromJournal, open, type RevealMaterial } from "../matchmaker/seal";
import { decideMatch, decideOpen, type DuelAction } from "./decide";

const MAX_WRITES_PER_PASS = 30;
/** A pick deadline a little inside the arena's window, for the clock between us and the ledger. */
const CLOCK_MARGIN_SEC = 3;

const materials = new Map<string, RevealMaterial | null>();

/** The sealed deck for a match, from the database or the journal written first; null when it cannot be opened. */
async function materialFor(matchId: string, log: (why: string) => void): Promise<RevealMaterial | null> {
  if (materials.has(matchId)) return materials.get(matchId) ?? null;
  const key = deckKey();
  if (!key) return null;
  const row = isDbConfigured() ? await getDeck(matchId).catch(() => null) : null;
  const sealed = row?.sealed ?? fromJournal(matchId);
  if (!sealed) return null;
  try {
    const m = open(sealed, key);
    materials.set(matchId, m);
    return m;
  } catch (error) {
    log(`${matchId}: the sealed deck would not open: ${error instanceof Error ? error.message : String(error)}`);
    materials.set(matchId, null);
    return null;
  }
}

export async function settlerPass(desk: ArenaDesk, log: (why: string) => void): Promise<PassResult> {
  const snap = await desk.snapshot({ fresh: true });
  const nowSec = Math.floor(Date.now() / 1000);
  const venue = desk.venue.party;
  const resolved = new Set(snap.resolutions.keys());
  let writes = 0;
  const counts: Record<string, number> = {};
  const run = async (commandId: string, commands: Command[], what: string): Promise<boolean> => {
    if (writes >= MAX_WRITES_PER_PASS) return false;
    writes++;
    try {
      const out = await submit(desk.venue, { commandId, commands });
      return out.kind === "done";
    } catch (error) {
      // Gone: a player cranked it first, or another pass did. Anything else is logged and retried next pass.
      if (!isInactive(error)) log(`${what} failed: ${failureText(error)}`);
      return false;
    }
  };
  const done = (a: DuelAction) => void (counts[a.kind] = (counts[a.kind] ?? 0) + 1);

  for (const o of snap.opens) {
    for (const a of decideOpen(o.data, nowSec)) {
      if (await run(duelCommandId("refund-unjoined", o.data.matchId), [gcmd.refundUnjoined(o.cid, venue)], `${a.kind} ${o.data.matchId}`)) done(a);
    }
  }

  for (const m of snap.matches) {
    const material = m.data.status.tag === "Unrevealed" ? await materialFor(m.data.matchId, log) : null;
    for (const a of decideMatch(m.data, resolved, nowSec, material !== null)) {
      const cmd = await commandFor(desk, m, a, material, nowSec, log);
      if (!cmd) continue;
      if (await run(cmd.commandId, [cmd.command], `${a.kind} ${m.data.matchId}`)) {
        done(a);
        log(`${m.data.matchId}: ${a.kind} · ${a.why}`);
        if (a.kind === "reveal" && isDbConfigured()) await markDeckRevealed(m.data.matchId).catch(() => undefined);
      }
    }
  }
  const summary = Object.entries(counts).map(([k, n]) => `${n} ${k}`).join(", ");
  return { why: `${snap.opens.length} open · ${snap.matches.length} live${summary ? ` · ${summary}` : ""}` };
}

async function commandFor(desk: ArenaDesk, m: { cid: string; data: DuelMatchC }, a: DuelAction, material: RevealMaterial | null, nowSec: number, log: (why: string) => void): Promise<{ commandId: string; command: Command } | null> {
  const venue = desk.venue.party;
  const id = m.data.matchId;
  switch (a.kind) {
    case "reveal": {
      if (!material) return null;
      const seeds = material.clientSeeds;
      const hash = duelDeckHash({ arenaId: m.data.arenaId, matchId: id, policyVersion: material.policyVersion, serverSeed: material.serverSeed, clientSeeds: seeds, cards: material.cards });
      if (hash !== m.data.deckHash) {
        log(`${id}: the sealed deck does not reproduce the committed hash; not revealing (the reveal deadline refunds both pots)`);
        return null;
      }
      const terms = await desk.termsByMarketId(material.cards);
      const cardCids = material.cards.map((c) => terms.get(c)?.cid);
      if (cardCids.some((c) => !c)) {
        log(`${id}: a card's Window is no longer live; the deck cannot be opened`);
        return null;
      }
      const lockAt = Math.min(...material.cards.map((c) => terms.get(c)!.data.lockAtSec));
      const pickDeadline = Math.min(nowSec + m.data.params.pickWindowSec - CLOCK_MARGIN_SEC, lockAt);
      if (pickDeadline <= nowSec + 1) {
        log(`${id}: the deck's first card locks too soon to pick; the reveal deadline refunds both pots`);
        return null;
      }
      return { commandId: duelCommandId("reveal", id), command: gcmd.revealDuel(m.cid, { actor: venue, seed: material.serverSeed, cardCids: cardCids as string[], newPickDeadlineSec: pickDeadline }) };
    }
    case "refund-unrevealed":
      return { commandId: duelCommandId("refund-unrevealed", id), command: gcmd.refundUnrevealed(m.cid, venue) };
    case "lock":
      return { commandId: duelCommandId("lock", id), command: gcmd.lockDuel(m.cid, venue) };
    case "score": {
      const snap = await desk.snapshot();
      const items = a.items.flatMap((i) => {
        const r = snap.resolutions.get(i.termsCid);
        return r ? [{ seat: i.seat, cardIndex: i.cardIndex, resolutionCid: r.cid }] : [];
      });
      if (items.length === 0) return null;
      return { commandId: duelCommandId("score", id, ...items.map((i) => `${i.seat}:${i.cardIndex}`)), command: gcmd.scoreDuel(m.cid, venue, items) };
    }
    case "finalize":
      return { commandId: duelCommandId("finalize", id), command: gcmd.finalizeDuel(m.cid, venue) };
    case "refund-stale":
      return { commandId: duelCommandId("refund-stale", id), command: gcmd.refundStale(m.cid, venue) };
    case "refund-unjoined":
      return null;
  }
}
