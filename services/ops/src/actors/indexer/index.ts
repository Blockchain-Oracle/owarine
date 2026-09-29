/**
 * The Solana indexer's slot in `main.ts` (`OPS_ACTORS=indexer`), kept until the stage owner wires `startProjector`
 * directly: the indexer became the projector (plan "Venue operations and the projector"). See `../projector`.
 */
import type { VenueDeps } from "../../runtime";
import { startProjector } from "../projector";

export async function startIndexer(deps: VenueDeps, env: NodeJS.ProcessEnv = process.env): Promise<{ stop: () => Promise<void> } | null> {
  return startProjector(deps, env, { heartbeatName: "indexer" });
}
