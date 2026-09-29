import { describe, expect, it } from "vitest";
import { messageSignatureSchema } from "../auth/signed-message";
import { testSignature } from "../testing/ids";
import { isEd25519Signature, isSignature, isUpdateId, signatureSchema, updateIdSchema } from "./primitives";

const UPDATE_ID = `1220${"0a".repeat(32)}`;

describe("transaction ids", () => {
  it("accepts a Canton update id exactly as the JSON Ledger API returns it", () => {
    expect(isUpdateId(UPDATE_ID)).toBe(true);
    expect(isSignature(UPDATE_ID)).toBe(true);
    expect(signatureSchema.safeParse(UPDATE_ID).success).toBe(true);
    expect(updateIdSchema.safeParse(UPDATE_ID).success).toBe(true);
  });

  it("refuses anything padded, re-cased or truncated into the update-id shape", () => {
    expect(isUpdateId(UPDATE_ID.toUpperCase())).toBe(false);
    expect(isUpdateId(`0x${UPDATE_ID}`)).toBe(false);
    expect(isUpdateId(UPDATE_ID.slice(0, -2))).toBe(false);
    expect(isUpdateId(`${UPDATE_ID}00`)).toBe(false);
    expect(isUpdateId(`1221${"0a".repeat(32)}`)).toBe(false);
  });

  it("keeps base58 of 64 bytes as a signature, and never lets an update id pass as an ed25519 signature", () => {
    const sig = testSignature(7);
    expect(isEd25519Signature(sig)).toBe(true);
    expect(isSignature(sig)).toBe(true);
    expect(isUpdateId(sig)).toBe(false);
    expect(isEd25519Signature(UPDATE_ID)).toBe(false);
    expect(messageSignatureSchema.safeParse(UPDATE_ID).success).toBe(false);
  });
});
