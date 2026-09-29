/**
 * abu-pm-main 0.4.0 `PM.Event` payloads (committee events, K-030) → the shapes the resolver, pricer and drives read.
 * Server-only, like `decode.ts`.
 */
import type { ContractId, Party } from "@agari/ledger";
import { DecodeError, decodeParts, type VoidReasonC } from "./decode";

const { obj, optional, parties, sec, small, text, voidReason } = decodeParts;

export interface EventTermsC {
  venue: Party;
  resolver: Party;
  termsCid: ContractId;
  marketId: string;
  question: string;
  closeTimeSec: number;
  closeDeadlineSec: number;
  attestors: Party[];
  quorum: number;
}

export interface EventStateC {
  venue: Party;
  resolver: Party;
  termsCid: ContractId;
}

export interface EventAttestationC {
  attestor: Party;
  venue: Party;
  resolver: Party;
  marketId: string;
  answer: boolean;
  attestedAtSec: number;
  statementHash: string;
}

export interface AttestationEvidenceC {
  attestor: Party;
  answer: boolean;
  attestedAtSec: number;
  statementHash: string;
  attestationCid: ContractId;
}

export interface EventVerdictC {
  venue: Party;
  resolver: Party;
  termsCid: ContractId;
  marketId: string;
  question: string;
  /** null = void (then `voidReason` names why). */
  answer: boolean | null;
  voidReason: VoidReasonC | null;
  attestations: AttestationEvidenceC[];
  resolutionCid: ContractId;
}

const bool = (r: Record<string, unknown>, k: string): boolean => {
  const v = r[k];
  if (typeof v !== "boolean") throw new DecodeError(`field ${k} is not a Bool`);
  return v;
};

export function decodeEventTerms(v: unknown): EventTermsC {
  const r = obj(v, "EventTerms");
  return {
    venue: text(r, "venue"), resolver: text(r, "resolver"), termsCid: text(r, "termsCid"), marketId: text(r, "marketId"), question: text(r, "question"),
    closeTimeSec: sec(r, "closeTime"), closeDeadlineSec: sec(r, "closeDeadline"), attestors: parties(r.attestors, "attestors"), quorum: small(r, "quorum"),
  };
}

export function decodeEventState(v: unknown): EventStateC {
  const r = obj(v, "EventState");
  return { venue: text(r, "venue"), resolver: text(r, "resolver"), termsCid: text(r, "termsCid") };
}

export function decodeEventAttestation(v: unknown): EventAttestationC {
  const r = obj(v, "EventAttestation");
  return {
    attestor: text(r, "attestor"), venue: text(r, "venue"), resolver: text(r, "resolver"), marketId: text(r, "marketId"), answer: bool(r, "answer"),
    attestedAtSec: sec(r, "attestedAt"), statementHash: text(r, "statementHash"),
  };
}

export function decodeEventVerdict(v: unknown): EventVerdictC {
  const r = obj(v, "EventVerdict");
  const list = r.attestations;
  if (!Array.isArray(list)) throw new DecodeError("attestations is not a list");
  return {
    venue: text(r, "venue"), resolver: text(r, "resolver"), termsCid: text(r, "termsCid"), marketId: text(r, "marketId"), question: text(r, "question"),
    answer: optional(r.answer, (x) => bool({ answer: x }, "answer")),
    voidReason: optional(r.voidReason, voidReason),
    attestations: list.map((a) => {
      const e = obj(a, "AttestationEvidence");
      return { attestor: text(e, "attestor"), answer: bool(e, "answer"), attestedAtSec: sec(e, "attestedAt"), statementHash: text(e, "statementHash"), attestationCid: text(e, "attestationCid") };
    }),
    resolutionCid: text(r, "resolutionCid"),
  };
}

