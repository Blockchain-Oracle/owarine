"use client";

import {
  PICK_ATTEMPT_GUARD_SEC,
  PICK_ATTEMPT_MAX,
  pickFloorRaw,
  stakeTierIndex,
  type ArenaAgentGrant,
  type ArenaIntent,
  type Pick,
  type StakeTierId,
} from "@owarine/core/games";
import { isOk } from "@owarine/core/schemas";
import { diagnosis, type Address, type Hash32, type Diagnosis, type MarketId } from "@owarine/core/types";
import { quoteArenaPick, type ArenaPickOutcome } from "@owarine/markets/games";
import { invalidateAfterWrite, useSubmitter } from "@owarine/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useWalletSession } from "@/lib/wallet-session";
import { useOwnerWallet } from "@/lib/wallet-session";
import { useGameSession, type GameSession } from "./useGameSession";

/**
 * Every transaction a duel asks of a player: opening the match, joining it, and each pick.
 *
 * **A pick retries, and that is not defensive padding.** Two seats swiping the same card in the same second draw on
 * the same venue ladder, so the loser's firm quote can come back above the tier's per-card cap and is answered as a
 * requote, as it should be. That is the normal case in a live duel (`context/54` §3). The stake never changes on a
 * retry, only the floor loosens, because the ledger
 * refunds whatever the walk does not spend.
 *
 * **Nothing here quotes a size the chain did not.** Every attempt re-reads `sizeForStake` immediately
 * before it sends, so a floor is always a fraction of a live quote rather than of a stale one.
 */

export type ArenaBusy = "create" | "join" | "claim" | "finalize" | "lock" | "authorize" | `pick:${number}` | `settle:${number}` | null;

/**
 * The last write this screen asked for and did not get — and the reason a duel needed it.
 *
 * `create` and `join` used to be sent with `void`, so every refusal was discarded and a button could go quiet with
 * nothing said. A write that fails silently is worse than one that fails loudly, so every refusal lands here.
 */
export interface ArenaRefusal {
  key: Exclude<ArenaBusy, null>;
  diagnosis: Diagnosis;
}

export interface PickProgress {
  cardIndex: number;
  attempt: number;
  /** The last refusal, when there was one. A lost race is reported as a retry, never as a failure. */
  why?: string;
}

export function useArenaWrites() {
  const submitter = useSubmitter();
  const game = useGameSession();
  const wallet = useOwnerWallet();
  const { address } = useWalletSession();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<ArenaBusy>(null);
  const [progress, setProgress] = useState<PickProgress | null>(null);
  const [refusal, setRefusal] = useState<ArenaRefusal | null>(null);

  const refresh = useCallback(async () => {
    if (address) await invalidateAfterWrite(queryClient, { wallet: address });
  }, [address, queryClient]);

  /**
   * One write, with its answer kept. Canton charges no network fee, so there is nothing to check before the seat's
   * route is asked; everything that is not `confirmed` lands in `refusal`, so no button can go quiet.
   */
  const send = useCallback(
    async (intent: ArenaIntent, key: Exclude<ArenaBusy, null>) => {
      if (!submitter || !address) return null;
      setBusy(key);
      setRefusal(null);
      try {
        const outcome = await submitter.submitTx(intent);
        if (outcome.status !== "confirmed") setRefusal({ key, diagnosis: outcome.diagnosis });
        return outcome;
      } catch (cause) {
        const diag = diagnosis("unknown", String((cause as Error)?.message ?? cause).slice(0, 200));
        setRefusal({ key, diagnosis: diag });
        return { status: "refused", diagnosis: diag } as const;
      } finally {
        setBusy(null);
        await refresh();
      }
    },
    [submitter, address, refresh],
  );

  /** The creator's write: the pot goes in and the sealed deck's hash goes on the ledger with it (`Arena_OpenDuel`). */
  const create = useCallback(
    (input: { matchId: Hash32; challenger: Address; tier: StakeTierId; deckHash: Hash32; deckSize: number; policyVersion: number; potBase: bigint; agent?: ArenaAgentGrant }) =>
      send(
        {
          kind: "arena-create",
          matchId: input.matchId,
          challenger: input.challenger,
          tier: stakeTierIndex(input.tier),
          deckHash: input.deckHash,
          deckSize: input.deckSize,
          policyVersion: input.policyVersion,
          potBase: input.potBase,
          ...(input.agent ? { agent: input.agent } : {}),
        },
        "create",
      ),
    [send],
  );

  const join = useCallback(
    (matchId: Hash32, potBase: bigint, agent?: ArenaAgentGrant) => send({ kind: "arena-join", matchId, potBase, ...(agent ? { agent } : {}) }, "join"),
    [send],
  );

  /** A pull, and the arena pays the player named on it rather than the caller. */
  const claim = useCallback((player: Address) => send({ kind: "arena-claim", player }, "claim"), [send]);

  /** Naming an agent key: the reference's re-key. Canton has none to name, so the lane refuses it with its own reason. */
  const authorize = useCallback((matchId: Hash32, agent: Address, ttlSec: number) => send({ kind: "arena-authorize", matchId, agent, ttlSec }, "authorize"), [send]);

  /**
   * The cranks a player may need to run themselves.
   *
   * Doc 04's recovery list requires it: with the operator's settler unavailable, a player must be able to score their
   * own card and award the pot. Neither can redirect a payout — the match pays whoever it already recorded.
   */
  const settleCard = useCallback(
    (matchId: Hash32, cardIndex: number) => send({ kind: "arena-settle-card", matchId, cardIndex }, `settle:${cardIndex}`),
    [send],
  );

  const finalize = useCallback((matchId: Hash32) => send({ kind: "arena-finalize", matchId }, "finalize"), [send]);
  /** Closes a pick window whose deadline has passed — permissionless, and the one crank a dead duel needs to end. */
  const lock = useCallback((matchId: Hash32) => send({ kind: "arena-lock", matchId }, "lock"), [send]);

  /**
   * One card, one side, retried while the deadline allows.
   *
   * The deadline guard stops attempts a few seconds early rather than at the line: a write already in flight still has
   * to land, and a pick recorded after the lock is refused. Each attempt is the seat's own route: a firm quote within
   * the tier's per-card cap, accepted with the duel's tag and recorded on the match; a price that moved past the cap
   * answers a requote, and the next attempt asks again.
   */
  const pick = useCallback(
    async (input: { matchId: Hash32; cardIndex: number; marketId: MarketId; side: Pick; stakeBase: bigint; deadlineSec: number }): Promise<ArenaPickOutcome> => {
      if (!submitter || !address) {
        return { status: "refused", diagnosis: diagnosis("signer-required", "this browser has no seat session bound") };
      }
      setBusy(`pick:${input.cardIndex}`);
      setRefusal(null);
      let last: ArenaPickOutcome = { status: "refused", diagnosis: diagnosis("order-expired", "the pick deadline passed before a fill landed") };

      try {
        for (let attempt = 1; attempt <= PICK_ATTEMPT_MAX; attempt += 1) {
          if (Math.floor(Date.now() / 1_000) >= input.deadlineSec - PICK_ATTEMPT_GUARD_SEC) break;
          setProgress({ cardIndex: input.cardIndex, attempt, why: attempt > 1 ? last.status : undefined });

          const quote = await quoteArenaPick(input.marketId, input.side, input.stakeBase);
          if (!isOk(quote) || !quote.value) continue;

          const floor = pickFloorRaw(quote.value.quantityRaw, attempt);
          last = await submitter.submitArenaPick({ kind: "arena-pick", matchId: input.matchId, cardIndex: input.cardIndex, pick: input.side, stakeBase: input.stakeBase, minQuantityRaw: floor });
          if (last.status === "confirmed" || last.status === "unknown") return last;
          // A refusal that is not a moved price (a spent seat, a closed window) will not change on a retry.
          if (last.status === "refused" && last.diagnosis.kind !== "requote" && last.diagnosis.kind !== "send-unknown") {
            setRefusal({ key: `pick:${input.cardIndex}`, diagnosis: last.diagnosis });
            return last;
          }
        }
        return last;
      } finally {
        setBusy(null);
        setProgress(null);
        await refresh();
      }
    },
    [submitter, address, refresh],
  );

  return {
    /** The agent key and its grant: none on Canton (the seat's own route places every pick). */
    game: game as GameSession,
    create,
    join,
    claim,
    authorize,
    settleCard,
    finalize,
    lock,
    pick,
    busy,
    progress,
    refusal,
    dismissRefusal: useCallback(() => setRefusal(null), []),
    canSign: Boolean(submitter && wallet),
  };
}
