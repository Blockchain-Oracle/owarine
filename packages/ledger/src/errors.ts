import type { Completion, JsCantonError } from "./types";

/**
 * Canton error categories as they arrive in `JsCantonError.errorCategory` (and as `category` in its
 * context). Ids from Canton's `ErrorCategory`; observed on Canton 3.5.17: INVALID_TOKEN /
 * INVALID_FIELD / COMMAND_PREPROCESSING_FAILED = 8, DUPLICATE_COMMAND = 10,
 * SUBMISSION_ALREADY_IN_FLIGHT = 2 (read from the 3.5.17 jar: `ConsistencyErrors.SubmissionAlreadyInFlight`).
 */
export const ERROR_CATEGORY = {
  TransientServerFailure: 1,
  ContentionOnSharedResources: 2,
  DeadlineExceededRequestStateUnknown: 3,
  SystemInternalAssumptionViolated: 4,
  MaliciousOrFaultyBehaviour: 5,
  AuthInterceptorInvalidAuthenticationCredentials: 6,
  InsufficientPermission: 7,
  InvalidIndependentOfSystemState: 8,
  InvalidGivenCurrentSystemStateOther: 9,
  InvalidGivenCurrentSystemStateResourceExists: 10,
  InvalidGivenCurrentSystemStateResourceMissing: 11,
  InvalidGivenCurrentSystemStateSeekAfterEnd: 12,
  BackgroundProcessDegradationWarning: 13,
  InternalUnsupportedOperation: 14,
} as const;

export type LedgerErrorKind =
  | "network" // fetch threw: DNS, refused, reset
  | "timeout" // our own deadline fired; the outcome of a submit is unknown
  | "unavailable" // 502/503/504/429 or a transient Canton category
  | "auth" // 401, a bad token, or the token endpoint refused
  | "permission" // 403 / InsufficientPermission
  | "schema" // 400 text/plain: the JSON failed the node's schema validation
  | "invalid" // Canton rejected the request as malformed
  | "duplicate" // DUPLICATE_COMMAND: an earlier submission under this change id was accepted
  | "in-flight" // SUBMISSION_ALREADY_IN_FLIGHT: an earlier submission under this change id is still pending
  | "not-found" // a contract, update or party is missing or inactive
  | "contention" // Canton says retry: locked contracts, capacity
  | "rejected" // Daml interpretation or a failed precondition
  | "too-large" // 413: the result set exceeds http-list-max-elements-limit
  | "unknown";

/**
 * The subset of `@owarine/core` `DiagnosisKind` names a transport failure can map to on its own. Domain
 * kinds (expired quote, no liquidity, ...) come from `failWithStatus` ids, which the markets layer maps.
 */
export type TransportDiagnosis = "rpc-down" | "send-unknown" | "contract-revert" | "unknown";

/**
 * Canton's id for "another submission with this change id (user id, command id, actAs) is still being processed".
 * Canton 3.5.17 answers it on a submit with HTTP 409, `errorCategory` 2 (ContentionOnSharedResources), gRPC 10
 * (ABORTED), cause "The submission is already in-flight" and context `changeId`, `existingSubmissionId`
 * (`Some(<id>)`), `existingSubmissionSynchronizerId`. In a completion status it is the message prefix
 * `SUBMISSION_ALREADY_IN_FLIGHT(2,<correlation>): ...`.
 */
export const SUBMISSION_ALREADY_IN_FLIGHT = "SUBMISSION_ALREADY_IN_FLIGHT";

/** True for the in-flight id as a JSON `code`, a gRPC status message (`ID(2,…): …`) or a proxy's plain-text body. */
export function isSubmissionAlreadyInFlight(codeOrText: string | null | undefined): boolean {
  return typeof codeOrText === "string" && /(^|[^A-Z_])SUBMISSION_ALREADY_IN_FLIGHT([^A-Z_]|$)/.test(codeOrText);
}

export interface LedgerErrorInit {
  kind: LedgerErrorKind;
  status?: number;
  path: string;
  message: string;
  canton?: JsCantonError;
  cause?: unknown;
  /** The submission's commandId, when the error is about one command. */
  commandId?: string;
  /** Overrides the definite-answer flag read from `canton` (a rejection completion is definite). */
  definiteAnswer?: boolean;
}

export class LedgerError extends Error {
  override readonly name = "LedgerError";
  readonly kind: LedgerErrorKind;
  /** HTTP status, when there was a response. */
  readonly status: number | undefined;
  readonly path: string;
  /** Canton's error id, e.g. `DUPLICATE_COMMAND`, `CONTRACT_NOT_FOUND`, `DAML_FAILURE`. */
  readonly code: string | undefined;
  readonly errorCategory: number | undefined;
  readonly correlationId: string | undefined;
  /** Canton's trace id; Noders returns only this on some errors. */
  readonly traceId: string | undefined;
  /** True when Canton says the command definitely did not (or definitely did) land. */
  readonly definiteAnswer: boolean | undefined;
  /** Server hint for when to retry, in ms, parsed from `retryInfo`. */
  readonly retryAfterMs: number | undefined;
  readonly context: Readonly<Record<string, string>>;
  readonly canton: JsCantonError | undefined;
  /** The commandId this error is about, when the client knows it (in-flight recovery sets it). */
  readonly commandId: string | undefined;

  constructor(init: LedgerErrorInit) {
    super(init.message, init.cause === undefined ? undefined : { cause: init.cause });
    this.kind = init.kind;
    this.status = init.status;
    this.path = init.path;
    const c = init.canton;
    this.canton = c;
    this.code = c?.code;
    this.errorCategory = c?.errorCategory;
    this.correlationId = c?.correlationId ?? undefined;
    this.traceId = c?.traceId ?? c?.context?.tid ?? undefined;
    this.context = c?.context ?? {};
    this.definiteAnswer = init.definiteAnswer ?? c?.definiteAnswer ?? parseBool(c?.context?.definite_answer);
    this.retryAfterMs = parseRetryInfo(c?.retryInfo);
    this.commandId = init.commandId;
  }

  /**
   * Safe to resend under the SAME commandId (dedup makes it idempotent within the dedup period). Not `in-flight`:
   * a resend meets the same pending change id, so the client waits for that submission's completion instead.
   */
  get retryable(): boolean {
    return this.kind === "network" || this.kind === "timeout" || this.kind === "unavailable" || this.kind === "contention";
  }

  get diagnosis(): TransportDiagnosis {
    switch (this.kind) {
      case "network":
      case "unavailable":
        return "rpc-down";
      case "timeout":
      case "duplicate":
      case "in-flight":
        return "send-unknown";
      case "rejected":
      case "not-found":
      case "contention":
        return "contract-revert";
      default:
        return "unknown";
    }
  }

  /** For a DUPLICATE_COMMAND: the offset of the earlier accepted completion, from the error context. */
  get duplicateCompletionOffset(): number | undefined {
    const raw = this.context.completion_offset;
    if (raw === undefined || !/^\d+$/.test(raw)) return undefined;
    const n = Number(raw);
    return Number.isSafeInteger(n) ? n : undefined;
  }

  /**
   * For a DUPLICATE_COMMAND or SUBMISSION_ALREADY_IN_FLIGHT: the submissionId of the earlier submission, from the
   * context's `existingSubmissionId` (Canton prints a Scala `Option`: `Some(<id>)` or `None`).
   */
  get existingSubmissionId(): string | undefined {
    const raw = this.context.existingSubmissionId;
    if (raw === undefined || raw === "" || raw === "None") return undefined;
    const m = /^Some\((.*)\)$/.exec(raw);
    return m ? m[1] || undefined : raw;
  }
}

function parseBool(v: string | undefined): boolean | undefined {
  if (v === "true") return true;
  if (v === "false") return false;
  return undefined;
}

/** `retryInfo` is free text such as "1 second" or "500 milliseconds". */
export function parseRetryInfo(v: string | null | undefined): number | undefined {
  if (!v) return undefined;
  const m = /^\s*(\d+(?:\.\d+)?)\s*(ms|millis|milliseconds?|s|secs?|seconds?|m|mins?|minutes?)\b/i.exec(v);
  if (!m) return undefined;
  const n = Number(m[1]);
  const unit = m[2]!.toLowerCase();
  if (/^(ms|millis|milliseconds?)$/.test(unit)) return Math.round(n);
  if (/^(m|mins?|minutes?)$/.test(unit)) return Math.round(n * 60_000);
  return Math.round(n * 1000);
}

export function isJsCantonError(v: unknown): v is JsCantonError {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as JsCantonError).code === "string" &&
    typeof (v as JsCantonError).cause === "string" &&
    typeof (v as JsCantonError).errorCategory === "number"
  );
}

export function kindFromCanton(status: number | undefined, e: JsCantonError): LedgerErrorKind {
  if (e.code === "DUPLICATE_COMMAND") return "duplicate";
  if (isSubmissionAlreadyInFlight(e.code)) return "in-flight";
  const C = ERROR_CATEGORY;
  switch (e.errorCategory) {
    case C.TransientServerFailure:
      return "unavailable";
    case C.ContentionOnSharedResources:
      return "contention";
    case C.DeadlineExceededRequestStateUnknown:
      return "timeout";
    case C.AuthInterceptorInvalidAuthenticationCredentials:
      return "auth";
    case C.InsufficientPermission:
      return "permission";
    case C.InvalidIndependentOfSystemState:
      // INVALID_TOKEN is category 8 too (a missing user id without a token): an auth problem.
      return e.code === "INVALID_TOKEN" ? "auth" : "invalid";
    case C.InvalidGivenCurrentSystemStateResourceMissing:
      return "not-found";
    case C.InvalidGivenCurrentSystemStateOther:
    case C.InvalidGivenCurrentSystemStateResourceExists:
    case C.InvalidGivenCurrentSystemStateSeekAfterEnd:
      return "rejected";
    default:
      return status === undefined ? "unknown" : kindFromStatus(status);
  }
}

export function kindFromStatus(status: number): LedgerErrorKind {
  if (status === 401) return "auth";
  if (status === 403) return "permission";
  if (status === 404) return "not-found";
  if (status === 409) return "rejected";
  if (status === 413) return "too-large";
  if (status === 429 || status === 502 || status === 503 || status === 504) return "unavailable";
  if (status >= 500) return "unavailable";
  if (status === 400) return "invalid";
  return "unknown";
}

/** Build a `LedgerError` from a non-2xx response body. Never includes request bodies or tokens. */
export function errorFromResponse(path: string, status: number, contentType: string, bodyText: string): LedgerError {
  if (status === 413) {
    return new LedgerError({
      kind: "too-large",
      status,
      path,
      message:
        `${path} → 413: the result exceeds the node's http-list-max-elements-limit. ` +
        "Use activeContractsPage()/activeContractsAll() with a smaller maxPageSize, or the /v2/updates WebSocket.",
    });
  }
  let parsed: unknown;
  if (contentType.includes("json")) {
    try {
      parsed = JSON.parse(bodyText);
    } catch {
      parsed = undefined;
    }
  }
  if (isJsCantonError(parsed)) {
    const kind = status === 413 ? "too-large" : kindFromCanton(status, parsed);
    return new LedgerError({ kind, status, path, canton: parsed, message: `${path} → ${status} ${parsed.code}: ${parsed.cause}` });
  }
  const snippet = bodyText.slice(0, 500);
  // A proxy or gRPC gateway that passes the status message through as text: still the in-flight answer.
  if (isSubmissionAlreadyInFlight(snippet)) {
    return new LedgerError({ kind: "in-flight", status, path, message: `${path} → ${status} ${SUBMISSION_ALREADY_IN_FLIGHT}: ${snippet}` });
  }
  if (status === 400) {
    return new LedgerError({ kind: "schema", status, path, message: `${path} → 400 (schema): ${snippet}` });
  }
  return new LedgerError({ kind: kindFromStatus(status), status, path, message: `${path} → ${status}: ${snippet}` });
}

/**
 * A rejection completion as a `LedgerError`. Canton's status message is `<ERROR_ID>(<category>,<correlation>): <cause>`
 * (e.g. `MEDIATOR_SAYS_TX_TIMED_OUT(2,1a2b3c4d): Rejected transaction ...`, category 2 per the 3.5.17 jar); the id and category give the kind the same
 * way a synchronous answer's body does. A completion is a definite answer for its submission.
 */
export function errorFromCompletion(path: string, c: Completion): LedgerError {
  const message = c.status?.message ?? "";
  const m = /^([A-Z][A-Z0-9_]*)\((\d+),([^)]*)\):\s*([\s\S]*)$/.exec(message);
  const canton: JsCantonError = m
    ? { code: m[1]!, cause: m[4]!, errorCategory: Number(m[2]), correlationId: m[3] || null, grpcCodeValue: c.status?.code ?? null, context: {} }
    : { code: `GRPC_STATUS_${c.status?.code ?? "UNKNOWN"}`, cause: message, errorCategory: -1, grpcCodeValue: c.status?.code ?? null, context: {} };
  const kind = m ? kindFromCanton(undefined, canton) : "rejected";
  return new LedgerError({
    kind: kind === "unknown" ? "rejected" : kind,
    path,
    canton,
    commandId: c.commandId,
    definiteAnswer: true,
    message: `commandId ${c.commandId}: submission ${c.submissionId ?? "(no submissionId)"} was rejected at offset ${c.offset}: ${message || `gRPC status ${c.status?.code ?? "?"}`}`,
  });
}
