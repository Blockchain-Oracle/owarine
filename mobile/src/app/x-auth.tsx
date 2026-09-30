import { Redirect } from "expo-router";

/**
 * `<scheme>://x-auth` (C13a, K-145): where the `/native-auth` handoff returns. On iOS the auth session captures that
 * URL and hands it to `signInWithX`, so this route is never shown; where a platform delivers it as an ordinary deep
 * link instead, it lands the person back on the X screen, which re-reads the session.
 */
export default function XAuthReturn() {
  return <Redirect href="/trade-from-x" />;
}
