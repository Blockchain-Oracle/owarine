/**
 * The visitor's IP, as the deployment's own proxy vouches for it — or null, which callers treat as "cannot verify".
 *
 * Two surfaces meter by IP (the devnet faucet and the proof replay), and both had one rule: trust `x-forwarded-for`
 * on Vercel, invent "local-development" in development, refuse everyone else. Vercel is the platform that
 * overwrites that header at its edge; nothing else was named, so a deployment anywhere else — Coolify behind
 * Cloudflare, say — answered "The faucet could not verify this connection" to every visitor, with the keys set
 * and the budget funded.
 *
 * The operator names the proxy that fronts them, `TRUSTED_PROXY`, and only then is a header believed:
 *   - `cloudflare` → `cf-connecting-ip`, which Cloudflare sets and overwrites on every request it forwards;
 *   - `forwarded`  → the LAST `x-forwarded-for` entry: the address the one proxy in front of us (Coolify's Traefik)
 *                    appended itself. A visitor can send a forged `X-Forwarded-For`; whether Traefik strips it or
 *                    appends to it, the last entry is the one Traefik saw, so a forged value never becomes the key
 *                    (K-003, C10a). This assumes exactly one proxy hop, which is the hosted shape;
 *   - `vercel`     → the first `x-forwarded-for`, which Vercel overwrites at its edge; `VERCEL=1` means the same.
 * Unnamed, production stays as it was: no header is trusted and the surface says it cannot verify the connection.
 * That is the honest failure, and it is loud enough that nobody ships without setting this.
 */
export function clientIp(request: Request): string | null {
  const proxy = (process.env.TRUSTED_PROXY ?? (process.env.VERCEL === "1" ? "vercel" : "")).trim().toLowerCase();
  const first = (name: string) => request.headers.get(name)?.split(",")[0]?.trim() || null;
  const last = (name: string) => request.headers.get(name)?.split(",").at(-1)?.trim() || null;
  if (proxy === "cloudflare") return first("cf-connecting-ip") ?? first("x-forwarded-for");
  if (proxy === "forwarded") return last("x-forwarded-for");
  if (proxy === "vercel") return first("x-forwarded-for");
  return process.env.NODE_ENV !== "production" ? "local-development" : null;
}

/**
 * The key a per-IP rate limit counts under. Every limiter uses this, never the raw header (C10a): with no trusted
 * proxy in production every caller shares one `unverified` bucket, which throttles harder rather than letting a
 * forged header mint a fresh bucket per request.
 */
export function rateLimitKey(request: Request): string {
  return clientIp(request) ?? "unverified";
}

/**
 * The bucket an address counts under for a limit that must hold across addresses one visitor controls (C4c, review L1):
 * an IPv6 address by its /64, the block one subscriber is routed (anyone holding one has 2^64 addresses to rotate); an
 * IPv4 address, or anything that is not an address, as itself.
 */
export function ipBucket(ip: string): string {
  const bare = ip.replace(/^\[|\](:\d+)?$/g, "").split("%")[0]!;
  if (!bare.includes(":") || /^::ffff:\d+\.\d+\.\d+\.\d+$/i.test(bare)) return bare.replace(/^::ffff:/i, "");
  const [head = "", tail = ""] = bare.split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const groups = bare.includes("::") ? [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right] : left;
  if (groups.length !== 8 || groups.some((g) => !/^[0-9a-f]{1,4}$/i.test(g))) return bare;
  return `${groups.slice(0, 4).map((g) => g.toLowerCase().replace(/^0+(?=.)/, "")).join(":")}::/64`;
}

/**
 * The origin a browser sees for this request. Behind a proxy that ends TLS, `request.url` is the scheme the server
 * itself spoke — `http://useagari.xyz` inside the container — while the browser sent `Origin: https://useagari.xyz`,
 * and a same-origin check against `request.url` refused every claim with "Open the faucet from Agari." When a
 * proxy is named (`TRUSTED_PROXY`), its `x-forwarded-proto` is the scheme; otherwise the request's own.
 */
export function publicOrigin(request: Request): string {
  const url = new URL(request.url);
  const proxy = (process.env.TRUSTED_PROXY ?? (process.env.VERCEL === "1" ? "vercel" : "")).trim();
  const proto = proxy ? request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() : null;
  const host = (proxy ? request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() : null) || url.host;
  return `${proto || url.protocol.replace(":", "")}://${host}`;
}
