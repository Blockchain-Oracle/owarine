import { OUTCOME_COLUMN, type OutcomeColumn } from "@agari/core/desk";
import { outcomeColumnSchema } from "./protocol";

/**
 * A stored record's outcome as the feed's wire column (C8d, C-S21d). `desk_records.outcome` holds the planned outcome
 * (`WOULD_HAVE_ACTED`), the wire and the watcher speak its column (`would_have_acted`); the feed parsed the stored
 * value against the columns, so every item went out with a null outcome and the watcher never rang for a decision.
 */
export function feedOutcome(stored: string | null | undefined): OutcomeColumn | null {
  if (!stored) return null;
  const column = (OUTCOME_COLUMN as Record<string, string>)[stored] ?? stored;
  const parsed = outcomeColumnSchema.safeParse(column);
  return parsed.success ? parsed.data : null;
}
