/**
 * Canton-shaped fixture ids for the C1g `/dev` pages: party ids (`<hint>::1220<fingerprint>`), contract ids and update
 * ids. Every value is made up for the fixture; none names a real party, contract or update on any ledger.
 */
const hex = (seed: string, length = 64) => seed.repeat(Math.ceil(length / seed.length)).slice(0, length);

export const party = (hint: string, seed: string) => `${hint}::1220${hex(seed)}`;
export const contractId = (seed: string) => `00${hex(seed, 66)}ca1112${hex(seed.split("").reverse().join(""), 64)}`;
export const updateId = (seed: string) => `1220${hex(seed)}`;

export const ALICE = party("alice", "9f3b2c4d5e6f7081");
export const BOB = party("bob", "4a71c08e2d93b5f6");
export const OUTSIDER = party("outsider", "e0d1c2b3a4958677");
export const VENUE = party("venue", "7e57a11ce5b0b0de");
export const ORACLES = [party("oracle-1", "0a1b2c3d4e5f6071"), party("oracle-2", "1b2c3d4e5f607182"), party("oracle-3", "2c3d4e5f60718293")] as const;
export const RESOLVER = party("resolver", "3d4e5f6071829304");

/** The offset every fixture query is pinned to, so the three answers are of one moment. */
export const FIXTURE_OFFSET = 48_213;
