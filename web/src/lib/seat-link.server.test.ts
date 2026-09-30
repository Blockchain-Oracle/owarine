import { messageBytes } from "@agari/core/auth";
import { encodeBase58 } from "@agari/core/types";
import { formatSeatLinkCode, normalizeSeatLinkCode, SEAT_LINK_ALPHABET, seatLinkText } from "@agari/markets";
import { describe, expect, it } from "vitest";
import { seatSigner, takeSeat } from "@/providers/wallet/seat-client";
import { webEnv } from "./env";
import { checkJoinRequest, newSeatLinkCode } from "./seat-link.server";

const NOW = 1_790_000_000_000;

async function signedJoin(code: string, issuedAtMs = NOW) {
  const signer = seatSigner(await takeSeat());
  const signature = encodeBase58(await signer.signMessage(messageBytes(seatLinkText(signer.address, code, issuedAtMs, webEnv.markets.cluster))));
  return { code, address: signer.address, issuedAtMs, signature };
}

describe("seat link (iOS step 2b)", () => {
  it("draws eight-character codes from the unambiguous alphabet (C4c, review L1), and reads typed codes forgivingly", () => {
    const codes = new Set(Array.from({ length: 200 }, newSeatLinkCode));
    expect(codes.size).toBe(200);
    for (const code of codes) expect([...code].every((c) => SEAT_LINK_ALPHABET.includes(c)) && code.length === 8).toBe(true);
    expect(normalizeSeatLinkCode("k7m2 qf4h")).toBe("K7M2QF4H");
    expect(normalizeSeatLinkCode("K7M2-QF4H")).toBe("K7M2QF4H");
    expect(formatSeatLinkCode("K7M2QF4H")).toBe("K7M2 QF4H");
    expect(normalizeSeatLinkCode("K7M2QF40")).toBeNull();
    expect(normalizeSeatLinkCode("K7M2QF")).toBeNull();
  });

  it("accepts a join signed by the joining key for exactly that code, fresh", async () => {
    const body = await signedJoin("K7M2QF4H");
    await expect(checkJoinRequest(body, NOW + 1_000)).resolves.toEqual({ ok: true, address: body.address, code: "K7M2QF4H" });
    await expect(checkJoinRequest({ ...body, code: "k7m2 qf4h" }, NOW + 1_000)).resolves.toMatchObject({ ok: true, code: "K7M2QF4H" });
  });

  it("refuses another code, another key, a stale request and a malformed body", async () => {
    const body = await signedJoin("K7M2QF4H");
    const other = await signedJoin("K7M2QF4H");
    await expect(checkJoinRequest({ ...body, code: "K7M2QF4J" }, NOW)).resolves.toMatchObject({ ok: false });
    await expect(checkJoinRequest({ ...body, address: other.address }, NOW)).resolves.toMatchObject({ ok: false });
    await expect(checkJoinRequest(body, NOW + 6 * 60_000)).resolves.toMatchObject({ ok: false, reason: expect.stringContaining("stale") });
    await expect(checkJoinRequest({ ...body, extra: 1 }, NOW)).resolves.toMatchObject({ ok: false });
    await expect(checkJoinRequest(null, NOW)).resolves.toMatchObject({ ok: false });
  });
});
