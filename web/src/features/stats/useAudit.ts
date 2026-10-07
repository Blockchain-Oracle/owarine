"use client";

import { diagnosis, err, ok, type Reading } from "@owarine/core";
import { useReadingQuery } from "@owarine/markets/react";
import { auditPayloadSchema, type AuditPayload } from "./audit";

const POLL_MS = 30_000;
export const AUDIT_KEY = ["owarine", "stats", "audit"] as const;

async function readAudit(): Promise<Reading<AuditPayload>> {
  const response = await fetch("/api/stats/audit", { cache: "no-store" });
  if (!response.ok) return err(diagnosis("indexer-down", `audit route answered ${response.status}`));
  const parsed = auditPayloadSchema.safeParse(await response.json());
  if (!parsed.success) return err(diagnosis("indexer-down", "audit payload did not parse"));
  return ok(parsed.data, Date.now());
}

export function useAudit(): Reading<AuditPayload> | null {
  return useReadingQuery(AUDIT_KEY, readAudit, { pollMs: POLL_MS, needs: [] });
}
