/**
 * `@agari/markets/desk`: the agent desk on Canton (C8f). The reference's mainnet desk (Jupiter on Solana) is a
 * `DeskMandate` whose live leg trades this venue's own markets with venue cash (K-090, `canton.ts`); practice desks stay
 * paper ledgers (K-091). Reads go over the ledger on a server and over the app's routes in a browser or the phone; the
 * owner writes through the routes as the leased seat; the operator (the agent-runner party) trades, sells, seals and
 * pauses through `operator.ts`.
 */
export {
  DESK_MINTS,
  deskSymbolOfMint,
  JUPITER_V6,
  TOKEN_2022_PROGRAM,
  TOKEN_PROGRAM,
  tokenProgramOf,
  USDC_MAINNET,
  type DeskAllowedToken,
  type DeskEvent,
  type DeskEventName,
  type DeskLedgerAccess,
  type DeskHistoryEntry,
  type DeskInitPlan,
  type DeskInitRecord,
  type DeskInitWant,
  type DeskMainnetSession,
  type DeskMainnetSessionConfig,
  type DeskMintState,
  type DeskRefState,
  type DeskRpc,
  type DeskState,
  type DeskTokenAccountState,
  type DeskWriteResult,
  type DiscoveredDesk,
  type Landing,
  type OwnerDeskBalances,
  type OwnerNameBalance,
  type SealedAction,
  type SignatureOutcome,
} from "./types";
export * from "./canton";
export * from "./wire";
export { DeskSendError, DeskSendUnknownError } from "./errors";
export {
  chainOfMandate,
  createDeskLedgerRpc,
  findLeasedMandate,
  findMandate,
  mintOf,
  namesOfAllowList,
  readMandates,
  associatedTokenAddress,
  chainNowSec,
  createBrowserDeskRpc,
  createDeskMainnetSession,
  createDeskRpc,
  deskAddress,
  deskTokenAccounts,
  initDesk,
  listDesksByOperator,
  readDeskEventsOf,
  readDeskHistory,
  readDeskInitPlan,
  readDeskMints,
  readDeskState,
  readOwnerDeskBalances,
  readSealsOf,
  sealedActionsOf,
  signatureOutcome,
  swapAccountsOf,
  type Instruction,
} from "./ops";
