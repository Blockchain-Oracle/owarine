/**
 * Opt-in publications, one question (plan §5): has this seat published a call on this Window? The takes board's
 * "✓ position" badge asks it, so a badge never reveals a position its owner kept private. `who` is the seat address the
 * publication's handle carries (or a party id, for ops and tests).
 */
import type postgres from "postgres";

type Sql = postgres.Sql;

export async function publishedOn(sql: Sql, market: string, who: string): Promise<boolean> {
  const rows = await sql<{ one: number }[]>`
    SELECT 1 AS one FROM idx_publications
    WHERE market = ${market} AND (handle = ${who} OR owner_address = ${who} OR owner_party = ${who}) LIMIT 1`;
  return rows.length > 0;
}
