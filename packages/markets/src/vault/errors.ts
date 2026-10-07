/**
 * The reference vault's refusals (7000–7299) in the one diagnosis vocabulary, keyed by Masayume's error names so web
 * refusal copy reads `errorName` unchanged. On Canton the trading balance is `VenueCash` (C7a) and its choices fail
 * with stable `failWithStatus` ids that map onto the same names; the table stays the single wording source.
 */
import { diagnosis, type Diagnosis, type DiagnosisKind } from "@owarine/core/types";

export const VAULT_ERROR_RANGE = { min: 7000, max: 7299 } as const;
/**
 * Anchor's own constraint failures run before any `#[error_code]` of ours (D-019): a grant account that does not exist
 * fails `AccountNotInitialized` (3012) or `AccountOwnedByWrongProgram` (3007), and an account whose seeds name another
 * owner fails `ConstraintSeeds` (2006). They mean the same thing to a person as 7100/7102, so they read the same.
 */
const ANCHOR_ERRORS = new Map<number, readonly [string, DiagnosisKind, string?]>([
  [2006, ["ConstraintSeeds", "grant-refused", "this account does not belong to that owner"]],
  [3007, ["AccountOwnedByWrongProgram", "grant-refused", "no grant with this id"]],
  [3012, ["AccountNotInitialized", "grant-refused", "no grant with this id"]],
]);
/** 7207's copy: a Window listed before the vault registered keeps a user in seat 0 (D-063). */
export const WINDOW_PREDATES_VAULT = "Trading Balance opens with the next Window";

/** code → [IDL / Masayume name, kind, what to tell a person when the name alone is not enough]. */
const VAULT_ERRORS = new Map<number, readonly [string, DiagnosisKind, string?]>([
  [7000, ["ZeroAmount", "below-min-quantity"]],
  [7001, ["Insufficient", "insufficient-collateral"]],
  [7002, ["WrongCollateral", "contract-revert"]],
  [7003, ["WrongTokenOwner", "contract-revert"]],
  [7004, ["NotAdmin", "contract-revert"]],
  [7005, ["MathOverflow", "contract-revert"]],
  [7100, ["NoSuchGrant", "grant-refused"]],
  [7101, ["NotGrantActor", "grant-refused"]],
  [7102, ["NotGrantOwner", "grant-refused"]],
  [7103, ["GrantIsRevoked", "grant-refused"]],
  [7104, ["GrantExpired", "grant-refused"]],
  [7105, ["BadExpiry", "grant-refused"]],
  [7106, ["ZeroActor", "grant-refused"]],
  [7107, ["BadGrantKind", "grant-refused"]],
  [7108, ["OverStakeCap", "grant-refused"]],
  [7109, ["OverDailyCap", "grant-refused"]],
  [7110, ["OverPositionCap", "grant-refused"]],
  [7111, ["OverPriceCap", "grant-refused"]],
  [7112, ["GrantAccountMissing", "grant-refused"]],
  [7113, ["ActiveGrantMismatch", "grant-refused"]],
  [7114, ["StaleGrantId", "grant-refused"]],
  [7115, ["GrantMarketMismatch", "grant-refused", "this grant trades one Window only"]],
  [7200, ["UnknownMarket", "market-not-trading"]],
  [7201, ["MarketNotTrading", "market-not-trading"]],
  [7202, ["MarketNotSettled", "not-settled"]],
  [7203, ["NothingToSettle", "already-claimed"]],
  [7204, ["BadOutcome", "contract-revert"]],
  [7205, ["BadPrice", "invalid-price"]],
  [7206, ["VaultNotRegistered", "not-deployed", "the Trading Balance is not registered on this venue yet"]],
  [7207, ["WindowPredatesVault", "market-not-trading", WINDOW_PREDATES_VAULT]],
  [7208, ["PositionSlotsFull", "contract-revert", "settle a finished Window first"]],
  [7209, ["EngineResultMissing", "contract-revert"]],
  [7210, ["EngineAccountingMismatch", "contract-revert"]],
]);

/** A named vault refusal as a diagnosis; unknown codes in the range are a plain revert with the code. */
export function vaultDiagnosis(code: number, technical: string): Diagnosis {
  const known = VAULT_ERRORS.get(code) ?? ANCHOR_ERRORS.get(code);
  if (!known) return diagnosis("contract-revert", `agari-vault ${code}: ${technical}`);
  const [name, kind, copy] = known;
  return diagnosis(kind, copy ? `${copy} (${name}): ${technical}` : `${name}: ${technical}`, { errorName: name });
}

/** A vault write's failure as the ledger adapter reports it: the refusal code when it is one of the table's, and the words. */
export interface VaultFailure {
  code: number | null;
  technical: string;
}

/** Any failure of a vault write: the vault's table when the code is one of its own, else a plain revert. */
export function vaultFailureDiagnosis(failure: VaultFailure): Diagnosis {
  const { code, technical } = failure;
  const known = code !== null && (ANCHOR_ERRORS.has(code) || (code >= VAULT_ERROR_RANGE.min && code <= VAULT_ERROR_RANGE.max));
  return known ? vaultDiagnosis(code, technical) : diagnosis("contract-revert", technical);
}
