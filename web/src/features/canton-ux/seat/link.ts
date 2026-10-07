import { seatLinkPath } from "@owarine/markets";

/**
 * The phone app's deep-link scheme, so a QR shown on the web opens the app's seat link screen from the iPhone's camera
 * (`<scheme>://seat/link?code=…`). It must equal `mobile/app.identity.json`'s `scheme`; the `mobile-identity` invariant
 * checks it (web never imports from mobile, D-129).
 */
export const APP_LINK_SCHEME = "owarine";

export const appSeatLinkUrl = (code: string) => `${APP_LINK_SCHEME}://${seatLinkPath(code)}`;
