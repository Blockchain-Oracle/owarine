/**
 * An agent session from this process's configuration (C8f), for the strategy runner, the self-hosted runner and the X
 * relay. The agent is `<partyEnv>` when set (a self-hosting creator's own seat party), else the parties file's
 * `agent-runner` (the house runner, which is also the X executor and the desk operator, K-087). Quotes come from the
 * issuer in this process when the venue runs here, else from ops over its signed internal route
 * (`OPS_INTERNAL_URL` + `OPS_INTERNAL_SECRET`). Nothing is guessed: a missing piece is named, and the actor idles.
 */
import { routeQuoteSource, opsQuoteSource, type OpsRoute, type QuoteSource } from "@agari/markets/ops/agents";
import { createOpsClient } from "@agari/markets/server";
import type { IntentJournal } from "@agari/core/ports";
import { createVenueContext, type VenueContext } from "../venue/context";
import { createAgentSession, type AgentSession } from "./session";

const PARTY_ID = /^[A-Za-z0-9_\-:.]{1,255}::[0-9a-f]{8,}$/;

export interface AgentSessionInput {
  authority: AgentSession["authority"];
  /** The env variable that overrides the agent party (`RUNNER_PARTY`, `X_EXECUTOR_PARTY`). */
  partyEnv: string;
  venue?: VenueContext;
  /** The issuer's own handlers when the venue runs in this process. */
  routes?: { quotes: OpsRoute; exitQuotes: OpsRoute } | null;
  journal?: IntentJournal;
  env?: NodeJS.ProcessEnv;
}

export function quoteSourceFrom(routes: AgentSessionInput["routes"], env: NodeJS.ProcessEnv = process.env): QuoteSource | null {
  if (routes) return routeQuoteSource(routes);
  const baseUrl = env.OPS_INTERNAL_URL?.trim();
  const secret = env.OPS_INTERNAL_SECRET?.trim();
  return baseUrl && secret && secret.length >= 32 ? opsQuoteSource(createOpsClient({ baseUrl, secret })) : null;
}

export function agentSessionFrom(input: AgentSessionInput): { ok: true; session: AgentSession; venue: VenueContext } | { ok: false; why: string } {
  const env = input.env ?? process.env;
  const venue = input.venue ?? createVenueContext(env);
  const override = env[input.partyEnv]?.trim();
  if (override && !PARTY_ID.test(override)) return { ok: false, why: `${input.partyEnv} is not a party id` };
  const agent = override || venue.parties["agent-runner"];
  if (!agent) return { ok: false, why: `no agent party: set ${input.partyEnv} or AGENT_RUNNER_PARTY (or run the bootstrap's parties file)` };
  const quotes = quoteSourceFrom(input.routes, env);
  if (!quotes) return { ok: false, why: "no quote source: run the venue in this process, or set OPS_INTERNAL_URL and OPS_INTERNAL_SECRET" };
  const readAsVenue = env.AGENT_READ_AS_VENUE !== "0" && env.AGENT_READ_AS_VENUE !== "false";
  const net = env.NEXT_PUBLIC_CANTON_NETWORK;
  const cluster = net === "mainnet" || net === "testnet" || net === "devnet" || net === "localnet" ? net : "devnet";
  const session = createAgentSession({ client: venue.client, agent, venue: readAsVenue ? (venue.parties.venue ?? null) : null, quotes, authority: input.authority, cluster, ...(input.journal ? { journal: input.journal } : {}) });
  return { ok: true, session, venue };
}
