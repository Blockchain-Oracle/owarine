import { encodeBase58 } from "@agari/core/types";
import { describe, expect, it } from "vitest";
import { signerFromSecretKey } from "./ed25519";
import { seatSession } from "./mobile/seat";

const hex = (text: string) => Uint8Array.from(text.match(/../g) ?? [], (h) => Number.parseInt(h, 16));
/** RFC 8032 §7.1, TEST 1 and TEST 2: seed, public key, message, signature. */
const RFC1 = {
  seed: hex("9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60"),
  pub: hex("d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a"),
  sig: hex("e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b"),
};
const RFC2_PUB = hex("3d4017c3e843895a92b70aa74d1b7ebc9c982ccf2ec4968cc0cd55f12af4660c");
const keypair = (seed: Uint8Array, pub: Uint8Array) => Uint8Array.from([...seed, ...pub]);

describe("the seat key's ed25519 (WebCrypto, no Solana SDK)", () => {
  it("signs exactly the RFC 8032 vector and names the base58 public key as its address", async () => {
    const signer = await signerFromSecretKey(keypair(RFC1.seed, RFC1.pub));
    expect(signer.address).toBe(encodeBase58(RFC1.pub));
    expect(await signer.signMessage(new Uint8Array())).toEqual(RFC1.sig);
  });

  it("refuses a keypair whose public half is not its seed's", async () => {
    await expect(signerFromSecretKey(keypair(RFC1.seed, RFC2_PUB))).rejects.toThrow("does not match");
    await expect(signerFromSecretKey(RFC1.seed)).rejects.toThrow("64-byte");
  });

  it("gives the phone the same address and signature through seatSession", async () => {
    const seat = await seatSession(keypair(RFC1.seed, RFC1.pub));
    expect(seat.address).toBe(encodeBase58(RFC1.pub));
    expect(await seat.signMessage(new Uint8Array())).toEqual(RFC1.sig);
  });
});
