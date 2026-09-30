import { APP_IDENTITY } from "./identity";

/**
 * The app's own key prefix for SecureStore and MMKV (plan, iOS section: new SecureStore and MMKV key prefixes), from
 * app.identity.json so a rename changes one file (K-126). SecureStore keys allow only `[A-Za-z0-9._-]`.
 */
export const APP_KEY_PREFIX = APP_IDENTITY.storagePrefix;

/** A key in the app's namespace: `appKey("games.last")` → `<prefix>games.last`. */
export const appKey = (name: string): string => `${APP_KEY_PREFIX}${name}`;

/** The seat key in the Keychain / Keystore (SecureStore). */
export const SEAT_KEY = appKey("seat.key");

/**
 * Set when the person accepts the demo-credits terms (the last onboarding page, or the Take a seat sheet). The
 * SeatProvider re-checks it: no seat key is created before it is set.
 */
export const DEMO_TERMS_KEY = appKey("demo-terms.v1");

/** This install has been through the first run (read by `app/index.tsx` and `app/welcome.tsx`). */
export const ONBOARDED_KEY = appKey("onboarded.v1");

/** The push registration (device secret included) in the Keychain. */
export const PUSH_REGISTRATION_KEY = appKey("push.registration");
