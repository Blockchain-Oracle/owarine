# C11 — iOS on public TestFlight (and the Android APK)

**Goal:** the reference's native Expo app on Canton: a seat from the Keychain, a call placed and settled with a push, on a public TestFlight link, plus an APK from the same build.

- **Dates:** new bundle id and app record Wed 30 Sep; EAS development build Thu 1 Oct; internal TestFlight build Sun 4; **beta review submitted Mon 5, hard date Tue 6**.
- **Plan:** `00-plan.md`, "iOS: port the reference's native app, ship on TestFlight".
- **Lanes:** mobile lane (EAS cloud builds by default); shares 1e/1f with C1.
- **K-number block:** K-125–139 (K-125 distribution default recorded).
- **Needs Abu (when the build reaches it):** the new App Store Connect app record, App Group, widget and Live Activity extension ids, Push capability, age rating.

## Steps

- [ ] iOS steps 1–7 (with C1 1e): seat signer, seat store and SeatProvider, 2b seat link, first-run demo-credits gate, deletions, env, funds
- [ ] Step 8: live prices via `react-native-sse`
- [ ] Step 9 and 9b: `ledger-import-boundary` adds `@solana-mobile/`; shim map kept in step; the shim-path invariant
- [ ] Step 10: push on settle through the Canton inbox feed; `networkLine` names Canton
- [ ] Step 11: new surfaces on the native desk kit, verified side by side with `webdump.mjs`
- [ ] New identifiers throughout: EAS project, scheme, bundle id, `android.package`, App Group, extension ids, SecureStore/MMKV prefixes
- [ ] Review hygiene: 18+ age rating, first-run gate, no purchase path, `ITSAppUsesNonExemptEncryption = false`, App Privacy declares the seat identifier, review notes naming the 1-minute market
- [ ] Android APK (FCM credentials added), GitHub release with SHA-256 and QR

## Gate

- `pnpm --filter @agari/mobile typecheck`, `pnpm invariants`, `expo export` for iOS and Android.
- Internal build leases a seat, places a call, receives the settle push.
- Real-phone pass: seed persists, signed header accepted, push on settle, same seat on web and phone, outsider view empty.
- Public link approved; the link and APK handed to C10's `/download`.

**Acceptance rows required:** internal build call and push (update ids), real-phone pass, beta review submission and outcome, APK hash.

## Findings

## Handoff
