import { z } from "zod";

/**
 * `/api/stats/audit` (C5): the venue view's market totals behind the k = 5 floor, the reserve reporter's snapshot, and
 * the auditor's newest independent recount. Venue-level figures only; integers cross as decimal strings.
 */
const dec = z.string().regex(/^-?\d+$/);

export const reserveSchema = z.object({
  asOfMs: z.number(),
  freeBase: dec,
  lockedBase: dec,
  venueLegBase: dec,
  userLegBase: dec,
  maxOwedBase: dec,
  headroomBase: dec,
  openLegs: z.number(),
  liveQuotes: z.number(),
});

const recountReserveSchema = z.object({
  atOffset: reserveSchema.omit({ asOfMs: true }),
  matchesProjection: z.boolean(),
  reporter: reserveSchema.nullable(),
  reporterWhy: z.string().nullable(),
});

export const recountSchema = z.object({
  atMs: z.number(),
  offset: z.number().nullable(),
  ok: z.boolean(),
  projection: z.object({ ok: z.boolean(), ledger: z.record(z.string(), z.number()), projection: z.record(z.string(), z.number()), mismatches: z.array(z.string()) }),
  reserve: recountReserveSchema.nullable(),
});

export const venueTotalsSchema = z.object({
  windows: z.number(),
  resolved: z.number(),
  voided: z.number(),
  publicWindows: z.number(),
  withheldWindows: z.number(),
  trades: dec,
  volumeBase: dec,
  feesBase: dec,
  payoutsBase: dec,
  floor: z.number(),
});

export const auditPayloadSchema = z.object({
  checkedAtMs: z.number(),
  venue: venueTotalsSchema.nullable(),
  reserve: z.union([z.object({ ok: z.literal(true), value: reserveSchema }), z.object({ ok: z.literal(false), why: z.string() })]),
  recount: recountSchema.nullable(),
});

export type AuditPayload = z.infer<typeof auditPayloadSchema>;
export type ReserveSnapshot = z.infer<typeof reserveSchema>;
export type Recount = z.infer<typeof recountSchema>;
