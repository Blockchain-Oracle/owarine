import { ADVICE_COPY } from "@agari/core/copy";
import type { Metadata } from "next";
import { StrategiesScreen } from "@/features/strategies";
import { seatServer } from "@/lib/ledger.server";

export const metadata: Metadata = { title: "Strategies" };

/**
 * The house runner is a party on Canton (C8f): the parties file's `agent-runner` (or `AGARI_AGENT_RUNNER_PARTY`), the
 * same agent that places for X and runs desks (K-087). The studio names it when a creator picks "Let Agari run it"; a
 * deployment without it says a house runner is not configured, and a creator runs its own bot instead.
 */
export const dynamic = "force-dynamic";

export default function Page() {
  const state = seatServer();
  const houseRunner = state.ok ? state.server.parties.agentRunner : null;
  return (
    <>
      <StrategiesScreen houseRunner={houseRunner} />
      <p className="container pb-10 type-caption text-ink-muted">{ADVICE_COPY.notAdvice}</p>
    </>
  );
}
