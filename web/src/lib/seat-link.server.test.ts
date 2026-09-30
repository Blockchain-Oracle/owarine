import { messageBytes } from "@agari/core/auth";
import { encodeBase58 } from "@agari/core/types";
import { normalizeSeatLinkCode, SEAT_LINK_ALPHABET, seatLinkText } from "@agari/markets";
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
  it("draws six-character codes from the unambiguous alphabet, and reads typed codes forgivingly", () => {
    const codes = new Set(Array.from({ length: 200 }, newSeatLinkCode));
    expect(codes.size).toBeGreaterThan(195);
    for (const code of codes) expect([...code].every((c) => SEAT_LINK_ALPHABET.includes(c)) && code.length === 6).toBe(true);
    expect(normalizeSeatLinkCode("k7m 2qf")).toBe("K7M2QF");
    expect(normalizeSeatLinkCode("K7M-2QF")).toBe("K7M2QF");
    expect(normalizeSeatLinkCode("K7M2Q0")).toBeNull();
    expect(normalizeSeatLinkCode("K7M2Q")).toBeNull();
  });

  it("accepts a join signed by the joining key for exactly that code, fresh", async () => {
    const body = await signedJoin("K7M2QF");
    await expect(checkJoinRequest(body, NOW + 1_000)).resolves.toEqual({ ok: true, address: body.address, code: "K7M2QF" });
    await expect(checkJoinRequest({ ...body, code: "k7m 2qf" }, NOW + 1_000)).resolves.toMatchObject({ ok: true, code: "K7M2QF" });
  });

  it("refuses another code, another key, a stale request and a malformed body", async () => {
    const body = await signedJoin("K7M2QF");
    const other = await signedJoin("K7M2QF");
    await expect(checkJoinRequest({ ...body, code: "K7M2QG" }, NOW)).resolves.toMatchObject({ ok: false });
    await expect(checkJoinRequest({ ...body, address: other.address }, NOW)).resolves.toMatchObject({ ok: false });
    await expect(checkJoinRequest(body, NOW + 6 * 60_000)).resolves.toMatchObject({ ok: false, reason: expect.stringContaining("stale") });
    await expect(checkJoinRequest({ ...body, extra: 1 }, NOW)).resolves.toMatchObject({ ok: false });
    await expect(checkJoinRequest(null, NOW)).resolves.toMatchObject({ ok: false });
  });
});
