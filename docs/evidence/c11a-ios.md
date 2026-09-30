# C11a: the iOS app ready for TestFlight on Canton (everything that does not need Abu's App Store Connect record)

Lane C11a, branch `slice/C11a-ios` from `main` at d995161, 30 Sep 2026. It covers the plan's iOS section, steps 1 to 11, its distribution and its review hygiene (`00-plan.md`, "iOS: port the reference's native app, ship on TestFlight"). Nothing in this lane contacted Expo or Apple. It ran no `eas` command, and it did not open or copy any key file.

## Step 1: the reference app's live identifiers are gone (safety first)

`mobile/app.json` and `eas.json` still carried the Solana app's live identifiers:

- its EAS project `9a7235af…` and that project's `updates.url`;
- `owner`;
- bundle id and package `xyz.useagari.app`;
- scheme `agari`;
- its App Store Connect app id and key paths.

One `eas update` from this repo would have reached that app's TestFlight users. Fixed in 26377b3 and recorded as **K-126**:

| Identifier | Now | Where |
|---|---|---|
| Display name | Agari Canton (working name, K-007) | `mobile/app.identity.json` |
| Slug | `agari-canton` | 〃 |
| Bundle id, Android package | `xyz.useagari.canton` | 〃 |
| Scheme | `agaricanton` | 〃 (web copy `APP_LINK_SCHEME`, checked equal) |
| App Group | `group.xyz.useagari.canton` | 〃 → expo-widgets `groupIdentifier` |
| Widget + Live Activity extension | `xyz.useagari.canton.ExpoWidgetsTarget` (expo-widgets hosts both in one target) | 〃 → expo-widgets `bundleIdentifier` |
| SecureStore prefix / MMKV id | `canton.` / `canton` | 〃 → `src/lib/keys.ts`, `src/lib/storage.ts`; every app-owned key uses `appKey()` |
| EAS project | none (`easProjectId: null`) | no `extra.eas`, no `owner`, `updates.enabled: false` |
| `eas.json` | build profiles kept (Node 25.9.0, pnpm 11.24.0); the `submit` block with the old app id and key paths is removed | |

`app.config.js` builds the whole Expo config from that one file, and `app.json` is deleted. The **`mobile-identity`** invariant fails if:

- the old EAS project id (and with it its update URL) or App Store Connect id `6816116543` appears in any code or config file;
- an identity value reuses a reference value;
- `app.json` comes back;
- app source spells `agari://`;
- web's scheme differs from the app's.

I proved it by planting each value and watching it fail. `expo config` (run locally with `EXPO_OFFLINE=1`) resolves the new name, slug, scheme, bundle id and package, `usesNonExemptEncryption: false`, and the extension with the new App Group entitlement. It has no owner and no updates URL.

## Steps 1 to 11, state and verification

| Step | State | Verified by |
|---|---|---|
| 1 Seat signer | Done. `sessions/mobile` is `seat.ts` alone (4decba3). The Phantom/Solflare link wallet, `bytesSigner`, the practice wallet and the tap-trading stubs had no caller left and are deleted. The key is made in `mobile/src/wallet/seat-key.ts`, apart from the Keychain. | `mobile/src/wallet/seat-key.test.ts` (a new vitest project, `@agari/mobile`) makes the key exactly as the phone does. Web's `verifyWalletMessage` accepts its signed lease request, and refuses tampered text or another address. `seatCaller` resolves its signed read header, and refuses it when stale or on another network. |
| 2 Seat store and provider | Done in C1e (SeatProvider fills web's `WalletShellContext`, Keychain `WHEN_UNLOCKED_THIS_DEVICE_ONLY`). This lane adds `joinSeat`. | mobile typecheck |
| 2b Seat link | **Done (624aae5).** See below. | route and SQL tests; typecheck on web and mobile |
| 3 First run | Done in C1e: the demo-credits page is the last onboarding page, and its accept takes the seat. Both readers use the prefixed flag, and the SeatProvider re-reads it. | `mobile-review-hygiene` keeps "demo credits", "no cash value" and "test network" in the gate |
| 4 Deletions | Done. The phone has none of these: Phantom/Solflare/MWA, `@solana-mobile/*`, `@agari/clients`, the query schemes, `+native-intent`. What stays: the `session-key-provider` and `mainnet-signer` shims, because web still has `features/session` and `mainnet-signer.ts` (the plan removes the latter "once the desk is on Canton"). | `no-solana`, `ledger-import-boundary` |
| 5 Env | Done in C1e (`MarketsEnv` from `EXPO_PUBLIC_*`, no addresses file). This lane derives ops' origin (step 8). | `env.test.ts` |
| 6 Funds | Done in C1e/C4b: the demo-credits grant is the signed seat lease (`useSeatCredit`), with no faucet, SOL or lamport line in duel or strategies. The desk's `MoneySheet` still gates on a `lamports` field, mirroring web's desk (the desk lane's area); its copy is Canton. | grep; `no-solana-copy` |
| 7 Links and copy | Done in C1e: ledger links open web `/proof`, and the Solana marks are gone. `mobile/README.md` was rewritten for Canton here. | `mobile-no-web-handoff`, `no-solana-copy` |
| 8 Live prices | **Fixed (2d55974).** They were silently off. No build set `EXPO_PUBLIC_PRICE_FEED_URL`/`LADDER_URL`. Also, react-native-sse 1.2.1 never retries after a network error (XHR status 0), while the adapter told the runtime it was retrying. Now: ops' origin defaults to `https://ops.<domain>` (the Coolify convention), or port 8787 for a local web. Every error closes the socket and hands the retry to the runtime's exponential backoff. In the background the socket is closed; it reconnects in the foreground. | `sse-source.test.ts` (3 cases with fakes), `env.test.ts` |
| 9 Invariants | **Done (53e285a).** `kit-import-boundary` became `ledger-import-boundary`: `@solana-mobile/` was added, and the phone never imports `@agari/ledger`. Also new: `mobile-review-hygiene`, `mobile-identity`, `mobile-bundle-reach` (below). | each rule planted-failure tested |
| 9b Shim map | Done in C1e (`mobile-shim-paths`). This lane adds **`mobile-bundle-reach`**: it walks the bundle the way Metro resolves it (routes, value imports, `~/`/`@/`/workspace `exports`, the shim map). It fails on any reached module that imports a DOM-, Next-, server- or Node-only package. | It found 18 edges on `main` (below). After the fix it finds 0. |
| 10 Push | Client unchanged (it signs with the seat, and `networkLine` names Canton DevNet). The drain now resolves each phone's lease, a joined phone's included (94181f0). **A private call's settle push is not wired yet.** The projector records rows by party, never by address, so the seat's own inbox is a clearly marked stub, `seatInboxFeed(holder, lease, since)` in `web/src/features/activity/feed.server.ts`. It answers the published inbox until C13a's `seatActivityReader(sql).fills/settlements(address, lease)` lands, and the lead wires it after both merge. (My first version read `owner_address`; it was removed on the C13a finding.) | web typecheck |
| 11 New surfaces | **Done (fb324f8, and C11a.11 for publish)**, native and literal: the "who can see this" chip on the held price, each open bet and the placed call; the per-party view switcher as §04 on a Window (the same `/api/view` query as Alice, Bob, an outsider and the seat, with a native Code Block); and the seat link card. StepProgress and the ring were already native (C4b). Web's switcher logic moved to `canton-ux/privacy/party-views.ts` so both apps share it. C5.3's "Publish this call" was missing on the phone; it is now on open bets and settled rounds. | mobile typecheck; design-literals; iOS export |

## Step 2b: the seat link (web and phone)

- **Server:**
  - `POST /api/seat/link`: the device that took the seat gets a one-time code. Codes use 31 unambiguous characters from the CSPRNG, last 60 s, work once, and a seat gets at most 6 a minute.
  - `GET ?code=`: showing, expired or linked.
  - `POST /api/seat/link/join`: the other key signs `seatLinkText` naming the code. The code is used and the key joins the lease in one transaction (`seat_linked_keys`). Unknown, expired and used codes get one answer. Each IP gets 10 attempts a minute. A key that holds its own seat is refused. Web also gets its seat cookie.
  - `byAddress` resolves a joined key, and a joined browser's cookie passes the seat check.
  - A joined key never takes a seat of its own. Its "Reset seat" takes only that key off; the holder's reset drains the seat.
- **Web:**
  - `/seat/link` on live state: the holder's code, the QR and its countdown, turning "Linked" by itself; the code entry for any device; `?code=` fills it.
  - The header seat menu's "Use on another device" (holders only).
  - The QR carries `agaricanton://seat/link?code=…`, so the iPhone camera opens the app.
- **Phone:**
  - `/seat/link` (the same deep link), a literal port of web's card: the 21st #29246 layout, OTP entry after #23543, the QR from `qrcode-generator` (added to the app's dependencies).
  - Reached from the account sheet (holders) and from the Take a seat sheet ("Have a seat on the web? Link this phone").
  - A code that arrives by link is filled in and joins only on the button. The demo-credits terms come first.
- **Tests:**
  - `web/src/lib/seat-link.server.test.ts`: code alphabet, forgiving entry, the join check against the server verifier.
  - `web/src/lib/seat-link-store.server.test.ts`: issue, redeem once, expiry, own-seat, code state, unlink, lease end. It ran green on a throwaway Postgres 17 of my own (12/12 with `seat-store.server.test.ts`), which I then removed.
- **Not covered, for a later lane:** a few ops paths still map address → party with `seat_pool.address` only. They are the agents' session, arena-desk duel seats, desk-runner discovery and web `agents.server.ts`. A joined phone's own key would not map there: an agent grant or duel credential signed by the joined phone. The holder's device is unaffected.

## The bundle was broken on `main`, and why tsc never said so

The first `expo export --platform ios` failed. The error was "Unable to resolve module #prehydration/slider/thumb" in `@base-ui/react`, reached as follows:

- `app/(tabs)/portfolio`
- → web `useMoney.ts`
- → `@/features/markets/balance` (barrel)
- → `BalanceSheetPanel`
- → vault
- → `BetRow`
- → `CashOut` (C7a.4 added `@/features/canton-ux/ticket`)
- → `WriteProgress`
- → web `desk-kit`
- → `@base-ui/react`

Metro does not tree-shake, so a barrel import drags the barrel's DOM components into the phone. The reach walk listed 18 such edges from two roots:

- `useMoney`'s barrels (`balance`, `x`);
- the phone's `@/features/leverage` barrel imports (BetsPanel, BoostRow, three Short files).

Leaf imports fix all of it (web `useMoney.ts` and five phone files). `mobile-bundle-reach` keeps it fixed.

## Gates

| Gate | Result |
|---|---|
| `pnpm --filter @agari/mobile typecheck` | green |
| `pnpm --filter web typecheck`, `@agari/markets`, `@agari/db` | green |
| `pnpm invariants` | 0 errors, 1 warning (the existing `no-float-money` in `packages/markets/src/desk/canton.ts:57`) |
| `pnpm test` | 255 files passed, 7 skipped; 2,092 tests passed, 28 skipped. The mobile project adds 3 files and 7 tests. The Postgres suites for the seat store and the seat link ran separately against my own throwaway Postgres: 12/12. |
| `expo export --platform ios` / `android` (Node 25.9.0, `EXPO_OFFLINE=1`, output in the session scratchpad, deleted after) | **Failed on `main`**, section above. After e16cb65 both are green: iOS 5,498 modules (Hermes bundle 13.5 MB, no `@base-ui` in it, the scheme `agaricanton` in it) and Android 5,571 modules. Both were re-run at the last code commit (C11a.11): iOS 5,501 modules, Android 5,574 modules, both green. |
| Simulator (`expo run:ios`) | **Skipped.** The load average ran 18 to 44 through the session, and swap stood at 7 to 12 GB of 13. Every flow past the first-run page needs the local Canton sandbox plus web and ops, so the run's conditions (load < 30 and no sandbox) did not hold. |

## What Abu must do (in this order)

1. **Name (optional, before step 3).** If the app should not be "Agari Canton" / `xyz.useagari.canton`, say the name now. A bundle id cannot change once the App Store Connect record exists. Only `mobile/app.identity.json` changes (and web's `APP_LINK_SCHEME` if the scheme changes; the invariant checks the pair).
2. **Apple Developer portal** (team 86C6ZFJ6V6, Certificates, Identifiers & Profiles). Builds run with `EXPO_NO_CAPABILITY_SYNC=1`, so EAS will not create these:
   - Identifiers → **App Groups** → register `group.xyz.useagari.canton`.
   - Identifiers → **App IDs** → register `xyz.useagari.canton` with the capabilities **App Groups** (assign the group above) and **Push Notifications**.
   - Identifiers → **App IDs** → register the extension `xyz.useagari.canton.ExpoWidgetsTarget` with **App Groups** (the same group). The Live Activity needs no capability: `NSSupportsLiveActivities` is in the Info.plist.
3. **App Store Connect → Apps → New App.** Choose iOS and the bundle id `xyz.useagari.canton`. The name and subtitle should avoid "prediction market" and "wallet". Then send me the app's **Apple ID** (the numeric `ascAppId`). While there:
   - age rating: Simulated Gambling = Frequent (18+);
   - category: Utilities or Education;
   - App Privacy: the seat identifier (a device-made key) and the push token, not linked to identity.
4. **Then, with your go-ahead, we create the new EAS project.** `eas init` in `mobile/` creates it under your signed-in account, with the new slug. The config is dynamic, so its `projectId` goes into `app.identity.json` → `easProjectId`. That turns on `extra.eas.projectId` and the new update URL. Then `eas credentials` attaches the existing App Store Connect API key and APNs key (reused per the plan). Finally the `eas.json` `submit.production.ios` block gets the new `ascAppId` and the same key fields as before. The invariant bans only the old app id.
5. **Build env**, once the domain exists: `EXPO_PUBLIC_SITE_URL=https://<domain>` in the EAS profiles. Ops then defaults to `https://ops.<domain>`.
6. **Android push** (for the APK): FCM V1 credentials on the new EAS project. Android push was never run in the reference.

## Still open after this lane

- The settle push for private calls waits on C13a's seat reader (the stub above).
- The real-phone pass has not run: seed persists, signed header accepted, push on settle, the same seat on web and phone, outsider view empty. Neither has the webdump side-by-side of the new native surfaces.
- A few ops paths still resolve address → party through `seat_pool.address` only (seat link section). A phone that joined a seat can use the seat everywhere the web routes act as it. But an agent grant, a duel credential or a desk that the joined key itself signs does not map yet.
