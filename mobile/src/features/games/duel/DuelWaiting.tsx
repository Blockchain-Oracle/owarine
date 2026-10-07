import type { Diagnosis } from "@owarine/core/types";
import { useNowMs } from "@/components/data/useNowMs";
import { DUEL } from "@/features/games/duel/copy";
import type { DealingView } from "@/features/games/duel/useDuelRoom";
import { useMarketSession } from "@/features/markets/session/useMarketSession";
import { Body, DeckLine, Foot, Refusal } from "./parts";

/**
 * web's `DuelWaiting.tsx`: the two things a duel used to do silently — wait, and refuse. The countdown runs off the
 * room's own `serverTimeMs` plus elapsed local time; a refusal shows the write lane's own diagnosis.
 */

/** Seconds left on a server deadline, measured from when this phone received it. */
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
      <DeckLine>{bothSeedsIn ? deckLine : DUEL.lobby.seedWait(dealing.seedsIn)}</DeckLine>
      <Body>{bothSeedsIn ? (closed ? DUEL.queue.deckWhyClosed : DUEL.lobby.venueWait) : DUEL.lobby.seedBody}</Body>
      {nowMs > 0 ? <Foot>{DUEL.lobby.givesUp(leftSec(dealing, nowMs))}</Foot> : null}
    </>
  );
}

/** A refusal, with the write lane's own diagnosis. The seat pays no network fee, so there is no faucet to offer. */
export function RefusalPlate({ diagnosis }: { diagnosis: Diagnosis }) {
  return (
    <Refusal>
      <Body>{DUEL.lobby.refusedTitle}</Body>
      <Foot>{diagnosis.technical}</Foot>
    </Refusal>
  );
}
