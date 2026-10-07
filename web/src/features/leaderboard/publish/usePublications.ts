"use client";

import { ledgerRequest } from "@owarine/markets";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

/**
 * The seat's own publications (GET/POST/DELETE `/api/ledger/publications`), keyed by the seat address so a new lease
 * never shows the last visitor's. A publish or retract refreshes it and the board.
 */
const publicationWire = z.object({
  cid: z.string(), marketId: z.string(), pairId: z.string(), side: z.enum(["up", "down"]), lots: z.string(), handle: z.string(),
  /** 0.4.0: null for a pair leg; the ticket product otherwise (absent from an older server). */
  product: z.string().nullable().optional(),
});
const listWire = z.object({ value: z.array(publicationWire), address: z.string(), receipts: z.boolean() });
const publishWire = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("published"), publications: z.array(publicationWire), updateId: z.string().nullable() }),
  z.object({ kind: z.literal("already"), publications: z.array(publicationWire) }),
  z.object({ kind: z.literal("refused"), code: z.enum(["nothing-live", "receipt-unavailable"]), reason: z.string() }),
]);

export type PublicationRow = z.infer<typeof publicationWire>;
export type PublishSource = "leg" | "receipt";

export const publicationsKey = (address: string | null) => ["owarine", "seat", "publications", address] as const;

export function usePublications(address: string | null) {
  return useQuery({
    queryKey: publicationsKey(address),
    enabled: address !== null,
    staleTime: 15_000,
    queryFn: async () => {
      const r = await ledgerRequest("/publications", { method: "GET", wire: listWire });
      if (!r.ok) throw new Error(r.diagnosis.technical || r.diagnosis.kind);
      return r.value;
    },
  });
}

export function usePublishCall(address: string | null) {
  const client = useQueryClient();
  const settle = () => {
    void client.invalidateQueries({ queryKey: publicationsKey(address) });
    void client.invalidateQueries({ queryKey: ["owarine", "leaderboard"] });
  };
  const publish = useMutation({
    mutationFn: async (o: { marketId: string; source: PublishSource; receiptId?: string }) => {
      const r = await ledgerRequest("/publications", { method: "POST", body: o, wire: publishWire, okStatuses: [409] });
      if (!r.ok) throw new Error(r.diagnosis.technical || r.diagnosis.kind);
      return r.value;
    },
    onSettled: settle,
  });
  const retract = useMutation({
    /** C6e: `product` names the ticket whose publication goes; omitted or null retracts the pair legs only. */
    mutationFn: async (o: { marketId: string; product?: string | null }) => {
      const r = await ledgerRequest("/publications", { method: "DELETE", body: o, wire: z.object({ retracted: z.number() }) });
      if (!r.ok) throw new Error(r.diagnosis.technical || r.diagnosis.kind);
      return r.value;
    },
    onSettled: settle,
  });
  return { publish, retract };
}
