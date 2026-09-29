import type { ArenaEventLog } from "@agari/core/games";
import type { Reading } from "@agari/core/schemas";
import { unavailableFor } from "../stub/product";
import { ARENA_NOT_LIVE } from "./deployment";

/** The ledger offset the arena projector reads up to. Not live until the games package and the projector exist (C9). */
export const arenaHeadBlock = (): Promise<Reading<bigint>> => unavailableFor(ARENA_NOT_LIVE);

/** Arena events in a range. Never an empty list here: a projector fed `[]` would record a range as read when it was not. */
export const listArenaEvents = (_from: bigint, _to: bigint): Promise<Reading<readonly ArenaEventLog[]>> => unavailableFor(ARENA_NOT_LIVE);
