/**
 * Wire types for the JSON Ledger API v2 endpoints this package uses, hand-written from the Noders
 * node's own spec (`GET /docs/openapi`, info.version 3.5.18, fetched 2026-09-29) and checked against
 * real responses from a local Canton 3.5.17 sandbox. Only the fields we read or send are typed;
 * everything the 3.5 spec relaxed to optional stays optional here.
 *
 * Offsets are int64 on the wire and arrive as JSON numbers; every participant offset in practice is
 * far below 2^53, and `assertOffset` rejects anything that is not a safe non-negative integer.
 */

export type Party = string;
export type ContractId = string;
export type Offset = number;

/** Daml-LF JSON value. Int and Numeric arrive as strings; convert through `units.ts` only. */
export type DamlValue = unknown;

// ---- commands -------------------------------------------------------------------------------

export interface CreateCommand {
  CreateCommand: { templateId: string; createArguments: DamlValue };
}
export interface ExerciseCommand {
  ExerciseCommand: { templateId: string; contractId: ContractId; choice: string; choiceArgument: DamlValue };
}
export interface CreateAndExerciseCommand {
  CreateAndExerciseCommand: { templateId: string; createArguments: DamlValue; choice: string; choiceArgument: DamlValue };
}
export type Command = CreateCommand | ExerciseCommand | CreateAndExerciseCommand;

export interface DisclosedContract {
  createdEventBlob: string;
  templateId?: string;
  contractId?: ContractId;
  synchronizerId?: string;
}

export type DeduplicationPeriod =
  | { DeduplicationDuration: { value: { seconds: number; nanos: number } } }
  | { DeduplicationOffset: { value: Offset } }
  | { Empty: Record<string, never> };

/** `JsCommands`. `userId` is only sent when there is no user token (local sandbox). */
export interface JsCommands {
  commandId: string;
  commands: Command[];
  actAs: Party[];
  readAs?: Party[];
  userId?: string;
  workflowId?: string;
  submissionId?: string;
  deduplicationPeriod?: DeduplicationPeriod;
  disclosedContracts?: DisclosedContract[];
  synchronizerId?: string;
  packageIdSelectionPreference?: string[];
}

// ---- formats and filters ----------------------------------------------------------------------

export type TransactionShape = "TRANSACTION_SHAPE_ACS_DELTA" | "TRANSACTION_SHAPE_LEDGER_EFFECTS";

export type IdentifierFilter =
  | { WildcardFilter: { value: { includeCreatedEventBlob?: boolean } } }
  | { TemplateFilter: { value: { templateId: string; includeCreatedEventBlob?: boolean } } }
  | { InterfaceFilter: { value: { interfaceId: string; includeInterfaceView?: boolean; includeCreatedEventBlob?: boolean } } };

export interface Filters {
  cumulative?: { identifierFilter: IdentifierFilter }[];
}

export interface EventFormat {
  filtersByParty?: Record<Party, Filters>;
  filtersForAnyParty?: Filters;
  verbose?: boolean;
}

export interface TransactionFormat {
  transactionShape: TransactionShape;
  eventFormat: EventFormat;
}

export interface UpdateFormat {
  includeTransactions?: TransactionFormat;
}

// ---- events and transactions ------------------------------------------------------------------

export interface CreatedEvent {
  offset: Offset;
  nodeId: number;
  contractId: ContractId;
  /** Always the package-id form in responses (`<pkgId>:<Module>:<Template>`). */
  templateId: string;
  packageName: string;
  createArgument: DamlValue;
  createdEventBlob?: string;
  witnessParties: Party[];
  signatories: Party[];
  observers?: Party[];
  createdAt: string;
  representativePackageId?: string;
  acsDelta?: boolean;
}

export interface ArchivedEvent {
  offset: Offset;
  nodeId: number;
  contractId: ContractId;
  templateId: string;
  packageName: string;
  witnessParties: Party[];
}

export interface ExercisedEvent {
  offset: Offset;
  nodeId: number;
  contractId: ContractId;
  templateId: string;
  interfaceId?: string | null;
  choice: string;
  choiceArgument: DamlValue;
  actingParties: Party[];
  consuming: boolean;
  witnessParties: Party[];
  lastDescendantNodeId: number;
  exerciseResult?: DamlValue;
  packageName: string;
  acsDelta?: boolean;
}

export type Event = { CreatedEvent: CreatedEvent } | { ArchivedEvent: ArchivedEvent } | { ExercisedEvent: ExercisedEvent };

export interface JsTransaction {
  updateId: string;
  /** Present only for the submitting party. */
  commandId?: string;
  workflowId?: string;
  effectiveAt: string;
  events: Event[];
  offset: Offset;
  synchronizerId: string;
  recordTime: string;
}

export interface OffsetCheckpoint {
  offset: Offset;
  synchronizerTimes?: { synchronizerId: string; recordTime: string }[];
}

/** One element of `/v2/updates` (HTTP array or WebSocket frame) and the `update-by-id` body. */
export interface JsUpdateEnvelope {
  update?:
    | { Transaction: { value: JsTransaction } }
    | { OffsetCheckpoint: { value: OffsetCheckpoint } }
    | { Reassignment: { value: unknown } }
    | { TopologyTransaction: { value: unknown } };
}

// ---- state ------------------------------------------------------------------------------------

export interface JsActiveContract {
  createdEvent: CreatedEvent;
  synchronizerId: string;
  reassignmentCounter: number;
}

export interface JsGetActiveContractsResponse {
  workflowId?: string;
  contractEntry?:
    | { JsActiveContract: JsActiveContract }
    | { JsEmpty: Record<string, never> }
    | { JsIncompleteAssigned: unknown }
    | { JsIncompleteUnassigned: unknown };
  streamContinuationToken?: string | null;
}

export interface JsGetActiveContractsPageResponse {
  activeContracts: JsGetActiveContractsResponse[];
  activeAtOffset: Offset;
  nextPageToken?: string | null;
}

export interface ConnectedSynchronizer {
  synchronizerAlias: string;
  synchronizerId: string;
  permission?: string;
}

export interface LedgerApiVersion {
  version: string;
  features: Record<string, unknown>;
}

export interface PartyDetails {
  party: Party;
  isLocal?: boolean;
  identityProviderId?: string;
}

// ---- completions ------------------------------------------------------------------------------

export interface JsStatus {
  code: number;
  message: string;
  details?: unknown[];
}

export interface Completion {
  commandId: string;
  status?: JsStatus;
  /** Set only for a successful command. */
  updateId?: string;
  userId: string;
  actAs: Party[];
  submissionId?: string;
  offset: Offset;
}

export interface CompletionStreamResponse {
  completionResponse?:
    | { Completion: { value: Completion } }
    | { OffsetCheckpoint: { value: OffsetCheckpoint } }
    | { Empty: Record<string, never> };
}

// ---- interactive submission -------------------------------------------------------------------

export type HashingSchemeVersion = "HASHING_SCHEME_VERSION_UNSPECIFIED" | "HASHING_SCHEME_VERSION_V2" | "HASHING_SCHEME_VERSION_V3";

export interface JsPrepareSubmissionRequest {
  commandId: string;
  /** Only single-command transactions are supported by the API today. */
  commands: [Command];
  actAs: Party[];
  readAs?: Party[];
  userId?: string;
  disclosedContracts?: DisclosedContract[];
  synchronizerId?: string;
  packageIdSelectionPreference?: string[];
  verboseHashing?: boolean;
  maxRecordTime?: string;
  hashingSchemeVersion?: HashingSchemeVersion;
}

export interface JsPrepareSubmissionResponse {
  preparedTransaction: string;
  preparedTransactionHash: string;
  hashingSchemeVersion: HashingSchemeVersion;
  hashingDetails?: string;
  costEstimation?: {
    estimationTimestamp: string;
    confirmationRequestTrafficCostEstimation: number;
    confirmationResponseTrafficCostEstimation: number;
    totalTrafficCostEstimation: number;
  };
}

export interface PartySignature {
  format: string;
  signature: string;
  signedBy: string;
  signingAlgorithmSpec: string;
}

export interface JsExecuteSubmissionRequest {
  preparedTransaction: string;
  partySignatures: { signatures: { party: Party; signatures: PartySignature[] }[] };
  submissionId: string;
  hashingSchemeVersion: HashingSchemeVersion;
  userId?: string;
  deduplicationPeriod?: DeduplicationPeriod;
}

// ---- errors -----------------------------------------------------------------------------------

/** `JsCantonError`, the body of every non-2xx JSON response. `retryInfo` is a string or null. */
export interface JsCantonError {
  code: string;
  cause: string;
  correlationId?: string | null;
  traceId?: string | null;
  context?: Record<string, string>;
  errorCategory: number;
  grpcCodeValue?: number | null;
  retryInfo?: string | null;
  definiteAnswer?: boolean | null;
}
