"use client";

import type { Diagnosis } from "@owarine/core/types";
import { useNowMs } from "@/components/data";
import { useMarketSession } from "@/features/markets/session/useMarketSession";
import { DUEL } from "./copy";
import type { DealingView } from "./useDuelRoom";

/**
 * The two things a duel used to do silently: wait, and refuse.
 *
 * A spinner labelled "sealing the deck…" looked identical at one second and at ninety, and the room knew
 * the difference the whole time — it logs "the next deck is dealable in 47s" while the screen says
 * nothing. And a write refused before it reached the ledger put the button back where it was with no
 * word at all.
 *
 * Both are drawn from facts, never from a guess. The countdown runs off the room's own `serverTimeMs`
 * plus elapsed local time rather than off a browser clock that may be minutes out, and a refusal shows
 * the diagnosis the write lane produced rather than a rewritten one.
 */

/** Seconds left on a server deadline, measured from when this browser received it. */
function leftSec(dealing: DealingView, nowMs: number): number {
  const elapsed = Math.max(0, nowMs - dealing.atMs);
  return Math.max(0, Math.round((dealing.givesUpAtMs - dealing.serverTimeMs - elapsed) / 1_000));
}

export function DealingPlate({ dealing }: { dealing: DealingView }) {
  const nowMs = useNowMs();
  const session = useMarketSession();
  const closed = session !== null && !session.open;
  const bothSeedsIn = dealing.seedsIn >= 2;
  const deckLine =
    dealing.nextDeckInSec === undefined
      ? DUEL.lobby.deckUnknown
      : dealing.nextDeckInSec === null
        ? closed
          ? DUEL.queue.deckClosed(session?.label ?? "")
          : DUEL.lobby.deckNone
        : DUEL.lobby.deckIn(dealing.nextDeckInSec);

  return (
    <>
      <p className="du-deck" aria-live="polite">
        {bothSeedsIn ? deckLine : DUEL.lobby.seedWait(dealing.seedsIn)}
      </p>
      <p className="du-body">{bothSeedsIn ? (closed ? DUEL.queue.deckWhyClosed : DUEL.lobby.venueWait) : DUEL.lobby.seedBody}</p>
      {nowMs > 0 && <p className="du-foot">{DUEL.lobby.givesUp(leftSec(dealing, nowMs))}</p>}
    </>
  );
}

/**
 * A refusal: what the write lane said, and the button again. Canton charges the seat no network fee, so no refusal
 * here is an empty tank with a faucet to send a player to; each one says what happened (FR-2: never a raw revert
 * without its diagnosis).
 */
export function RefusalPlate({ diagnosis }: { diagnosis: Diagnosis }) {
  return (
    <div className="du-refusal" role="status">
      <p className="du-body">{DUEL.lobby.refusedTitle}</p>
      <p className="du-foot">{diagnosis.technical}</p>
    </div>
  );
}
