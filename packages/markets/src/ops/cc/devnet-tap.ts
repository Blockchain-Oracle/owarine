/**
 * DevNet Canton Coin for a party we host (revamp 2b): Splice's `AmuletRules_DevNet_Tap`, which exists only on DevNet and
 * mints Amulet to its `receiver` (the choice's controller) in an open mining round. The two contracts it needs, the DSO's
 * `AmuletRules` and an `OpenMiningRound`, are read from a validator's scan proxy and disclosed on the submission, so the
 * party needs no wallet: the Noders wallet's "Onboard yourself" (which failed on 6 Oct) is not on this path.
 *
 * The scan proxy asks for the participant's own user token (`registry-env.ts`). Pure apart from the injected fetch.
 */
import type { Command, ContractId, DisclosedContract, Party } from "@owarine/ledger/pure";

export interface ScanContract {
  contractId: ContractId;
  templateId: string;
  disclosed: DisclosedContract;
  payload: Record<string, unknown>;
}

export interface TapContext {
  dsoParty: Party;
  amuletRules: ScanContract;
  openRound: ScanContract;
}

type RawRecord = { contract?: { contract_id?: string; template_id?: string; created_event_blob?: string; payload?: Record<string, unknown> }; domain_id?: string };

export function scanContract(raw: RawRecord | undefined, what: string): ScanContract {
  const c = raw?.contract;
  if (!c?.contract_id || !c.template_id || !c.created_event_blob || !raw?.domain_id) throw new Error(`the scan proxy's ${what} is incomplete`);
  return {
    contractId: c.contract_id as ContractId,
    templateId: c.template_id,
    payload: c.payload ?? {},
    disclosed: { templateId: c.template_id, contractId: c.contract_id as ContractId, createdEventBlob: c.created_event_blob, synchronizerId: raw.domain_id },
  };
}

/** The open round to tap in: already open (`opensAt` ≤ now) and furthest from closing, so it stays open while the command runs. */
export function pickOpenRound(rounds: readonly RawRecord[], nowMs: number): RawRecord | null {
  const open = rounds.filter((r) => {
    const p = r.contract?.payload as { opensAt?: string; targetClosesAt?: string } | undefined;
    return p?.opensAt && Date.parse(p.opensAt) <= nowMs && (!p.targetClosesAt || Date.parse(p.targetClosesAt) > nowMs);
  });
  open.sort((a, b) => Date.parse(String((b.contract?.payload as { targetClosesAt?: string }).targetClosesAt ?? 0)) - Date.parse(String((a.contract?.payload as { targetClosesAt?: string }).targetClosesAt ?? 0)));
  return open[0] ?? null;
}

/** Reads what a tap needs from `<validator>/api/validator/v0/scan-proxy`. */
export async function readTapContext(input: { scanProxyUrl: string; token: () => Promise<string | undefined>; fetch?: typeof fetch; nowMs?: number }): Promise<TapContext> {
  const doFetch = input.fetch ?? fetch;
  const base = input.scanProxyUrl.replace(/\/+$/, "");
  const get = async (path: string): Promise<unknown> => {
    const token = await input.token();
    const r = await doFetch(`${base}${path}`, { headers: { accept: "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, signal: AbortSignal.timeout(15_000) });
    if (!r.ok) throw new Error(`the scan proxy answered ${r.status} for ${path}`);
    return (await r.json()) as unknown;
  };
  const [dso, rules, rounds] = await Promise.all([get("/dso-party-id"), get("/amulet-rules"), get("/open-and-issuing-mining-rounds")]);
  const dsoParty = (dso as { dso_party_id?: string }).dso_party_id;
  if (!dsoParty) throw new Error("the scan proxy named no DSO party");
  const round = pickOpenRound((rounds as { open_mining_rounds?: RawRecord[] }).open_mining_rounds ?? [], input.nowMs ?? Date.now());
  if (!round) throw new Error("no mining round is open");
  return { dsoParty: dsoParty as Party, amuletRules: scanContract((rules as { amulet_rules?: RawRecord }).amulet_rules, "AmuletRules"), openRound: scanContract(round, "OpenMiningRound") };
}

/** `AmuletRules_DevNet_Tap`: `receiver` mints `amount` (a Daml Decimal text) for itself in the open round. */
export function tapCommand(ctx: TapContext, receiver: Party, amount: string): { command: Command; disclosedContracts: DisclosedContract[] } {
  if (!/^\d+(\.\d{1,10})?$/.test(amount) || !/[1-9]/.test(amount)) throw new Error(`a tap amount is a positive decimal with at most 10 places, got ${JSON.stringify(amount)}`);
  return {
    command: {
      ExerciseCommand: {
        templateId: ctx.amuletRules.templateId,
        contractId: ctx.amuletRules.contractId,
        choice: "AmuletRules_DevNet_Tap",
        choiceArgument: { receiver, amount, openRound: ctx.openRound.contractId },
      },
    },
    disclosedContracts: [ctx.amuletRules.disclosed, ctx.openRound.disclosed],
  };
}
