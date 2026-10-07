/**
 * The one config point for what the public pages link to but this repository cannot build by itself (C10f): the iPhone
 * TestFlight invitation, the Android APK with its SHA-256, and the demo film. Each is a runtime environment variable
 * read on the server per request, so a deployment flips `/download` and `/demo` from their honest waiting state to the
 * real thing by setting a value and restarting, with no code change and no rebuild. None of them is a secret, and
 * none is `NEXT_PUBLIC_*`: the pages read them on the server and render the result.
 *
 *   OWARINE_TESTFLIGHT_URL       https://testflight.apple.com/join/<code>
 *   OWARINE_ANDROID_APK_URL      https://… .apk (a GitHub release asset)
 *   OWARINE_ANDROID_APK_SHA256   64 hex characters, the file's sha256sum
 *   OWARINE_ANDROID_APK_VERSION  optional, "0.1.0"
 *   OWARINE_DEMO_VIDEO_URL       a YouTube link (watch, youtu.be or embed) or a direct https .mp4 / .webm file
 *
 * A malformed value counts as unset: the page keeps naming what it waits on rather than linking somewhere wrong.
 */

export interface AndroidRelease {
  url: string;
  sha256: string;
  version: string | null;
}

export type DemoFilm = { kind: "youtube"; id: string; watchUrl: string } | { kind: "file"; src: string };

export interface PublicRelease {
  testflightUrl: string | null;
  android: AndroidRelease | null;
  demoFilm: DemoFilm | null;
}

type Env = Record<string, string | undefined>;

const SHA256 = /^[0-9a-f]{64}$/;
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const VERSION = /^[0-9A-Za-z.+-]{1,32}$/;

/** An absolute https URL, or null. */
function httpsUrl(raw: string | undefined): URL | null {
  const text = raw?.trim();
  if (!text) return null;
  try {
    const url = new URL(text);
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

/** Only Apple's own join links: a TestFlight invitation is never anywhere else. */
export function parseTestflightUrl(raw: string | undefined): string | null {
  const url = httpsUrl(raw);
  return url && url.hostname === "testflight.apple.com" && url.pathname.startsWith("/join/") ? url.toString() : null;
}

/** The APK needs both its file and its checksum: a download nobody can verify is not offered. */
export function parseAndroidRelease(env: Env): AndroidRelease | null {
  const url = httpsUrl(env.OWARINE_ANDROID_APK_URL);
  const sha256 = env.OWARINE_ANDROID_APK_SHA256?.trim().toLowerCase() ?? "";
  if (!url || !url.pathname.toLowerCase().endsWith(".apk") || !SHA256.test(sha256)) return null;
  const version = env.OWARINE_ANDROID_APK_VERSION?.trim() ?? "";
  return { url: url.toString(), sha256, version: VERSION.test(version) ? version : null };
}

/** A YouTube watch, short or embed link becomes its video id; a direct https video file plays in a `<video>`. */
export function parseDemoFilm(raw: string | undefined): DemoFilm | null {
  const url = httpsUrl(raw);
  if (!url) return null;
  const host = url.hostname.replace(/^www\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = url.pathname.slice(1);
  else if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
    id = url.pathname === "/watch" ? url.searchParams.get("v") : url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1] ?? null;
  }
  if (id !== null) return YOUTUBE_ID.test(id) ? { kind: "youtube", id, watchUrl: `https://youtu.be/${id}` } : null;
  return /\.(mp4|webm)$/i.test(url.pathname) ? { kind: "file", src: url.toString() } : null;
}

export function readPublicRelease(env: Env = process.env): PublicRelease {
  return {
    testflightUrl: parseTestflightUrl(env.OWARINE_TESTFLIGHT_URL),
    android: parseAndroidRelease(env),
    demoFilm: parseDemoFilm(env.OWARINE_DEMO_VIDEO_URL),
  };
}
