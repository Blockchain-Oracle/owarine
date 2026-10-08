import { describe, expect, it } from "vitest";
import { strategyNumOf } from "./ops/agents/ids";
import { arenaAddressOf, partyAddress } from "./ops/games/view";

/**
 * Ids derived from hash seeds that DevNet's ledger history and the projection already carry. The 7 Oct rename
 * (c2db0028) wrote NUL bytes into five of these seeds and nothing failed: these pins make any seed change a test failure.
 */
describe("hash-seeded ids stay what DevNet already has", () => {
  it("pins the arena, party and strategy ids", () => {
    expect(arenaAddressOf("arena-1")).toMatchInlineSnapshot(`"9bkJMcK1aNFSiZf7R91RHkNHSgP3ySShzgPkH9qDdd2T"`);
    expect(partyAddress("a224bb7f-pm-venue::1220ab")).toMatchInlineSnapshot(`"5ZErhU2x2ugwDSufwqwUY8E6CqJo3PuPJc8os8J5q5KD"`);
    expect(strategyNumOf("momentum-1").toString()).toMatchInlineSnapshot(`"3429647212038018"`);
  });
});
