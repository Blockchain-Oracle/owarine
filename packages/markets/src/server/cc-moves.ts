/**
 * The seat's coin moves that are not deposits or withdrawal asks (revamp 2b), split from `cc.ts`:
 *
 *   tap       DevNet: the seat mints the faucet's test coin for itself (`AmuletRules_DevNet_Tap`, `ops/cc/devnet-tap.ts`)
 *   receive   the withdrawal's second step: the seat accepts the transfers the venue sent it. A seat has no
 *             `TransferPreapproval` and no wallet, so Amulet makes every venue → seat transfer an offer the receiver
 *             accepts; until it does, the receipt stays `sent` and the coin sits locked in the venue's holding. The seat
 *             accepts only a transfer the registry signed, from the venue, of the listed coin, that names one of its own
 *             `sent` withdrawal receipts in its metadata (`abu-pm.io/ref`), with the registry's accept context.
 *
 * Both are journaled seat writes like every other: `actAs` the leased party only, recovered by the client's journal id.
 */
import { CIP56_INTERFACE_IDS } from "@owarine/daml";
import type { Command, DisclosedContract, JsTransaction, LedgerClient } from "@owarine/ledger";
import type { Diagnosis } from "@owarine/core/types";
import type { CcRailView } from "@owarine/core/cc";
import { ccCmd, decodeTransferInstructionView, interfaceViewOf, RegistryError, type RegistryClient } from "../ops/cc";
import { REF_META_KEY } from "../ops/cc/commands";
import { tapCommand, type TapContext } from "../ops/cc/devnet-tap";
import type { CcWriteReply } from "../provider/cc-wire";
import type { SeatRef } from "./agents";
import { seatCommandId, type SeatIntent } from "./ids";
import { classifyRejection, refuse, SeatRefusal, type RejectionContext, type SeatStep } from "./rejection";
import { DEFAULT_COMMAND_DEADLINE_MS, inFlightBounds, type CommandJournal } from "./writes";

/**
 * The DevNet faucet: a seat taps `amount` of DevNet Canton Coin for itself. A seat already holding `capAtomic` of it
 * cannot tap again: seats are pooled (K-224), and coin piled on one would only wait for the next visitor.
 */
export interface CcFaucet {
  amount: string;
  capAtomic: bigint;
  /** Read fresh for every tap: the open mining round changes every ten minutes or so. */
  context: () => Promise<TapContext>;
}

export interface CcMovesDeps {
  client: LedgerClient;
  journal: CommandJournal;
  venueParty: string;
  registry: RegistryClient | null;
  faucet: CcFaucet | null;
  live: () => boolean;
  notLive: () => Diagnosis;
  status: (seat: SeatRef) => Promise<CcRailView>;
  now: () => number;
}

/** What one journaled write sends, decided after the journal's replay check and before anything is signed. */
type Plan = { commands: Command[]; disclosedContracts: DisclosedContract[] };

export function createCcMoves(d: CcMovesDeps) {
  const { client, journal, now } = d;

  async function write(seat: SeatRef, intent: SeatIntent & SeatStep, journalId: string, plan: () => Promise<Plan>): Promise<CcWriteReply> {
    if (!d.live()) return { kind: "refused", diagnosis: d.notLive() };
    const commandId = seatCommandId(intent, journalId);
    const ctx: RejectionContext = { step: intent };
    try {
      const prior = await journal.get(commandId);
      if (prior && (prior.party !== seat.party || prior.leaseId !== seat.leaseId)) throw refuse("contract-revert", "this command id belongs to another seat");
      if (prior && (prior.state === "landed" || prior.state === "unknown")) {
        const updateId = prior.updateId ?? (await client.findAcceptedCompletion(prior.commandId, [seat.party], prior.beginOffset))?.updateId ?? null;
        if (updateId) {
          if (prior.state !== "landed") await journal.finish(commandId, { state: "landed", updateId });
          return { kind: "requested", updateId, recovered: true };
        }
      }
      const { commands, disclosedContracts } = await plan();
      const beginOffset = await client.ledgerEnd();
      const row = await journal.begin({ commandId, leaseId: seat.leaseId, party: seat.party, kind: intent, beginOffset, deadlineMs: now() + DEFAULT_COMMAND_DEADLINE_MS }, now());
      let tx: JsTransaction;
      let recovered: boolean;
      try {
        const r = await client.submitAndWaitForTransaction({
          actAs: [seat.party], commandId, commands, ...(disclosedContracts.length > 0 ? { disclosedContracts } : {}), ...inFlightBounds(row),
        });
        tx = r.transaction;
        recovered = r.recovered;
      } catch (error) {
        const diag = classifyRejection(error, ctx);
        const state = diag.kind === "send-unknown" ? "unknown" : "failed";
        await journal.finish(commandId, { state, diagnosis: diag });
        return state === "unknown" ? { kind: "unknown", diagnosis: diag } : { kind: "refused", diagnosis: diag };
      }
      await journal.finish(commandId, { state: "landed", updateId: tx.updateId });
      return { kind: "requested", updateId: tx.updateId, recovered };
    } catch (error) {
      if (error instanceof SeatRefusal) return { kind: "refused", diagnosis: error.diagnosis };
      const diag: Diagnosis = classifyRejection(error, ctx);
      return diag.kind === "send-unknown" ? { kind: "unknown", diagnosis: diag } : { kind: "refused", diagnosis: diag };
    }
  }

  /** DevNet: tap the faucet's amount. Refused without a faucet, at the cap, or when the network's coin is not the listed coin. */
  const requestTap = (seat: SeatRef, o: { journalId: string }): Promise<CcWriteReply> =>
    write(seat, "cctap", o.journalId, async () => {
      if (!d.faucet) throw refuse("not-deployed", "this network has no test-coin faucet");
      const view = await d.status(seat);
      if (!view.listing) throw refuse("not-deployed", "the venue has not listed Canton Coin");
      if (view.faucetCoin === null) throw refuse("grant-refused", "your seat already holds test coin: deposit it, then tap again");
      let tap: TapContext;
      try {
        tap = await d.faucet.context();
      } catch {
        throw refuse("rpc-down", "the network's coin rules did not answer; nothing was sent");
      }
      if (tap.dsoParty !== view.listing.instrumentAdmin) throw refuse("not-deployed", "this network's coin is not the coin the venue lists");
      const { command, disclosedContracts } = tapCommand(tap, seat.party, d.faucet.amount);
      return { commands: [command], disclosedContracts };
    });

  /** Accept every transfer the venue sent this seat for one of its `sent` withdrawals, in one transaction. */
  const requestReceive = (seat: SeatRef, o: { journalId: string }): Promise<CcWriteReply> =>
    write(seat, "ccreceive", o.journalId, async () => {
      if (!d.registry) throw refuse("not-deployed", "no token registry is configured for this deployment");
      const view = await d.status(seat);
      const listing = view.listing;
      if (!listing) throw refuse("not-deployed", "the venue has not listed Canton Coin");
      const mine = new Set(view.withdrawals.filter((w) => w.state === "sent").map((w) => w.ref));
      const pending = (await client.activeContracts({ parties: [seat.party], interfaceIds: [CIP56_INTERFACE_IDS.TransferInstruction], maxPageSize: 200 })).contracts.flatMap((c) => {
        const raw = interfaceViewOf(c.createdEvent, CIP56_INTERFACE_IDS.TransferInstruction);
        if (!raw || !c.createdEvent.signatories.includes(listing.instrumentAdmin)) return [];
        try {
          const t = decodeTransferInstructionView(raw);
          const ok =
            t.status === "PendingReceiverAcceptance" && t.receiver === seat.party && t.sender === d.venueParty &&
            t.instrumentAdmin === listing.instrumentAdmin && t.instrumentId === listing.instrumentId && mine.has(t.meta[REF_META_KEY] ?? "");
          return ok ? [c.createdEvent.contractId] : [];
        } catch {
          return [];
        }
      });
      if (pending.length === 0) throw refuse("grant-refused", "no transfer from the venue is waiting for you");
      const commands: Command[] = [];
      const disclosed = new Map<string, DisclosedContract>();
      for (const cid of pending) {
        let context;
        try {
          context = await d.registry.instructionContext("accept", cid);
        } catch (error) {
          if (error instanceof RegistryError) throw refuse("rpc-down", "the token registry did not answer; nothing was received");
          throw error;
        }
        commands.push(ccCmd.acceptTransfer(cid, context));
        for (const dc of context.disclosedContracts) disclosed.set(dc.contractId ?? dc.createdEventBlob, dc);
      }
      return { commands, disclosedContracts: [...disclosed.values()] };
    });

  return { requestTap, requestReceive };
}
