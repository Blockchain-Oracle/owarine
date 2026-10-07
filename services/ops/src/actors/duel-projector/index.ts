import { isDbConfigured } from "@owarine/db";
import type { JsTransaction } from "@owarine/ledger";
import { resolveArenaDeployment } from "@owarine/markets/games";
import type { RoomContext } from "../game-room/handlers";
import { currentArenaDesk } from "../arena-desk";
import { partyAddress } from "@owarine/markets/ops/games";
import { applyEvent, type ApplyDeps } from "./apply";
import { createMatchCache } from "./facts";
import { createDuelTranslator } from "./ledger";

type Log = (why: string) => void;

/**
 * The duel projection (C9b): the arena's choices, turned into rows and into what a room says, as the main projector
 * applies each venue transaction (plan: "the projector becomes part of the main projector"). There is no second
 * stream and no second cursor: the projector's own cursor is the high-water mark, so a restart replays from it and
 * every row written again is keyed by what the ledger decided.
 *
 * The rooms are found at call time: the game room may start after the projector, and a process with no room still
 * writes the rows (the duel history), which is the honest degradation. Without a database the room is still fed.
 */

let room: RoomContext | null = null;

/** The game room hands its context over once it listens; the projection broadcasts into it from then on. */
export function attachDuelRoom(next: RoomContext | null): void {
  room = next;
}

export function createDuelProjection(log: Log): (tx: JsTransaction) => Promise<void> {
  const cache = createMatchCache();
  const addressOf = (party: string) => currentArenaDesk()?.seats.addressOf(party) ?? partyAddress(party);
  const translator = createDuelTranslator(addressOf);
  let target: { chainId: number; arena: ApplyDeps["arena"] } | null = null;
  let warned = false;

  return async (tx) => {
    const parties = translator.partiesOf(tx);
    if (parties.length > 0) await currentArenaDesk()?.seats.learn(parties);
    const entries = translator.eventsOf(tx);
    if (entries.length === 0) return;
    target ??= await resolveArenaDeployment().then((d) => (d ? { chainId: d.chainId, arena: d.gameArena } : null));
    if (!target) {
      if (!warned) log("arena events on the ledger, but no arena desk in this process to name the arena; rooms are not fed");
      warned = true;
      return;
    }
    const deps: ApplyDeps = { room, cache, chainId: target.chainId, arena: target.arena, log };
    for (const entry of entries) {
      try {
        await applyEvent(deps, entry);
      } catch (error) {
        // One bad event must not stall the projector's cursor, and must not be silent either.
        log(`${entry.event.kind} at offset ${entry.blockNumber}#${entry.logIndex} failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    log(`offset ${entries[0]!.blockNumber}: ${entries.map((e) => e.event.kind).join(", ")}${isDbConfigured() ? "" : " · no DATABASE_URL, rooms only"}`);
  };
}
