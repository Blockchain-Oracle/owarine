import type { ArenaEventLog } from "@agari/core/games";
import type { Reading } from "@agari/core/schemas";
import { unavailableFor } from "../stub/product";

/**
 * On Canton the duel projection is folded into the main projector: the venue's one `/v2/updates` stream carries every
 * arena transaction, and ops translates each into `ArenaEvent`s as it applies it (`duel-projector/ledger.ts`). There is
 * no separate log to poll, so these answer that plainly, and never with an empty list (a poller fed `[]` would record a
 * range as read when it was not).
 */
const FOLDED = "games: the duel projection rides the main projector's update stream (C9b); there is no arena log to poll";

export const arenaHeadBlock = (): Promise<Reading<bigint>> => unavailableFor(FOLDED);

export const listArenaEvents = (_from: bigint, _to: bigint): Promise<Reading<readonly ArenaEventLog[]>> => unavailableFor(FOLDED);
