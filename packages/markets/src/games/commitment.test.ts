import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { duelDeckPreimage, toLedgerCommitment } from "@owarine/core/games";
import { describe, expect, it } from "vitest";
import { deckCommitment, duelDeckHash, keccak256, sha256Text } from "./commitment";

/**
 * The deck hash is a differential: the ops deckmaster commits with this encoder and the ledger's `Duel_Reveal`
 * recomputes `PM.Games.Deck.deckCommitment` with `DA.Text.sha256`. The golden vector is read out of the Daml script
 * itself (`Test.Games.Duel.testDeckGoldenVector`), so a change to either side that the other does not mirror fails here.
 */
const DAML_TEST = fileURLToPath(new URL("../../../../daml/pm-tests/daml/Test/Games/Duel.daml", import.meta.url));

function damlGolden(): { preimage: string; hash: string } {
  const src = readFileSync(DAML_TEST, "utf8");
  const preimage = /deckPreimage "A1" "m-golden" 1 "server-seed-1" theSeeds cards\s*\n\s*=== "([^"]+)"/.exec(src)?.[1];
  const hash = /h === "([0-9a-f]{64})"/.exec(src)?.[1];
  if (!preimage || !hash) throw new Error("the golden vector moved out of Test.Games.Duel.testDeckGoldenVector");
  return { preimage, hash };
}

const golden = {
  arenaId: "A1",
  matchId: "m-golden",
  policyVersion: 1,
  serverSeed: "server-seed-1",
  clientSeeds: ["seed-alice", "seed-bob"],
  cards: ["BTC-300:0", "BTC-300:1"],
};

describe("the duel deck commitment (sha256, checked on the ledger)", () => {
  it("encodes the preimage PM.Games.Deck encodes, byte for byte", () => {
    expect(duelDeckPreimage(golden)).toBe(damlGolden().preimage);
  });

  it("hashes to the Daml script's golden vector", () => {
    expect(duelDeckHash(golden)).toBe(damlGolden().hash);
    expect(deckCommitment(golden)).toBe(`0x${damlGolden().hash}`);
    expect(toLedgerCommitment(deckCommitment(golden))).toBe(damlGolden().hash);
  });

  it("is sha256 over UTF-8, counting code points like DA.Text.length", () => {
    expect(sha256Text("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(duelDeckPreimage({ ...golden, serverSeed: "é🙂" })).toContain(",2:é🙂,");
  });

  it("changes with every field, and an element moved from the seeds to the cards is a different deck", () => {
    const h = duelDeckHash(golden);
    const others = [
      { ...golden, cards: [...golden.cards].reverse() },
      { ...golden, serverSeed: "server-seed-2" },
      { ...golden, policyVersion: 2 },
      { ...golden, arenaId: "A2" },
      { ...golden, matchId: "m-other" },
      { ...golden, clientSeeds: [...golden.clientSeeds, "BTC-300:0"], cards: ["BTC-300:1"] },
    ];
    for (const o of others) expect(duelDeckHash(o)).not.toBe(h);
  });
});

describe("keccak-256 (the off-ledger commitments)", () => {
  it("is keccak-256 and not SHA3-256", () => {
    expect(keccak256("0x")).toBe("0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470");
    expect(keccak256(`0x${"00".repeat(32)}`)).toBe("0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563");
  });
});
