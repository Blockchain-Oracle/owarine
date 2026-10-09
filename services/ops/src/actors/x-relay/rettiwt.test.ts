import { beforeEach, describe, expect, it, vi } from "vitest";

type Config = { maxRetries: number; timeout: number; responseMiddleware?: (response: unknown) => void };
const mocks = vi.hoisted(() => ({ configs: [] as Config[], post: vi.fn(), upload: vi.fn(), search: vi.fn(), details: vi.fn() }));
vi.mock("rettiwt-api", () => ({
  Rettiwt: class {
    tweet = { post: mocks.post, upload: mocks.upload, search: mocks.search };
    user = { details: mocks.details };
    constructor(options: Config) { mocks.configs.push(options); }
  },
}));
import { rettiwtTransport } from "./rettiwt";
import { XRateLimitedError, XRefusedError } from "./transport";

describe("X media transport", () => {
  beforeEach(() => { mocks.configs.length = 0; vi.clearAllMocks(); });

  const tweet = (id: string) => ({ id, tweetBy: { id: "55", userName: "caller" }, fullText: "TSLA UP 5 5m" });
  it("verifies the session's stable identity and retains reply-parent metadata", async () => {
    mocks.details.mockResolvedValue({ id: "99", userName: "BOT" });
    const transport = rettiwtTransport("fixture", "@bot");
    expect(await transport.authenticatedAuthorId()).toBe("99");
    expect(mocks.details).toHaveBeenCalledWith();
    mocks.search.mockResolvedValue({ list: [{ ...tweet("30"), replyTo: "20" }, tweet("31")] });
    expect(await transport.fetchMentions("0")).toMatchObject([{ id: "30", replyTo: "20" }, { id: "31", replyTo: null }]);
  });
  it.each([undefined, { id: "99", userName: "wrong" }, { id: "invalid", userName: "bot" }])("fails closed for an unverified account identity", async profile => {
    mocks.details.mockResolvedValue(profile);
    await expect(rettiwtTransport("fixture", "bot").authenticatedAuthorId()).rejects.toThrow("identity");
    expect(mocks.post).not.toHaveBeenCalled();
  });
  it("drains multiple pages beyond twenty, deduplicates, and processes oldest first", async () => {
    mocks.search.mockResolvedValueOnce({ list: Array.from({ length: 20 }, (_, i) => tweet(String(40 - i))), next: "page2" })
      .mockResolvedValueOnce({ list: [tweet("21"), ...Array.from({ length: 20 }, (_, i) => tweet(String(20 - i)))], next: "page3" })
      .mockResolvedValueOnce({ list: [], next: null });
    const result = await rettiwtTransport("fixture", "bot").fetchMentions("0");
    expect(result.map(m => m.id)).toEqual(Array.from({ length: 40 }, (_, i) => String(i + 1)));
    expect(mocks.search.mock.calls[1]).toEqual([{ mentions: ["bot"], sinceId: "0" }, 20, "page2"]);
  });

  it("fails the entire drain on a later page error or repeated cursor", async () => {
    mocks.search.mockResolvedValueOnce({ list: [tweet("30")], next: "next" }).mockRejectedValueOnce(new Error("provider unavailable"));
    await expect(rettiwtTransport("fixture", "bot").fetchMentions("0")).rejects.toThrow("provider unavailable");
    mocks.search.mockResolvedValue({ list: [tweet("30")], next: "same" });
    await expect(rettiwtTransport("fixture", "bot").fetchMentions("0")).rejects.toThrow("repeated a cursor");
  });

  it("reads only the newest page when establishing a first-start baseline", async () => {
    mocks.search.mockResolvedValue({ list: [tweet("30")], next: "history" });
    await expect(rettiwtTransport("fixture", "bot").fetchMentions(null)).resolves.toMatchObject([{ id: "30" }]);
    expect(mocks.search).toHaveBeenCalledOnce();
  });

  it("uploads image bytes and attaches its id while retaining the reply target", async () => {
    mocks.upload.mockResolvedValue("456");
    mocks.post.mockResolvedValue("789");
    const transport = rettiwtTransport("fixture-key", "@masayume_app");
    const media = await transport.uploadImage!(new Uint8Array([1, 2, 3]));
    await expect(transport.reply!("123", "Order filled\nSpent 3 credits.", media)).resolves.toBe("789");
    expect(mocks.upload.mock.calls[0]![0]).toBeInstanceOf(ArrayBuffer);
    expect(mocks.post).toHaveBeenCalledWith({ text: "Order filled\nSpent 3 credits.", replyTo: "123", media: [{ id: "456" }] });
    expect(mocks.configs.map(c => c.maxRetries)).toEqual([1, 0]);
    expect(mocks.configs.map(c => c.timeout)).toEqual([10_000, 30_000]);
  });

  it("keeps text-only replies free of media fields", async () => {
    mocks.post.mockResolvedValue("789");
    await rettiwtTransport("fixture-key", "masayume_app").reply!("123", "Status needs checking");
    expect(mocks.post).toHaveBeenCalledWith({ text: "Status needs checking", replyTo: "123" });
  });

  it.each(["a".repeat(281), "Unbudgeted emoji 🚀"])("rejects text outside the formatter contract", async text => {
    await expect(rettiwtTransport("fixture-key", "masayume_app").reply!("123", text)).rejects.toThrow("ASCII budget");
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it("does not turn a missing media id into an attached image", async () => {
    mocks.upload.mockResolvedValue("");
    await expect(rettiwtTransport("fixture-key", "masayume_app").uploadImage!(new Uint8Array([1]))).rejects.toThrow("media id");
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it("paces the search from X's own budget headers and holds after a rate refusal", async () => {
    const transport = rettiwtTransport("fixture", "bot");
    const reader = mocks.configs[0]!;
    const resetSec = Math.floor(Date.now() / 1000) + 900;
    reader.responseMiddleware!({ config: { url: "https://x.com/i/api/graphql/abc/UserByScreenName" }, headers: { "x-rate-limit-remaining": "0", "x-rate-limit-reset": String(resetSec) } });
    expect(transport.searchReadyAtMs!()).toBe(0);
    reader.responseMiddleware!({ config: { url: "https://x.com/i/api/graphql/abc/SearchTimeline" }, headers: { "x-rate-limit-remaining": "0", "x-rate-limit-reset": String(resetSec) } });
    expect(transport.searchReadyAtMs!()).toBe(resetSec * 1000 + 1_000);
    mocks.search.mockRejectedValue(Object.assign(new Error("Request failed with status code 429"), { name: "TWITTER_ERROR", status: 429 }));
    const failure = await transport.fetchMentions("0").catch(e => e);
    expect(failure).toBeInstanceOf(XRateLimitedError);
    expect(failure.retryAtMs).toBe(resetSec * 1000 + 1_000);
  });

  it("names an explicit X refusal of a reply and leaves ambiguous failures ambiguous", async () => {
    const transport = rettiwtTransport("fixture-key", "masayume_app");
    mocks.post.mockRejectedValueOnce(Object.assign(new Error("This request looks like it might be automated."), { name: "TWITTER_ERROR", status: 200, details: [{ code: 226 }] }));
    const refused = await transport.reply!("123", "Order filled").catch(e => e);
    expect(refused).toBeInstanceOf(XRefusedError);
    expect(refused.code).toBe("226");
    mocks.post.mockRejectedValueOnce(Object.assign(new Error("Request failed with status code 403"), { name: "TWITTER_ERROR", status: 403 }));
    await expect(transport.reply!("123", "Order filled")).rejects.toMatchObject({ name: "XRefusedError", code: "403" });
    for (const status of [500, 408]) {
      mocks.post.mockRejectedValueOnce(Object.assign(new Error("timeout of 30000ms exceeded"), { name: "TWITTER_ERROR", status }));
      await expect(transport.reply!("123", "Order filled")).rejects.not.toBeInstanceOf(XRefusedError);
    }
  });
});
