/**
 * Where an agent gets the venue's firm quotes for the owner it acts for (C8f): the strategy runner, the X executor and
 * the desk operator never issue a quote themselves. In the ops process that runs the venue they call the issuer's
 * handlers directly; anywhere else (a self-hosted runner) they call ops over the signed internal HTTP route. Either way
 * the request carries the OWNER's party (the quote is the owner's to accept, through the grant or the mandate) and a
 * lease id naming the agent, and the reply is parsed with the same wire the web's routes use.
 */
import { diagnosis } from "@agari/core/types";
import { exitQuoteReplyWire, quoteReplyWire, toWire, type ExitQuoteReply, type QuoteReply } from "../../provider/ledger-wire";
import type { OpsClient, OpsExitQuoteRequest, OpsQuoteRequest } from "../../server/ops-client";

export type OpsRoute = (body: unknown) => Promise<{ status: number; body: unknown }>;

export interface QuoteSource {
  quote(request: OpsQuoteRequest): Promise<QuoteReply>;
  exitQuote(request: OpsExitQuoteRequest): Promise<ExitQuoteReply>;
}

const json = (v: unknown): unknown => JSON.parse(JSON.stringify(v, (_k, x: unknown) => (typeof x === "bigint" ? x.toString() : x)));

/** The issuer's own handlers, in process (`startQuoteIssuer`'s `handle` and `handleExit`). */
export function routeQuoteSource(routes: { quotes: OpsRoute; exitQuotes: OpsRoute }): QuoteSource {
  const call = async <T>(route: OpsRoute, request: unknown, wire: { safeParse(v: unknown): { success: true; data: T } | { success: false; error: { message: string } } }): Promise<T> => {
    const answer = await route(toWire(request));
    const body = json(answer.body) as { diagnosis?: unknown } | null;
    if (answer.status !== 200) {
      const d = body && typeof body === "object" && "diagnosis" in body ? (body.diagnosis as ReturnType<typeof diagnosis>) : diagnosis("unknown", `issuer answered ${answer.status}`);
      return { kind: "refused", diagnosis: d } as T;
    }
    const parsed = wire.safeParse(body);
    return parsed.success ? parsed.data : ({ kind: "refused", diagnosis: diagnosis("unknown", `issuer reply did not parse: ${parsed.error.message.slice(0, 200)}`) } as T);
  };
  return {
    quote: (request) => call<QuoteReply>(routes.quotes, request, quoteReplyWire),
    exitQuote: (request) => call<ExitQuoteReply>(routes.exitQuotes, request, exitQuoteReplyWire),
  };
}

/** Ops over the signed internal route (a runner outside the venue's process). */
export function opsQuoteSource(ops: OpsClient): QuoteSource {
  return { quote: (request) => ops.quote(request), exitQuote: (request) => ops.exitQuote(request) };
}

/** The lease id an agent's quote requests carry: the issuer logs it, and it is never a seat's lease. */
export const agentLeaseId = (role: "strategy" | "x" | "desk"): string => `agent-${role}`;
