/**
 * C4c: a decided duel's picks come back from the projection with their seats (skipped unless SEAT_PG_URL is set; the
 * test works in its own schema):
 *
 *   SEAT_PG_URL=postgres://… pnpm exec vitest run packages/db/src/games-picks.test.ts
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "./client";
import { readDuelPicks, recordPick, recordSettlement } from "./games";

const URL_ = process.env.SEAT_PG_URL;
const SCHEMA = "c4c_duel_picks";
const MATCH = "0x89FED006b1261efc676f5caafb0bdbe52955ce54938f21bae50e55d7ea747785";
const key = (card: number, seat: number) => `203:${MATCH.toLowerCase()}:${card}:${seat}`;

describe.skipIf(!URL_)("readDuelPicks (Postgres)", () => {
  if (URL_) process.env.DATABASE_URL = `${URL_}${URL_.includes("?") ? "&" : "?"}search_path=${SCHEMA}`;
  const db = getDb()!;

  beforeAll(async () => {
    await db.unsafe(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE; CREATE SCHEMA ${SCHEMA}`);
  });
  afterAll(async () => {
    await db.unsafe(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    await db.end();
  });

  it("reads every pick of the match with the seat from its key, settled or not, by any spelling of the id", async () => {
    const base = { matchId: MATCH, marketId: "0x01", quantity: "1000000", filledAtSec: 1 };
    await recordPick({ ...base, pickKey: key(0, 0), cardIndex: 0, player: "CreatorAddr", side: "up", costBase: "600000" });
    await recordPick({ ...base, pickKey: key(0, 1), cardIndex: 0, player: "ChallengerAddr", side: "down", costBase: "400000" });
    await recordPick({ ...base, pickKey: key(1, 1), cardIndex: 1, player: "ChallengerAddr", side: "down", costBase: "437917" });
    await recordSettlement(key(0, 1), "1500000");
    const picks = await readDuelPicks(MATCH.slice(2).toLowerCase());
    expect(picks).toEqual([
      { cardIndex: 0, seat: 0, side: "up", quantity: "1000000", costBase: "600000", payoutBase: null },
      { cardIndex: 0, seat: 1, side: "down", quantity: "1000000", costBase: "400000", payoutBase: "1500000" },
      { cardIndex: 1, seat: 1, side: "down", quantity: "1000000", costBase: "437917", payoutBase: null },
    ]);
    expect(await readDuelPicks(`0x${"00".repeat(32)}`)).toEqual([]);
  });
});
