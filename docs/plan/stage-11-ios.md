# C11 — iOS on public TestFlight (and the Android APK)

**Goal:** the reference's native Expo app on Canton: a seat from the Keychain, a call placed and settled with a push, on a public TestFlight link, plus an APK from the same build.

- **Dates:** new bundle id and app record Wed 30 Sep; EAS development build Thu 1 Oct; internal TestFlight build Sun 4; **beta review submitted Mon 5, hard date Tue 6**.
- **Plan:** `00-plan.md`, "iOS: port the reference's native app, ship on TestFlight".
- **Lanes:** mobile lane (EAS cloud builds by default); shares 1e/1f with C1.
- **K-number block:** K-125–139 (K-125 distribution default recorded).
- **Needs Abu (when the build reaches it):** the new App Store Connect app record, App Group, widget and Live Activity extension ids, Push capability, age rating.

## Steps

- [x] iOS steps 1–7 (with C1 1e): seat signer, seat store and SeatProvider, 2b seat link, first-run demo-credits gate, deletions, env, funds (C11a; `evidence/c11a-ios.md`)
- [x] Step 8: live prices via `react-native-sse` (on by default from ops' origin; errors to the runtime's backoff; closed in the background)
- [x] Step 9 and 9b: `ledger-import-boundary` adds `@solana-mobile/`; shim map kept in step; the shim-path invariant; `mobile-bundle-reach` (Metro-accurate reach, found `expo export` broken on main and fixed)
- [ ] Step 10: push on settle through the Canton inbox feed; `networkLine` names Canton. The drain resolves each phone's lease; `seatInboxFeed` is a marked stub until C13a's seat reader lands (private calls send no push until then)
- [ ] Step 11: new surfaces on the native desk kit, verified side by side with `webdump.mjs`. Built (chip, view switcher, seat link, publish; StepProgress and ring from C4b); the side-by-side pass needs a simulator run
- [ ] New identifiers throughout: EAS project, scheme, bundle id, `android.package`, App Group, extension ids, SecureStore/MMKV prefixes. All but the EAS project are done (K-126, `mobile/app.identity.json`); the EAS project follows Abu's App Store Connect record
- [ ] Review hygiene: 18+ age rating, first-run gate, no purchase path, `ITSAppUsesNonExemptEncryption = false`, App Privacy declares the seat identifier, review notes naming the 1-minute market. The in-binary items are done and guarded by `mobile-review-hygiene`; the App Store Connect items are Abu's
- [ ] Android APK (FCM credentials added), GitHub release with SHA-256 and QR

## Gate

- `pnpm --filter @agari/mobile typecheck`, `pnpm invariants`, `expo export` for iOS and Android.
- Internal build leases a seat, places a call, receives the settle push.
- Real-phone pass: seed persists, signed header accepted, push on settle, same seat on web and phone, outsider view empty.
- Public link approved; the link and APK handed to C10's `/download`.

**Acceptance rows required:** internal build call and push (update ids), real-phone pass, beta review submission and outcome, APK hash.

## Findings

- 2026-09-30 (C11a): `mobile/app.json`/`eas.json` carried the Solana app's live EAS project, update URL, owner and App Store Connect ids; replaced by `mobile/app.identity.json` (K-126) under the `mobile-identity` invariant.
- 2026-09-30 (C11a): `expo export` was broken on `main` since C7a.4 (a web barrel chain pulled `@base-ui/react` into the phone); tsc never showed it. Fixed with leaf imports; `mobile-bundle-reach` guards the class.
- 2026-09-30 (C11a): live prices were silently off on the phone (no feed URL in any build; react-native-sse never retries after a network error). Fixed.
- 2026-09-30 (C11a): the projector never writes `owner_address`; a seat's own rows are read by its leased party (C13a's seat reader).

## Handoff

- Next for the lead: wire C13a's `seatActivityReader` into `seatInboxFeed` (`web/src/features/activity/feed.server.ts`) once both are on main.
- Needs Abu, in order (details in `docs/evidence/c11a-ios.md`): the name (optional), then in the Apple Developer portal the App Group `group.xyz.useagari.canton` and the App IDs `xyz.useagari.canton` (App Groups + Push) and `xyz.useagari.canton.ExpoWidgetsTarget` (App Groups), then the App Store Connect record and its numeric Apple ID. After that, and with his go-ahead, `eas init` and `eas credentials`.
