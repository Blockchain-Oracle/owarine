/**
 * Plain argument shapes for the venue's Series registration and price policies. The reference took these from the
 * generated agari-events client; on Canton the same values become `Series` contract fields (C2x), so they are kept as
 * local, chain-free types and the pure planning code (`policies.ts`, `venue-spec.ts`) keeps working.
 */
import type { Address } from "@owarine/core/types";
import type { PrintPolicy } from "../ops/shapes";

/** One print source policy, as a Series policy version takes it. */
export type PrintPolicyInput = PrintPolicy;

/** A Series' registration parameters. */
export type SeriesRegisterArgs = {
  ticker: number;
  cadenceSec: number;
  basis: number;
  lotBase: bigint;
  tickBase: bigint;
  minLots: bigint;
  seatBond: bigint;
  minRestSlots: number;
  maxLeadSec: number;
  fillsCap: number;
  evictionsCap: number;
};

/** The venue's authorities (rollers, attestors, RedStone signers, programme seats) as the reference registered them. */
export type AuthoritiesArgs = {
  rollers: Address[];
  attestors: Address[];
  redstoneSigners: Uint8Array[];
  redstoneSignerCount: number;
  redstoneThreshold: number;
  switchboardQueue: Address;
  switchboardMinOracles: number;
  programAuthorities: Address[];
  resultRetentionSec: number;
};
