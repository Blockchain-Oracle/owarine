import { ALICE, BOB } from "../canton-ids";

/** `/dev/seat`: one leased guest seat and one closing, a full pool, and a seat link. Ids and codes are fixture values. */
export const SEAT_ADDRESS = "7hXq3sKd9Vw2mPfL4cRt8nYb6ZjE1aUo5GkT2iWxQeNa";
export const DRAINING_ADDRESS = "3FpZk8uQw1Ls6VbN9xRt2mHc7YdJ4eAo5GiK8TnWqPsE";
export const LEASED = { seatNumber: 3, address: SEAT_ADDRESS, party: ALICE, cashText: "1,000.00 tUSDC" } as const;
export const DRAINING = { seatNumber: 5, address: DRAINING_ADDRESS, party: BOB, cashText: "212.40 tUSDC" } as const;

/** The idle lease (plan §Seats: 15 min idle TTL); the fixture starts 14:32 in. */
export const LEASE_SPAN_SEC = 15 * 60;
export const LEASE_LEFT_SEC = 14 * 60 + 32;
/** Next seat frees in 3:41 out of a 15-minute idle window; the draining seat's last call settles in 4:10 of a 5m Window. */
export const POOL_SPAN_SEC = 15 * 60;
export const POOL_LEFT_SEC = 3 * 60 + 41;
export const DRAIN_SPAN_SEC = 5 * 60;
export const DRAIN_LEFT_SEC = 4 * 60 + 10;

export const LINK_CODE = "K7M2QF";
export const LINK_LEFT_SEC = 48;
export const linkUrl = (origin: string, code: string) => `${origin}/seat/link?code=${code}`;
