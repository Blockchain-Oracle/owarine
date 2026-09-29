import { STAKE_TIERS, type MatchState } from "@agari/core/games";
import { isOk } from "@agari/core/schemas";
import type { Hash32 } from "@agari/core/types";
import { formatBaseUnits } from "@agari/core/units";
import { useArenaMatch, useArenaState } from "@agari/markets/react";
import { DUEL } from "@/features/games/duel/copy";
import { useArenaWrites } from "@/features/games/duel/useArenaWrites";
import { useVenue } from "@/features/markets/useVenue";
import { Cta } from "~/features/games/frame";
import { RefusalPlate } from "./DuelWaiting";
import { Body, Refusal } from "./parts";

/**
 * web's `DuelLobby.tsx` `OnChain`: the two writes a paired match needs, neither automatic. The creator puts the match
 * on the ledger with the sealed deck's hash (`Arena_OpenDuel`); the challenger joins once the ledger holds it. Both
 * escrow, so both are a button a player presses; the amount named is the arena's own tier price. Canton charges no
 * network fee and names no agent key, so the entry is the whole of it.
 */
export function OnChain({ state, isCreator }: { state: Extract<MatchState, { phase: "committed" }>; isCreator: boolean; wallet: string | null }) {
  const arena = useArenaState();
  const onChain = useArenaMatch(state.matchId as Hash32);
  const { boot } = useVenue();
  const { create, join, busy, canSign, refusal } = useArenaWrites();

  const tiers = arena && isOk(arena) ? arena.value?.tiers : undefined;
  const arenaTier = tiers?.[STAKE_TIERS.findIndex((t) => t.id === state.tier)];
  const potBase = arenaTier?.potBase ?? null;
  const decimals = boot && isOk(boot) ? boot.value.collateral.decimals : null;
  const symbol = boot && isOk(boot) ? boot.value.collateral.symbol : "";
  const money = (base: bigint | null) => (base === null || decimals === null ? "—" : formatBaseUnits(base, decimals, { maxDp: 2, minDp: 0 }));
  const pot = money(potBase);
  const created = onChain !== null && isOk(onChain) && onChain.value !== null;
  const { challenger } = state.players;
  const size = state.commitment.size;

  if (!canSign) return <Refusal>{DUEL.lobby.noSigner}</Refusal>;
  if (isCreator && created) return <Body>{DUEL.lobby.waitingJoin}</Body>;
  if (!isCreator && !created) return <Body>{DUEL.lobby.waitingCreate}</Body>;

  const key = isCreator ? "create" : "join";
  const send = () => {
    if (potBase === null) return;
    if (!isCreator) {
      void join(state.matchId as Hash32, potBase);
      return;
    }
    if (!challenger) return;
    void create({
      matchId: state.matchId as Hash32,
      challenger,
      tier: state.tier,
      deckHash: state.commitment.hash,
      deckSize: size,
      policyVersion: state.commitment.policyVersion,
      potBase,
    });
  };

  const body = isCreator ? DUEL.lobby.openBody(pot, symbol) : DUEL.lobby.joinBody(pot, symbol);
  const cta = busy === key ? (isCreator ? DUEL.lobby.opening : DUEL.lobby.joining) : refusal ? DUEL.lobby.refusedRetry : isCreator ? DUEL.lobby.openCta : DUEL.lobby.joinCta;

  return (
    <>
      <Body>{body}</Body>
      <Cta label={cta} disabled={busy !== null || potBase === null || (isCreator && !challenger)} onPress={send} />
      {refusal ? <RefusalPlate diagnosis={refusal.diagnosis} /> : null}
    </>
  );
}
