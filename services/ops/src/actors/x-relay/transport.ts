/** One mention of the account, as the relay reads it: who said what, when, and the post's own id. */
export interface Mention {
  id: string;
  authorId: string;
  handle: string | null;
  text: string;
  createdAtMs: number;
  replyTo?: string | null;
}

/**
 * The current deployment uses its existing account-session transport. Keep posting and uploading
 * separate so an upload failure can fall back to text before any reply is sent. The operator must
 * review X's current transport/automation requirements; this interface makes no policy or price claim.
 */
export interface XTransport {
  /** One line for the boot log: which way, and as whom. */
  describe(): string;
  /** Resolve the session's stable account id and verify the configured handle before polling. */
  authenticatedAuthorId(): Promise<string>;
  /** Mentions newer than `sinceId`, oldest first. */
  fetchMentions(sinceId: string | null): Promise<Mention[]>;
  /** The earliest time X's search budget allows the next `fetchMentions` (epoch ms); absent, any time. */
  searchReadyAtMs?: () => number;
  /** Upload only; this must never post or execute an instruction. */
  uploadImage?: (png: Uint8Array) => Promise<string>;
  /** One POST attempt under the mention; no hidden retries after ambiguous responses. Throws `XRefusedError` only when X answered with a refusal. */
  reply: ((mentionId: string, text: string, mediaId?: string) => Promise<string | null>) | null;
}

/**
 * X answered the reply POST with an explicit refusal (an error body, or a 4xx other than a timeout): nothing was
 * published, so it is not an ambiguous send. `code` is X's own error code (or the HTTP status) and is safe to log.
 */
export class XRefusedError extends Error {
  constructor(readonly code: string, detail: string) {
    super(`X refused the reply (${code}): ${detail}`);
    this.name = "XRefusedError";
  }
}

/** The mention search was refused for rate: the transport has already moved its next allowed search. */
export class XRateLimitedError extends Error {
  constructor(readonly retryAtMs: number) {
    super(`X rate-limited the mention search until ${new Date(retryAtMs).toISOString()}`);
    this.name = "XRateLimitedError";
  }
}
