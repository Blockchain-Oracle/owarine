/**
 * The owner's desk writes from the browser or the phone (C8f): each is one `POST /api/ledger/desk/<action>` with a fresh
 * journal UUID; the server submits it as the leased seat's party only (`server/desk-seat.ts`) and answers with the
 * update it landed in. Nothing here holds a party, a ledger URL or a credential.
 *
 * A name is not a token the owner holds apart from the desk (K-090): depositing or withdrawing a company is refused
 * with the reason, and the desk's holdings reach the owner's seat when their Window settles.
 */
import type { Address, Signature } from "@owarine/core/types";
import { PRE_IPO_SYMBOLS, type PreIpoSymbol } from "@owarine/core/market";
import { ledgerRequest } from "../provider/ledger-api";
import { deskStateFromWire, deskStateReplyWire, deskWriteReplyWire, type DeskOwnerAction } from "./wire";
import { DeskSendError, DeskSendUnknownError } from "./errors";
import { DESK_MINTS, USDC_MAINNET, type DeskMainnetSession, type DeskWriteResult } from "./types";

const symbolOfMint = (mint: Address): PreIpoSymbol | null => PRE_IPO_SYMBOLS.find((s) => DESK_MINTS[s] === mint) ?? null;

const uuid = (): string => globalThis.crypto.randomUUID();

async function write(action: DeskOwnerAction, body: Record<string, unknown>): Promise<DeskWriteResult> {
  const commandId = uuid();
  const r = await ledgerRequest(`/desk/${action}`, { method: "POST", body: { commandId, ...body }, wire: deskWriteReplyWire });
  if (!r.ok) throw new DeskSendError("simulation", new Error(r.diagnosis.technical), null);
  const v = r.value;
  if (v.kind === "confirmed") return { signature: v.updateId as Signature, landing: { kind: "landed", slot: BigInt(v.offset) } };
  if (v.kind === "unknown") throw new DeskSendUnknownError(`agent:${commandId}` as Signature, "expired");
  throw new DeskSendError("simulation", new Error(v.diagnosis.technical), null);
}

const refuse = (why: string): Promise<never> => Promise.reject(new DeskSendError("simulation", new Error(why), null));

const NAME_MOVES = "A company comes into the desk only by the desk buying it, and leaves when it sells or its Window settles into your seat.";

export function deskClientWrites(owner: Address): DeskMainnetSession {
  return {
    owner,
    async readState() {
      const r = await ledgerRequest("/desk", { method: "GET", wire: deskStateReplyWire });
      if (!r.ok) throw new Error(r.diagnosis.technical);
      return r.value.state ? deskStateFromWire(r.value.state) : null;
    },
    openDesk: (i) => write("open", { operator: i.operator, perActionCapE6: i.perActionCapE6, dailyCapE6: i.dailyCapE6, maxPremiumBps: i.maxPremiumBps, mode: i.mode }),
    allowTokens: (mints) => {
      const symbols = mints.map(symbolOfMint);
      if (symbols.some((s) => s === null)) return refuse("only the eight pre-IPO companies can be allowed");
      return write("allow", { symbols });
    },
    disallowToken: (mint) => {
      const symbol = symbolOfMint(mint);
      return symbol ? write("disallow", { symbol }) : refuse("only the eight pre-IPO companies can be allowed");
    },
    deposit: (i) => (i.mint === USDC_MAINNET ? write("deposit", { amountE6: i.amount }) : refuse(NAME_MOVES)),
    withdraw: (i) => (i.mint === USDC_MAINNET ? write("withdraw", { amountE6: i.amount ?? null }) : refuse(NAME_MOVES)),
    setLimits: (i) => write("limits", { perActionCapE6: i.perActionCapE6, dailyCapE6: i.dailyCapE6, maxPremiumBps: i.maxPremiumBps }),
    setMode: (mode) => write("mode", { mode }),
    setOperator: (operator) => write("operator", { operator }),
    revokeOperator: () => write("revoke", {}),
    pause: () => write("pause", {}),
    unpause: () => write("unpause", {}),
  };
}
