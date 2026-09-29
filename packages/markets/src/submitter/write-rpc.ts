/**
 * A server or script session's own ledger access, as the submitter's deps name it. The reference passed a Solana RPC
 * here; on Canton ops and scripts reach the ledger through `packages/ledger` with a role party (C3), and the browser
 * never does (it goes through our route handlers). Until then it is a descriptor only: nothing reads it.
 */
export interface WriteRpc {
  /** The ledger route base or JSON Ledger API base this session writes through. */
  readonly endpoint: string;
}
