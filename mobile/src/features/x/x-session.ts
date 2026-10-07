import { X_SESSION_HEADER } from "@owarine/core/x";
import * as SecureStore from "expo-secure-store";
import { appKey } from "~/lib/keys";

/**
 * The X session the web handed this app (C13a, `/native-auth`): the same signed token the web keeps in its cookie,
 * kept in the Keychain (it is a credential for our own site, like the cookie) and sent back in `X_SESSION_HEADER` on the
 * X routes. It names an X account only; it never signs for the seat, which still signs its own link text.
 */
const KEY = appKey("x.session");
let current: string | null | undefined;

export async function loadForwardedXSession(): Promise<string | null> {
  if (current === undefined) current = await SecureStore.getItemAsync(KEY).catch(() => null);
  return current ?? null;
}

export async function setForwardedXSession(token: string | null): Promise<void> {
  current = token;
  if (token === null) await SecureStore.deleteItemAsync(KEY).catch(() => undefined);
  else await SecureStore.setItemAsync(KEY, token, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }).catch(() => undefined);
}

/** The header to send on an X route, once loaded; empty when this app holds no X session. */
export async function xSessionHeaders(): Promise<Record<string, string>> {
  const token = await loadForwardedXSession();
  return token ? { [X_SESSION_HEADER]: token } : {};
}
