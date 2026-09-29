/**
 * The app's own key prefix for SecureStore and MMKV (plan, iOS section: new SecureStore and MMKV key prefixes). It is
 * neutral on purpose: the Canton app is a new product, and its name is not chosen yet, so the one place to rename is
 * here. SecureStore keys allow only `[A-Za-z0-9._-]`.
 *
 * Only the seat and the first-run flag use it so far; the reference's other `agari.*` keys move with the identity rename.
 */
export const APP_KEY_PREFIX = "app.";

/** The seat key in the Keychain / Keystore (SecureStore). */
export const SEAT_KEY = `${APP_KEY_PREFIX}seat.key`;

/**
 * Set once this install has read and accepted the demo-credits page (the last onboarding page). Both entry readers
 * (`app/index.tsx`, `app/welcome.tsx`) and the SeatProvider check it; no seat is created before it is set.
 */
export const DEMO_TERMS_KEY = `${APP_KEY_PREFIX}onboarded.demo-terms.v1`;
