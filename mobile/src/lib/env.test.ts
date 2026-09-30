import { describe, expect, it } from "vitest";
import { opsOrigin } from "./env";

describe("the phone's ops origin (iOS step 8: live prices on by default)", () => {
  it("follows the deploy's ops.<domain> convention, a local web's ops port, or the explicit URL", () => {
    expect(opsOrigin("https://example.xyz")).toBe("https://ops.example.xyz");
    expect(opsOrigin("https://www.example.xyz")).toBe("https://ops.example.xyz");
    expect(opsOrigin("http://192.168.1.20:3000")).toBe("http://192.168.1.20:8787");
    expect(opsOrigin("https://example.xyz", "https://feed.example.xyz/")).toBe("https://feed.example.xyz");
  });
});
