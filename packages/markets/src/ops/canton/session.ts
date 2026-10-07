/**
 * A role's ledger session: one party, one `actAs`, one client (plan §8; review G "createOpsClient(role) pins actAs").
 * Every venue actor writes through `submit`, which is where DRY_RUN lives: a dry session `prepare`s the command
 * against live ledger state and executes nothing (interactive submission, step 1).
 *
 * Discipline, not security: on Noders one ledger user may act as every party of the account.
 */
import {
  LedgerError,
  type ActiveContract,
  type Command,
  type ContractId,
  type CreatedEvent,
  type DisclosedContract,
  type JsTransaction,
  type LedgerClient,
  type Offset,
  type Party,
  type TransactionFormat,
} from "@owarine/ledger";
import { activeOf, templateSuffix, type Active } from "./decode";

export interface RoleSession {
  /** The role's short name (`venue`, `resolver`, `oracle-coinbase`, …): what logs and command ids say. */
  role: string;
  party: Party;
  client: LedgerClient;
  /** True: every submit is a `prepare` only. */
  dryRun: boolean;
}

export interface SubmitInput {
  commandId: string;
  commands: Command[];
  disclosedContracts?: DisclosedContract[];
  /** Template ids whose created events should carry their `createdEventBlob` (for disclosure to a user). */
  blobsFor?: readonly string[];
  /** A second controller for a two-controller choice (`Leg_CloseOut`: venue and owner). */
  alsoActAs?: readonly Party[];
  /** Parties whose contracts the command may read without acting as them (C7b: a withdrawal checks the owner holds the coin it was sent). */
  readAs?: readonly Party[];
  /** The ledger end read before this action's first submission: the in-flight wait's completion floor (`@owarine/ledger`). */
  beginOffset?: Offset;
  /** The action's overall deadline, epoch ms: bounds a wait on a pending earlier submission of the same command id. */
  deadlineMs?: number;
}

export type SubmitOutcome =
  | { kind: "done"; transaction: JsTransaction; recovered: boolean; created: CreatedEvent[]; ms: number }
  | { kind: "dry"; prepared: boolean; ms: number; note: string };

export function createdEvents(tx: JsTransaction): CreatedEvent[] {
  return tx.events.flatMap((e) => ("CreatedEvent" in e ? [e.CreatedEvent] : []));
}

/** Created events of one template (package-name or package-id form) in a transaction. */
export const createdOf = (created: readonly CreatedEvent[], templateId: string) =>
  created.filter((e) => templateSuffix(e.templateId) === templateSuffix(templateId));

/** The synchronizer a prepare names (the JSON API requires it, with a package preference, on `prepare`), per client. */
const synchronizers = new WeakMap<LedgerClient, Promise<string>>();
function synchronizerOf(client: LedgerClient): Promise<string> {
  let p = synchronizers.get(client);
  if (!p) {
    p = client.connectedSynchronizers().then((list) => {
      const id = list[0]?.synchronizerId;
      if (!id) throw new Error("the participant is connected to no synchronizer");
      return id;
    });
    p.catch(() => synchronizers.delete(client));
    synchronizers.set(client, p);
  }
  return p;
}

export async function submit(s: RoleSession, input: SubmitInput): Promise<SubmitOutcome> {
  const started = Date.now();
  if (s.dryRun) {
    // The prepare endpoint takes exactly one command; a multi-command write is validated by its first command.
    const [first] = input.commands;
    if (!first) return { kind: "dry", prepared: false, ms: 0, note: "nothing to prepare" };
    await s.client.prepare({
      commandId: input.commandId,
      commands: [first],
      synchronizerId: await synchronizerOf(s.client),
      packageIdSelectionPreference: [],
      actAs: [s.party, ...(input.alsoActAs ?? [])],
      ...(input.readAs ? { readAs: [...input.readAs] } : {}),
      ...(input.disclosedContracts ? { disclosedContracts: input.disclosedContracts } : {}),
    });
    const extra = input.commands.length > 1 ? ` (first of ${input.commands.length} commands)` : "";
    return { kind: "dry", prepared: true, ms: Date.now() - started, note: `DRY prepared ${input.commandId}${extra}` };
  }
  const blobs = input.blobsFor ?? [];
  const transactionFormat: TransactionFormat | undefined =
    blobs.length > 0
      ? {
          transactionShape: "TRANSACTION_SHAPE_ACS_DELTA",
          eventFormat: {
            filtersByParty: {
              [s.party]: {
                cumulative: [
                  ...blobs.map((templateId) => ({ identifierFilter: { TemplateFilter: { value: { templateId, includeCreatedEventBlob: true } } } })),
                  { identifierFilter: { WildcardFilter: { value: { includeCreatedEventBlob: false } } } },
                ],
              },
            },
            verbose: true,
          },
        }
      : undefined;
  const r = await s.client.submitAndWaitForTransaction({
    actAs: [s.party, ...(input.alsoActAs ?? [])],
    ...(input.readAs ? { readAs: [...input.readAs] } : {}),
    commandId: input.commandId,
    commands: input.commands,
    ...(input.disclosedContracts ? { disclosedContracts: input.disclosedContracts } : {}),
    ...(transactionFormat ? { transactionFormat } : {}),
    ...(input.beginOffset === undefined ? {} : { beginOffset: input.beginOffset }),
    ...(input.deadlineMs === undefined ? {} : { deadlineMs: input.deadlineMs }),
  });
  return { kind: "done", transaction: r.transaction, recovered: r.recovered, created: createdEvents(r.transaction), ms: Date.now() - started };
}

// ---- reads -----------------------------------------------------------------------------------------

/** Every active contract of `templateIds` the session's party sees, one paged snapshot. */
export async function readActive(s: RoleSession, templateIds: readonly string[], o: { blobs?: boolean } = {}): Promise<ActiveContract[]> {
  const { contracts } = await s.client.activeContracts({
    parties: [s.party],
    templateIds: [...templateIds],
    includeCreatedEventBlob: o.blobs ?? false,
    maxPageSize: 500,
  });
  return contracts;
}

/** Decoded contracts of one template from a mixed snapshot. A payload that fails to decode is dropped and reported. */
export function pick<T>(contracts: readonly ActiveContract[], templateId: string, decode: (v: unknown) => T, onBad?: (cid: ContractId, error: unknown) => void): Active<T>[] {
  const want = templateSuffix(templateId);
  const out: Active<T>[] = [];
  for (const c of contracts) {
    if (templateSuffix(c.createdEvent.templateId) !== want) continue;
    try {
      out.push(activeOf(c.createdEvent, decode));
    } catch (error) {
      onBad?.(c.createdEvent.contractId, error);
    }
  }
  return out;
}

// ---- refusals --------------------------------------------------------------------------------------

/** The engine's `failWithStatus` id (`abu-pm/quorum-not-met`) or the stdlib deadline id, from a rejection. */
export function refusalId(error: unknown): string | null {
  if (!(error instanceof LedgerError)) return null;
  const hay = `${error.message} ${JSON.stringify(error.context)}`;
  const m = /abu-pm\/[a-z0-9-]+/.exec(hay) ?? /stdlib\.daml\.com\/[a-z0-9-]+/.exec(hay);
  return m ? m[0] : null;
}

/**
 * A consumed or unknown contract: someone else got there first (the reference's "already done" codes). Canton 3.5
 * answers an input archived before routing with `UNKNOWN_CONTRACT_SYNCHRONIZERS` ("The following contracts have been
 * archived: List(…)"), measured through the ticket desk under load (C8e).
 */
export function isInactive(error: unknown): boolean {
  if (!(error instanceof LedgerError)) return false;
  const code = error.code ?? "";
  return code === "CONTRACT_NOT_FOUND" || code === "UNKNOWN_CONTRACT_SYNCHRONIZERS" || code.includes("INACTIVE") || /LOCAL_VERDICT_INACTIVE_CONTRACTS|CONTRACT_NOT_ACTIVE/.test(error.message);
}

/** The inactive contract ids a rejection names (Canton lists them in its cause), for the settler's retry. */
export function inactiveCids(error: unknown, candidates: readonly ContractId[]): ContractId[] {
  if (!(error instanceof LedgerError)) return [];
  const hay = `${error.message} ${JSON.stringify(error.context)}`;
  return candidates.filter((c) => hay.includes(c));
}

/**
 * An indefinite failure: the command may or may not have landed; resubmit only under the same command id. `in-flight`
 * reaches here only when a caller turned the client's in-flight wait off; an exhausted wait is a `timeout`.
 */
export const isIndefinite = (error: unknown): boolean =>
  error instanceof LedgerError && (error.kind === "timeout" || error.kind === "unavailable" || error.kind === "network" || error.kind === "in-flight");

/** A short loggable form of a ledger failure. */
export function failureText(error: unknown): string {
  if (error instanceof LedgerError) return `${error.code ?? error.kind}${refusalId(error) ? ` ${refusalId(error)}` : ""}: ${error.message.slice(0, 240)}`;
  return error instanceof Error ? error.message : String(error);
}
