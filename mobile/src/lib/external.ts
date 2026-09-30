import { PROOF_BASE_PATH } from "@agari/core/constants";
import type { Signature } from "@agari/core/types";
import { txUrl } from "@agari/core/urls";
import * as WebBrowser from "expo-web-browser";
import { router } from "expo-router";
import { marketsEnv, SITE_URL } from "./env";

/**
 * The app's one door to the outside: guides on the docs site, and a ledger update's proof. The product's own pages are
 * native screens, so a link back to the web app is refused here rather than opened (the `mobile-no-web-handoff`
 * invariant keeps every other file off the browser). The one exception is `/proof`: Canton updates are private, so
 * there is no public explorer, and the phone has no proof screen (Abu, 25 Sep): the web's proof page re-reads it.
 * The second is X's sign-in (`openXSignIn`, C13a, K-145): an OAuth round-trip can only run in a browser, so the web's
 * `/native-auth` runs it in an auth session and hands the X session back on this app's scheme.
 */
const PRODUCT_ORIGIN = new URL(SITE_URL).host;

export function isProductUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.host === PRODUCT_ORIGIN && parsed.pathname !== PROOF_BASE_PATH;
  } catch {
    return false;
  }
}

export async function openExternal(url: string): Promise<void> {
  if (isProductUrl(url)) throw new Error(`Refusing to open a product page in a browser: ${url}`);
  await WebBrowser.openBrowserAsync(url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET });
}

/**
 * X's sign-in through the web's `/native-auth` handoff, in an auth session (ASWebAuthenticationSession on iOS), which
 * returns the callback URL on `returnUrl`'s scheme to the caller instead of routing it. Only this one path opens.
 */
export async function openXSignIn(state: string, returnUrl: string): Promise<{ type: "success"; url: string } | { type: "cancel" }> {
  const result = await WebBrowser.openAuthSessionAsync(`${SITE_URL}/native-auth?state=${encodeURIComponent(state)}`, returnUrl);
  return result.type === "success" ? { type: "success", url: result.url } : { type: "cancel" };
}

/** A ledger update's proof on the web: core's `txUrl` (`/proof?update=…`), made absolute against the site. */
export function proofUrl(update: string): string {
  return `${SITE_URL}${txUrl(update as Signature, marketsEnv.cluster)}`;
}

/**
 * Where the reference opened Solana Explorer: an update opens its proof page; a seat opens its own native page
 * (`/u/<address>`), since a party has no public explorer page either.
 */
export async function openLedgerLink(kind: "tx" | "address", id: string): Promise<void> {
  if (kind === "address") {
    router.push(`/u/${id}` as never);
    return;
  }
  await openExternal(proofUrl(id));
}
