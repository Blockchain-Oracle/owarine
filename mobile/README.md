# The phone app (Expo)

The iOS and Android app of the Canton prediction market. It is the web's phone layout ported to React Native, and it reuses the web's hooks and copy (`@/` resolves to `web/src`, with a few browser-bound files swapped for `src/web-shims`, listed in `web-shims.map.cjs`). [TAKEOVER_STATUS.md](./TAKEOVER_STATUS.md) is the reference app's route inventory; `docs/evidence/c11a-ios.md` is this app's Canton state.

## Identity

Every identifier the stores, EAS, deep links and on-device storage see (display name, slug, bundle id, Android package, scheme, App Group, widget and Live Activity extension, SecureStore prefix, MMKV id, EAS project) lives in `app.identity.json`; `app.config.js` builds the Expo config from it (K-126). None of them is the reference app's, and the `mobile-identity` invariant keeps it that way.

## Run locally

From the repository root, with Node 25.9.0 (`nvm use 25.9.0`):

```sh
pnpm install
pnpm --filter @owarine/mobile ios
# or, with an Android device or emulator configured:
pnpm --filter @owarine/mobile android
```

This is a development build; Expo Go does not include the app's native modules.

Against a local stack on the iOS Simulator (C11b, `docs/evidence/c11b-ios-sim.md`): `expo prebuild --platform ios`, `pod install` in `ios/`, then an `xcodebuild … -configuration Debug -destination id=<simulator>` build (about 27 minutes cold). Start Metro with `EXPO_PUBLIC_SITE_URL=http://localhost:<web port>`, `EXPO_PUBLIC_OPS_URL=http://localhost:<ops port>` and `EXPO_PUBLIC_CANTON_NETWORK=localnet` (the seat's signed texts name the network, so it must match the web's), and without `--localhost` (that binds `[::1]` only). Then open the dev client at `owarine://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A<metro port>`. The simulator shares the Mac's `localhost`. Point the app at a web deploy with `EXPO_PUBLIC_SITE_URL` (default `http://localhost:3000`). The price and ladder streams come from ops: `EXPO_PUBLIC_OPS_URL`, or by default `https://ops.<domain>` for an https site and port 8787 on the same host for a local one. The app holds no ledger credential and no party id: it reaches the ledger only through the web's routes.

## The seat

- A seat is the phone's account: an ed25519 key made on the phone and kept in the Keychain (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`). It signs the lease request and a short-lived read header; the server maps it to a leased Canton party.
- The first run ends on the demo-credits page: demo credits have no cash value, and this is a test network. Accepting takes the seat. There is no purchase path of any kind.
- One seat on web and phone: the device that took the seat shows a one-time code and QR (`/seat/link`, 60 s, single use); the other device joins with it. The QR opens `owarine://seat/link?code=…`.

## Checks

```sh
pnpm --filter @owarine/mobile typecheck
pnpm invariants
pnpm exec vitest run --project @owarine/mobile
pnpm --filter @owarine/mobile exec expo export --platform ios
pnpm --filter @owarine/mobile exec expo export --platform android
```
