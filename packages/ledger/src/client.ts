import { randomUUID } from "node:crypto";
import { tokenSourceFromEnv, type AuthDeps, type TokenSource } from "./auth";
import type { LedgerEnv } from "./env";
import { LedgerError } from "./errors";
import { createTransport, type HttpDeps, type RequestOptions, type Transport } from "./http";
import { assertCommandId } from "./ids";
import { awaitPendingSubmission, type InFlightReads, type InFlightWait, type PollOptions } from "./inflight";
import type {
  Command,
  Completion,
  CompletionStreamResponse,
  ConnectedSynchronizer,
  CreatedEvent,
  DeduplicationPeriod,
  DisclosedContract,
  EventFormat,
  JsCommands,
  JsExecuteSubmissionRequest,
  JsGetActiveContractsPageResponse,
  JsPrepareSubmissionRequest,
  JsPrepareSubmissionResponse,
  JsTransaction,
  JsUpdateEnvelope,
  LedgerApiVersion,
  Offset,
  Party,
  PartyDetails,
  TransactionFormat,
  TransactionShape,
} from "./types";

export interface LedgerClientConfig {
  baseUrl: string;
  auth: TokenSource;
  /** Sent as `userId` only when there is no user token (auth mode `none`). */
  userId?: string;
  timeoutMs?: number;
  submitTimeoutMs?: number;
  maxAttempts?: number;
  /**
   * How long a submit that met SUBMISSION_ALREADY_IN_FLIGHT waits for the pending submission's completion when the
   * caller passes no `deadlineMs`, from the in-flight answer. Default 180 s: Canton's own sequencing and confirmation
   * timeouts reject a stuck submission well inside it.
   */
  inFlightWaitMs?: number;
}

export interface EventFormatOptions {
  parties: Party[];
  /** Package-name form `#pkg:Module:Template`. Omit for a wildcard. */
  templateIds?: string[];
  /**
   * Package-name form `#pkg:Module:Interface` (C7b: the CIP-56 `Holding` interface). Each is an `InterfaceFilter` with
   * the interface view included, so a contract of ANY template that implements it comes back with `interfaceViews`.
   * With both lists the filters are cumulative; with neither, a wildcard.
   */
  interfaceIds?: string[];
  includeCreatedEventBlob?: boolean;
  verbose?: boolean;
}

export interface SubmitOptions {
  actAs: Party[];
  readAs?: Party[];
  commands: Command[];
  /** Stable per logical action; see `ids.ts`. Reused unchanged across retries. */
  commandId: string;
  workflowId?: string;
  disclosedContracts?: DisclosedContract[];
  synchronizerId?: string;
  deduplicationPeriod?: DeduplicationPeriod;
  /** Default `TRANSACTION_SHAPE_ACS_DELTA` with a wildcard over actAs ∪ readAs. */
  transactionShape?: TransactionShape;
  transactionFormat?: TransactionFormat;
  /** On DUPLICATE_COMMAND, find the earlier accepted completion and return its transaction. Default true. */
  recoverDuplicate?: boolean;
  /**
   * On SUBMISSION_ALREADY_IN_FLIGHT (an earlier submission of this commandId and actAs is still pending), wait for
   * that submission's completion and return its transaction, or throw its rejection. Nothing is re-sent. Default true.
   */
  recoverInFlight?: boolean;
  /** The caller's overall deadline, epoch ms. Bounds the in-flight wait; past it the outcome is reported unknown. */
  deadlineMs?: number;
  /**
   * A ledger offset read before this logical action's FIRST submission (a journal row's `beginOffset`). The in-flight
   * wait searches completions after it. Without it the client pins the ledger end before its own first resend, or
   * reads it at the in-flight answer when the pending submission came from an earlier call.
   */
  beginOffset?: Offset;
  onRetry?: RequestOptions["onRetry"];
  /** Observes each pause of the in-flight wait (for logs: a slow node can hold a submit here for minutes). */
  onInFlightWait?: (w: InFlightWait) => void;
}

export type { InFlightWait } from "./inflight";

export interface SubmitResult {
  transaction: JsTransaction;
  /** The submissionId of the attempt that produced the result (or of the earlier accepted one). */
  submissionId: string | undefined;
  attempts: number;
  /** True when this call returned an earlier submission's transaction (DUPLICATE_COMMAND or an in-flight wait). */
  recovered: boolean;
  /** Why `recovered` is true. */
  recoveredFrom?: "duplicate" | "in-flight";
}

export interface ActiveContractsPage {
  contracts: ActiveContract[];
  activeAtOffset: Offset;
  nextPageToken: string | undefined;
}

export interface ActiveContract {
  createdEvent: CreatedEvent;
  synchronizerId: string;
}

export type LedgerClient = ReturnType<typeof createLedgerClient>;

export function eventFormat(o: EventFormatOptions): EventFormat {
  const blob = o.includeCreatedEventBlob ?? false;
  const templates = (o.templateIds ?? []).map((templateId) => ({ identifierFilter: { TemplateFilter: { value: { templateId, includeCreatedEventBlob: blob } } } }));
  const interfaces = (o.interfaceIds ?? []).map((interfaceId) => ({
    identifierFilter: { InterfaceFilter: { value: { interfaceId, includeInterfaceView: true, includeCreatedEventBlob: blob } } },
  }));
  const cumulative = templates.length + interfaces.length > 0 ? [...templates, ...interfaces] : [{ identifierFilter: { WildcardFilter: { value: { includeCreatedEventBlob: blob } } } }];
  const filtersByParty: EventFormat["filtersByParty"] = {};
  for (const p of o.parties) filtersByParty[p] = { cumulative };
  return { filtersByParty, verbose: o.verbose ?? true };
}

export function createLedgerClient(cfg: LedgerClientConfig, deps: HttpDeps = {}) {
  const requestTimeoutMs = cfg.timeoutMs ?? 30_000;
  const http: Transport = createTransport(
    { baseUrl: cfg.baseUrl, auth: cfg.auth, timeoutMs: requestTimeoutMs, maxAttempts: cfg.maxAttempts ?? 4 },
    deps,
  );
  const submitTimeoutMs = cfg.submitTimeoutMs ?? 60_000;
  const inFlightWaitMs = cfg.inFlightWaitMs ?? 180_000;
  const now = deps.now ?? Date.now;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const random = deps.random ?? Math.random;
  const local = cfg.auth.mode === "none";
  const userIdField = (): { userId?: string } => (local && cfg.userId ? { userId: cfg.userId } : {});

  function requireLocal(what: string): void {
    if (!local) {
      throw new LedgerError({
        kind: "permission",
        path: what,
        message: `${what} is for the local sandbox only; on Noders parties and DARs are managed in the Console`,
      });
    }
  }

  async function ledgerEnd(req: PollOptions = {}): Promise<Offset> {
    const r = await http.request<{ offset?: Offset }>("GET", "/v2/state/ledger-end", req);
    return r.offset ?? 0;
  }

  async function activeContractsPage(
    o: EventFormatOptions & { activeAtOffset?: Offset; maxPageSize?: number; pageToken?: string },
  ): Promise<ActiveContractsPage> {
    const body = {
      eventFormat: eventFormat(o),
      ...(o.activeAtOffset === undefined ? {} : { activeAtOffset: o.activeAtOffset }),
      ...(o.maxPageSize === undefined ? {} : { maxPageSize: o.maxPageSize }),
      ...(o.pageToken === undefined ? {} : { pageToken: o.pageToken }),
    };
    const r = await http.request<JsGetActiveContractsPageResponse>("POST", "/v2/state/active-contracts-page", { json: body });
    const contracts: ActiveContract[] = [];
    for (const row of r.activeContracts ?? []) {
      const entry = row.contractEntry;
      if (entry && "JsActiveContract" in entry) {
        contracts.push({ createdEvent: entry.JsActiveContract.createdEvent, synchronizerId: entry.JsActiveContract.synchronizerId });
      }
    }
    return { contracts, activeAtOffset: r.activeAtOffset, nextPageToken: r.nextPageToken || undefined };
  }

  /**
   * Every page of one snapshot. The offset is pinned from `ledger-end` BEFORE the first page and
   * sent identically on every page: Canton binds a page token to the exact request, and a token
   * from a request without `activeAtOffset` is rejected (400 INVALID_ACS_PAGE_TOKEN, "prepared with
   * different event_format or active_at_offset") when the next page sends the resolved offset.
   */
  async function* iterateActiveContracts(o: EventFormatOptions & { activeAtOffset?: Offset; maxPageSize?: number }) {
    let pageToken: string | undefined;
    const at = o.activeAtOffset ?? (await ledgerEnd());
    do {
      const page = await activeContractsPage({ ...o, activeAtOffset: at, ...(pageToken ? { pageToken } : {}) });
      yield page;
      pageToken = page.nextPageToken;
    } while (pageToken);
  }

  async function activeContracts(o: EventFormatOptions & { activeAtOffset?: Offset; maxPageSize?: number }) {
    const out: ActiveContract[] = [];
    let at: Offset | undefined;
    for await (const page of iterateActiveContracts(o)) {
      out.push(...page.contracts);
      at = page.activeAtOffset;
    }
    return { contracts: out, activeAtOffset: at ?? 0 };
  }

  async function completions(o: { parties: Party[]; beginExclusive: Offset; limit?: number; idleTimeoutMs?: number }, req: PollOptions = {}) {
    const rows = await http.request<CompletionStreamResponse[]>("POST", "/v2/commands/completions", {
      query: { limit: o.limit ?? 200, stream_idle_timeout_ms: o.idleTimeoutMs ?? 1_000 },
      json: { parties: o.parties, beginExclusive: o.beginExclusive, ...userIdField() },
      ...req,
    });
    const out: Completion[] = [];
    let checkpoint: Offset | undefined;
    for (const r of rows) {
      const c = r.completionResponse;
      if (c && "Completion" in c) out.push(c.Completion.value);
      else if (c && "OffsetCheckpoint" in c) checkpoint = c.OffsetCheckpoint.value.offset;
    }
    return { completions: out, checkpoint };
  }

  /**
   * Scan completions from `beginExclusive` up to the current ledger end for the successful
   * completion of `commandId`. Rejected duplicates also appear as completions (status code 6), so
   * only `status.code === 0` with an `updateId` counts.
   */
  async function findAcceptedCompletion(commandId: string, parties: Party[], beginExclusive: Offset): Promise<Completion | undefined> {
    const end = await ledgerEnd();
    let from = Math.max(0, beginExclusive);
    while (from < end) {
      const { completions: batch } = await completions({ parties, beginExclusive: from, limit: 200 });
      if (batch.length === 0) return undefined;
      const hit = batch.find((c) => c.commandId === commandId && (c.status?.code ?? 0) === 0 && c.updateId);
      if (hit) return hit;
      from = Math.max(from + 1, ...batch.map((c) => c.offset));
    }
    return undefined;
  }

  async function updateById(updateId: string, format: TransactionFormat, req: PollOptions = {}): Promise<JsTransaction | undefined> {
    try {
      const r = await http.request<JsUpdateEnvelope>("POST", "/v2/updates/update-by-id", {
        json: { updateId, updateFormat: { includeTransactions: format } },
        ...req,
      });
      return r.update && "Transaction" in r.update ? r.update.Transaction.value : undefined;
    } catch (e) {
      if (e instanceof LedgerError && e.kind === "not-found") return undefined;
      throw e;
    }
  }

  const inFlightReads: InFlightReads = { ledgerEnd, completions, updateById };

  async function submitAndWaitForTransaction(o: SubmitOptions): Promise<SubmitResult> {
    assertCommandId(o.commandId);
    const parties = [...o.actAs, ...(o.readAs ?? [])];
    const transactionFormat: TransactionFormat = o.transactionFormat ?? {
      transactionShape: o.transactionShape ?? "TRANSACTION_SHAPE_ACS_DELTA",
      eventFormat: eventFormat({ parties }),
    };
    const recoverInFlight = o.recoverInFlight !== false;
    let attempts = 0;
    let submissionId: string | undefined;
    // A lower bound for this action's completions. Pinned before the first RESEND: a resend that then meets
    // SUBMISSION_ALREADY_IN_FLIGHT proves the earlier submission had not completed, so its completion lies after it.
    let floor: Offset | undefined = o.beginOffset;
    const pinFloor = async (): Promise<void> => {
      if (floor !== undefined) return;
      try {
        floor = await ledgerEnd({ retry: false, timeoutMs: Math.min(requestTimeoutMs, 10_000) });
      } catch {
        // Unreadable now: the next resend tries again, and the in-flight wait reads it at worst.
      }
    };
    const commandsFor = (attempt: number): JsCommands => {
      attempts = attempt;
      submissionId = randomUUID();
      return {
        commandId: o.commandId,
        submissionId,
        commands: o.commands,
        actAs: o.actAs,
        ...(o.readAs ? { readAs: o.readAs } : {}),
        ...userIdField(),
        ...(o.workflowId ? { workflowId: o.workflowId } : {}),
        ...(o.disclosedContracts ? { disclosedContracts: o.disclosedContracts } : {}),
        ...(o.synchronizerId ? { synchronizerId: o.synchronizerId } : {}),
        ...(o.deduplicationPeriod ? { deduplicationPeriod: o.deduplicationPeriod } : {}),
      };
    };
    try {
      const r = await http.request<{ transaction: JsTransaction }>("POST", "/v2/commands/submit-and-wait-for-transaction", {
        json: (attempt: number) => ({ commands: commandsFor(attempt), transactionFormat }),
        timeoutMs: submitTimeoutMs,
        ...(o.onRetry ? { onRetry: o.onRetry } : {}),
        ...(recoverInFlight ? { beforeRetry: pinFloor } : {}),
      });
      return { transaction: r.transaction, submissionId, attempts, recovered: false };
    } catch (e) {
      if (e instanceof LedgerError && e.kind === "in-flight" && recoverInFlight) {
        // The first attempt is still pending: wait for ITS completion (`inflight.ts`). Nothing is re-sent.
        const done = await awaitPendingSubmission(
          inFlightReads,
          { now, sleep, random, requestTimeoutMs, inFlightWaitMs },
          { commandId: o.commandId, actAs: o.actAs, inFlight: e, floor, transactionFormat, deadlineMs: o.deadlineMs, onInFlightWait: o.onInFlightWait },
        );
        return { ...done, attempts, recovered: true, recoveredFrom: "in-flight" };
      }
      if (!(e instanceof LedgerError) || e.kind !== "duplicate" || o.recoverDuplicate === false) throw e;
      const from = (e.duplicateCompletionOffset ?? 1) - 1;
      const done = await findAcceptedCompletion(o.commandId, o.actAs, from);
      const tx = done?.updateId ? await updateById(done.updateId, transactionFormat) : undefined;
      if (!tx) throw e;
      return { transaction: tx, submissionId: done?.submissionId, attempts, recovered: true, recoveredFrom: "duplicate" };
    }
  }

  return {
    http,
    auth: cfg.auth,
    version: () => http.request<LedgerApiVersion>("GET", "/v2/version"),
    ledgerEnd: () => ledgerEnd(),
    connectedSynchronizers: async () =>
      (await http.request<{ connectedSynchronizers?: ConnectedSynchronizer[] }>("GET", "/v2/state/connected-synchronizers"))
        .connectedSynchronizers ?? [],
    activeContractsPage,
    iterateActiveContracts,
    activeContracts,
    submitAndWaitForTransaction,
    completions: (o: Parameters<typeof completions>[0]) => completions(o),
    findAcceptedCompletion,
    updateById: (updateId: string, format: TransactionFormat) => updateById(updateId, format),
    /** Interactive submission, step 1: interpret without committing (dry run, cost estimate). */
    prepare: (req: Omit<JsPrepareSubmissionRequest, "userId">) =>
      http.request<JsPrepareSubmissionResponse>("POST", "/v2/interactive-submission/prepare", { json: { ...req, ...userIdField() } }),
    /** Interactive submission, step 2 (async). Use a fresh `submissionId` per attempt. */
    execute: (req: Omit<JsExecuteSubmissionRequest, "userId">) =>
      http.request<Record<string, never>>("POST", "/v2/interactive-submission/execute", { json: { ...req, ...userIdField() } }),
    executeAndWait: (req: Omit<JsExecuteSubmissionRequest, "userId">) =>
      http.request<{ updateId: string; completionOffset: Offset }>("POST", "/v2/interactive-submission/executeAndWait", {
        json: { ...req, ...userIdField() },
        timeoutMs: submitTimeoutMs,
      }),
    /** LOCAL SANDBOX ONLY. Noders accepts DARs through its Console. */
    async uploadDar(dar: Uint8Array, o: { vetAllPackages?: boolean } = {}): Promise<void> {
      requireLocal("uploadDar");
      await http.request("POST", "/v2/dars", { bytes: dar, query: { vetAllPackages: o.vetAllPackages ?? true }, retry: false, timeoutMs: 120_000 });
    },
    /** LOCAL SANDBOX ONLY. Noders parties are a fixed set created in its Console. */
    async allocateParty(partyIdHint: string, o: { userId?: string } = {}): Promise<PartyDetails> {
      requireLocal("allocateParty");
      const r = await http.request<{ partyDetails: PartyDetails }>("POST", "/v2/parties", {
        json: { partyIdHint, identityProviderId: "", ...(o.userId ? { userId: o.userId } : {}) },
        retry: false,
      });
      return r.partyDetails;
    },
  };
}

export function ledgerClientFromEnv(env: LedgerEnv, deps: HttpDeps & AuthDeps = {}): LedgerClient {
  return createLedgerClient(
    {
      baseUrl: env.LEDGER_JSON_API_URL,
      auth: tokenSourceFromEnv(env, deps),
      ...(env.LEDGER_AUTH_MODE === "none" ? { userId: env.LEDGER_USER_ID } : {}),
      timeoutMs: env.LEDGER_REQUEST_TIMEOUT_MS,
      submitTimeoutMs: env.LEDGER_SUBMIT_TIMEOUT_MS,
      maxAttempts: env.LEDGER_MAX_ATTEMPTS,
      inFlightWaitMs: env.LEDGER_INFLIGHT_WAIT_MS,
    },
    deps,
  );
}
