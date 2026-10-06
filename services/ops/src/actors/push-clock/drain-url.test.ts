import { describe, expect, it } from "vitest";
import { drainUrl } from "./index";

/** C5d: the drain carries a bearer secret, so it goes only to a host this deployment names. */
describe("drainUrl", () => {
  it("is the explicit URL, else the site's drain", () => {
    expect(drainUrl({ PUSH_DRAIN_URL: "http://127.0.0.1:3160/api/push/drain" })).toBe("http://127.0.0.1:3160/api/push/drain");
    expect(drainUrl({ NEXT_PUBLIC_SITE_URL: "https://pm.example/" })).toBe("https://pm.example/api/push/drain");
  });

  it("is null when nothing names a host: no fallback domain", () => {
    expect(drainUrl({})).toBeNull();
    expect(drainUrl({ NEXT_PUBLIC_SITE_URL: "  " })).toBeNull();
  });
});
