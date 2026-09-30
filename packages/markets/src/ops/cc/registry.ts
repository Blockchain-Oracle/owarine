/**
 * The token registry's off-ledger HTTP API, the client half (C7b): what a wallet or an ops actor calls before every
 * token-standard choice, to learn the factory contract, the choice context and the contracts to disclose. Written from
 * the published OpenAPI (`openapi/splice/token-standard/transfer-instruction-v1.yaml`, "transfer instruction off-ledger
 * API" 1.1.0), NOT run against a registry: nothing in this lane contacts a node. `fetch` is injected, so the tests
 * answer from fixtures and a deployment passes the real one.
 *
 * The registry API is unauthenticated by design (the standard relies on unguessable contract ids), so nothing here
 * sends a credential. A choice context is fetched fresh for each choice and never cached: contexts can be
 * choice-specific and their disclosed contracts expire.
 */
import { z } from "zod";
import type { DisclosedContract } from "@agari/ledger/pure";
import type { RegistryContext } from "./commands";

export class RegistryError extends Error {
  override readonly name = "RegistryError";
  constructor(message: string, readonly status: number | null = null) {
    super(message);
  }
}

const disclosed = z.object({ templateId: z.string(), contractId: z.string(), createdEventBlob: z.string(), synchronizerId: z.string() }).passthrough();
const choiceContext = z.object({ choiceContextData: z.record(z.string(), z.unknown()), disclosedContracts: z.array(disclosed) });
const factoryAnswer = z.object({ factoryId: z.string().min(1), transferKind: z.enum(["self", "direct", "offer"]), choiceContext });

const toContext = (c: z.infer<typeof choiceContext>): RegistryContext => ({
  choiceContextData: c.choiceContextData,
  disclosedContracts: c.disclosedContracts.map(
    (d): DisclosedContract => ({ templateId: d.templateId, contractId: d.contractId, createdEventBlob: d.createdEventBlob, synchronizerId: d.synchronizerId }),
  ),
});

export interface FactoryAnswer {
  factoryId: string;
  /** `offer`: the receiver must accept (two-step). `direct`: a preapproval completes it at once. `self`: sender = receiver. */
  transferKind: "self" | "direct" | "offer";
  context: RegistryContext;
}

export type InstructionChoice = "accept" | "reject" | "withdraw";

export interface RegistryClient {
  /** `POST /registry/transfer-instruction/v1/transfer-factory` for the given `TransferFactory_Transfer` choice argument. */
  transferFactory(choiceArguments: unknown): Promise<FactoryAnswer>;
  /** `POST /registry/transfer-instruction/v1/{id}/choice-contexts/{accept|reject|withdraw}`. */
  instructionContext(choice: InstructionChoice, transferInstructionId: string): Promise<RegistryContext>;
}

export interface RegistryClientConfig {
  /** The registry's base URL; the client appends `/registry/…`. */
  baseUrl: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

/** The most of an answer read: a registry's choice context is kilobytes, and a hostile endpoint must not fill memory. */
const MAX_BODY_BYTES = 1_048_576;

const isLoopback = (host: string): boolean => host === "localhost" || host === "127.0.0.1" || host === "[::1]";

export function createRegistryClient(cfg: RegistryClientConfig): RegistryClient {
  const doFetch = cfg.fetch ?? fetch;
  const base = cfg.baseUrl.replace(/\/+$/, "");
  const timeoutMs = cfg.timeoutMs ?? 15_000;
  // The registry's answer names the factory the venue then exercises with its own authority, so the endpoint is the trust
  // root: it must be the one the deployment configured, over TLS (a loopback stub for a local run is the only exception).
  const url = new URL(base);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopback(url.hostname))) throw new RegistryError("the registry URL must be https");

  async function post(path: string, body: unknown): Promise<unknown> {
    let response: Response;
    try {
      response = await doFetch(`${base}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw new RegistryError(`the registry did not answer: ${error instanceof Error ? error.name : "error"}`);
    }
    // The error body names the registry's reason, and it can echo our arguments (party and contract ids), so only the status is kept.
    if (!response.ok) throw new RegistryError(`the registry answered ${response.status}`, response.status);
    const declared = Number(response.headers.get("content-length") ?? "0");
    if (declared > MAX_BODY_BYTES) throw new RegistryError("the registry's answer is too large", response.status);
    let text: string;
    try {
      text = await response.text();
    } catch {
      throw new RegistryError("the registry's answer could not be read", response.status);
    }
    if (text.length > MAX_BODY_BYTES) throw new RegistryError("the registry's answer is too large", response.status);
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new RegistryError("the registry's answer was not JSON", response.status);
    }
  }

  return {
    async transferFactory(choiceArguments) {
      const raw = await post("/registry/transfer-instruction/v1/transfer-factory", { choiceArguments, excludeDebugFields: true });
      const parsed = factoryAnswer.safeParse(raw);
      if (!parsed.success) throw new RegistryError("the registry's factory answer did not match the token standard");
      return { factoryId: parsed.data.factoryId, transferKind: parsed.data.transferKind, context: toContext(parsed.data.choiceContext) };
    },
    async instructionContext(choice, transferInstructionId) {
      const raw = await post(`/registry/transfer-instruction/v1/${encodeURIComponent(transferInstructionId)}/choice-contexts/${choice}`, { excludeDebugFields: true });
      const parsed = choiceContext.safeParse(raw);
      if (!parsed.success) throw new RegistryError("the registry's choice context did not match the token standard");
      return toContext(parsed.data);
    },
  };
}
