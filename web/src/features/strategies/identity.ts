import { parseStrategyMetadata } from "@agari/core/strategies";
import { isAddress } from "@agari/core/types";
import { addressUrl } from "@agari/core/urls";
import { codenameFromAddress } from "./names";

/** Public identity travels with the registry metadata, so a runner change cannot rename an agent. */
export function strategyIdentity(card: { strategyId: string; runner: string; metadata: string }): { name: string; seed: string } {
  const meta = parseStrategyMetadata(card.metadata);
  let seed = `agari-strategy:${card.strategyId}`;
  try {
    const raw: unknown = JSON.parse(card.metadata);
    if (raw && typeof raw === "object" && "portraitSeed" in raw && typeof raw.portraitSeed === "string" && raw.portraitSeed.length > 0 && raw.portraitSeed.length <= 128) seed = raw.portraitSeed;
  } catch { /* Legacy metadata keeps its deterministic fallback. */ }
  return { name: meta?.name.trim().slice(0, 64) || codenameFromAddress(seed), seed };
}

export const STRATEGY_MARKETS = "every live lane, 24/7 included";

/**
 * Where a runner's name links (C8g). A seat address has a public profile (`/u/<address>`); a runner that is a party
 * (the house agent-runner, or a self-hosted bot's party) has no page of its own, so its strategy is the place to read
 * it: `/strategies?view=copy&strategy=<id>` when one is named, otherwise no link at all rather than a 404.
 */
export function runnerHref(runner: string, strategyId?: string | null): string | null {
  if (isAddress(runner)) return addressUrl(runner);
  return strategyId ? `/strategies?view=copy&strategy=${encodeURIComponent(strategyId)}` : null;
}
