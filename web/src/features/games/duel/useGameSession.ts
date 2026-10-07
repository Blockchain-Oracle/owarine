"use client";

import type { ArenaAgentGrant } from "@owarine/core/games";
import type { Address } from "@owarine/core/types";
import type { SubmitterSession } from "@owarine/markets";
import { useCallback } from "react";

/**
 * The key that swipes — on Canton, the seat's own lane.
 *
 * Flicky asks a player for no signature per card; the Solana arena kept that promise with an agent key the entry named
 * and funded. Canton keeps it without one: a pick is the seat's own command, sent by our server as the leased seat's
 * party (`/api/ledger/games/duel/pick`), and the seat key signs nothing per card. So there is no agent to name, no
 * session to open and no grant to size; the shape stays so the screens and the phone read it unchanged.
 */
/** The life an agent grant had on Solana; kept for the stages that still name it (re-keying is never needed on Canton). */
export const MATCH_AGENT_TTL_SEC = 6 * 3_600;

export interface GameSession {
  /** An agent key: never on Canton (the seat acts for itself). */
  key: Address | null;
  /** An agent's signing session: never on Canton. */
  session: SubmitterSession | null;
  /** What an entry would name: nothing on Canton, so an entry carries no agent. */
  grant: (deckSize: number, perCardCapBase: bigint, sponsored?: boolean) => Promise<ArenaAgentGrant | null>;
  /** Nothing to throw away. */
  forget: () => Promise<void>;
}

export function useGameSession(): GameSession {
  const grant = useCallback(async (): Promise<ArenaAgentGrant | null> => null, []);
  const forget = useCallback(async () => {}, []);
  return { key: null, session: null, grant, forget };
}
