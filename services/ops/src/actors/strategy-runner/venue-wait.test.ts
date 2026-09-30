import { err, ok } from "@agari/core/schemas";
import { diagnosis } from "@agari/core/types";
import { describe, expect, it } from "vitest";
import { awaitVenue } from "./venue-wait";

describe("the runner waits for the venue instead of idling for good (C8g)", () => {
  it("asks again while the web's routes are unreachable, then returns the venue", async () => {
    const answers = [err(diagnosis("rpc-down", "ledger routes unreachable: fetch failed")), ok({ venueId: null }, 0), ok({ venueId: "venue-1" }, 0)];
    const lines: string[] = [];
    const slept: number[] = [];
    const venue = await awaitVenue(async () => answers.shift()! as never, (w) => lines.push(w), 30_000, async (ms) => { slept.push(ms); });
    expect(venue.venueId).toBe("venue-1");
    expect(slept).toEqual([30_000, 30_000]);
    expect(lines).toEqual(["no venue to scan yet: ledger routes unreachable: fetch failed; asking again every 30 s"]);
  });
});
