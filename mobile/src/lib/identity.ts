import identity from "../../app.identity.json";

/**
 * The app's identity (app.identity.json, the file app.config.js builds the Expo config from; K-126): the same scheme,
 * storage prefix and MMKV id the native project was built with, read here so no screen spells them itself.
 */
export const APP_IDENTITY = identity;

/** A deep link into this app: `<scheme>://<path>` (widgets, the Live Activity, the seat link QR). */
export const appUrl = (path: string): string => `${identity.scheme}://${path.replace(/^\//, "")}`;

/** The in-app route a deep link of this app names (`<scheme>://markets/x` → `/markets/x`), or null for any other URL. */
export function appPathOf(url: string): string | null {
  const prefix = `${identity.scheme}://`;
  return url.startsWith(prefix) ? `/${url.slice(prefix.length)}` : null;
}
