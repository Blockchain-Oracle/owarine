import { Rettiwt } from "rettiwt-api";
import { createSearchPacer } from "./search-pacer";
import { XRateLimitedError, XRefusedError, type Mention, type XTransport } from "./transport";

const PAGE = 20;
const MAX_PAGES = 50;

/** The HTTP status, X's error codes and message a rettiwt failure carries; never its request, headers or cookies. */
export function xFailure(error: unknown): { status: number | null; codes: string[]; message: string } {
  const e = (error ?? {}) as { status?: unknown; response?: { status?: unknown }; details?: unknown; message?: unknown };
  const status = typeof e.status === "number" ? e.status : typeof e.response?.status === "number" ? e.response.status : null;
  const codes = Array.isArray(e.details)
    ? e.details.map(d => (d as { code?: unknown } | null)?.code).filter(c => typeof c === "number" || typeof c === "string").map(String)
    : [];
  return { status, codes, message: typeof e.message === "string" ? e.message.slice(0, 160) : "unknown error" };
}

/**
 * X answered and created nothing: an error body on a 200 (rettiwt raises those as `TWITTER_ERROR`), or a 4xx other
 * than a request timeout. A timeout, a 5xx or a lost connection stays ambiguous: the POST may have landed.
 */
function isRefusal(error: unknown): boolean {
  const { status } = xFailure(error);
  if (status === 200) return (error as { name?: unknown } | null)?.name === "TWITTER_ERROR";
  return status !== null && status >= 400 && status < 500 && status !== 408;
}

/**
 * The relay over the account's own session (`rettiwt-api`): X's search for `@handle`, newest first, and a
 * reply posted as the account. The API key is the account's cookies encoded by the library's own login
 * (`rettiwt auth login` or `Rettiwt.auth.login`), kept as a secret like any other.
 */
export function rettiwtTransport(apiKey: string, handle: string): XTransport {
  const user = handle.replace(/^@/, "");
  // Search occasionally hangs or returns a transient 404. Keep each failed scan short;
  // the durable cursor lets the next poll catch up without replaying an instruction.
  // Each search response reports X's remaining budget; the relay spends it evenly instead of hitting the lockout.
  const pacer = createSearchPacer();
  const client = new Rettiwt({
    apiKey, timeout: 10_000, maxRetries: 1,
    responseMiddleware: (response) => {
      if (String(response.config?.url ?? "").includes("/SearchTimeline")) pacer.observe(response.headers as Record<string, unknown>, Date.now());
    },
  });
  // A network retry after an accepted POST can create a duplicate public reply.
  const writer = new Rettiwt({ apiKey, timeout: 30_000, maxRetries: 0 });
  return {
    describe: () => `rettiwt (the account's session) · mentions of @${user}`,
    async authenticatedAuthorId() {
      const profile = await client.user.details();
      if (!profile || !/^\d+$/.test(profile.id) || profile.userName?.toLowerCase() !== user.toLowerCase()) {
        throw new Error("X session identity does not match the configured relay account");
      }
      return profile.id;
    },
    async fetchMentions(sinceId) {
      const mentions = new Map<string, Mention>();
      const cursors = new Set<string>();
      let cursor: string | undefined;
      for (let i = 0; i < MAX_PAGES; i++) {
        let page;
        try {
          page = await client.tweet.search({ mentions: [user], ...(sinceId !== null ? { sinceId } : {}) }, PAGE, cursor);
        } catch (error) {
          if (xFailure(error).status !== 429) throw error;
          pacer.limited(Date.now());
          throw new XRateLimitedError(pacer.readyAtMs());
        }
        for (const t of page.list) {
          if (!/^\d+$/.test(t.id)) throw new Error("Invalid mention id from X");
          if (!t.tweetBy?.id || (sinceId !== null && BigInt(t.id) <= BigInt(sinceId))) continue;
          mentions.set(t.id, {
          id: t.id,
          authorId: t.tweetBy.id,
          handle: t.tweetBy?.userName ?? null,
          text: t.fullText,
          createdAtMs: t.createdAt ? Date.parse(t.createdAt) || Date.now() : Date.now(),
          replyTo: t.replyTo ?? null,
          });
        }
        // First startup only establishes the newest cursor; never walk historical instructions.
        if (sinceId === null || page.list.length === 0 || !page.next || page.list.every(t => BigInt(t.id) <= BigInt(sinceId))) {
          return [...mentions.values()].sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
        }
        if (cursors.has(page.next)) throw new Error("X mention pagination repeated a cursor");
        cursors.add(page.next);
        cursor = page.next;
      }
      // A partial search must not advance since_id beyond unseen instructions.
      throw new Error("X mention backlog exceeds the bounded drain; cursor retained");
    },
    searchReadyAtMs: () => pacer.readyAtMs(),
    uploadImage: async (png) => {
      const id = await writer.tweet.upload(Uint8Array.from(png).buffer);
      if (!/^\d+$/.test(id)) throw new Error("X image upload did not return a media id");
      return id;
    },
    reply: async (mentionId, text, mediaId) => {
      if (!/^\d+$/.test(mentionId) || (mediaId && !/^\d+$/.test(mediaId))) throw new Error("Invalid reply identifier");
      if (text.length > 280 || /[^\x20-\x7E\n]/.test(text)) throw new Error("Reply text exceeded its verified ASCII budget");
      let id;
      try {
        id = await writer.tweet.post({ text, replyTo: mentionId, ...(mediaId ? { media: [{ id: mediaId }] } : {}) });
      } catch (error) {
        if (!isRefusal(error)) throw error;
        const failure = xFailure(error);
        throw new XRefusedError(failure.codes.join(",") || String(failure.status), failure.message);
      }
      return typeof id === "string" && id ? id : null;
    },
  };
}
