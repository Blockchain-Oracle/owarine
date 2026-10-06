# C11b: the iPhone app on the iOS Simulator against a local Canton stack (2026-10-06)

Lane C11b, branch `slice/C11b-ios` from `main` at `79b9614`. Stage C11, decisions K-305 – K-314. It follows `c11a-ios.md`, which built everything that needs no simulator. Before this lane the phone had only typechecked and exported. Now it has been built, launched and driven end to end: a seat from the Keychain, four calls through the firm quote, their settles and verdicts, the per-party views, the seat link both ways with web, both resets, and the settle push in the drain's own shape.

Nothing here contacted Expo or Apple with an account. No `eas` command ran, and nothing was signed with a team. Every screen is in `docs/evidence/ux/c11b/`.

## Setup

| Piece | What ran |
|---|---|
| Native build | `expo prebuild --platform ios --no-install` (3 s; `ios/` is gitignored), `pod install` (2 min 23 s, 131 pods), then `xcodebuild -workspace AgariCanton.xcworkspace -scheme AgariCanton -configuration Debug -destination id=<lane simulator> -derivedDataPath <scratch>`: **green first time, 26 min 46 s** at load 40–66, 0 errors, 1,306 warnings. DerivedData was 4.3 GB, the `.app` 186 MB with `ExpoWidgetsTarget.appex` inside. No config plugin, entitlement or native dependency needed a fix for the simulator. |
| Simulator | `pm-c11b iPhone 17` (iOS 26.5), made for this lane and deleted at the end. It was driven with the Claude Code iOS Simulator tool (tap, swipe, open_url), and the evidence files were taken with `xcrun simctl io … screenshot`. |
| Metro | `expo start --dev-client --port 8082` with `EXPO_PUBLIC_SITE_URL=http://localhost:3180`, `EXPO_PUBLIC_OPS_URL=http://localhost:8780`, `EXPO_PUBLIC_CANTON_NETWORK=localnet` and `EXPO_OFFLINE=1`. The dev client was opened with `agaricanton://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8082`. |
| Sandbox | `dpm sandbox` (Canton 3.5.17) on 7801–7806, JSON API :7805, `JAVA_OPTS=-Xmx1536m`. It was started while the Xcode build was compiling, at 51 % free memory (the brief's 20 % floor held). |
| Bootstrap | `bootstrap-local.ts` with the four release DARs from `daml/released/`, `--lanes crypto --users alice,bob,outsider --seats 4`: 2 min 6 s. `abu-pm-cc-0.1.0` was then uploaded by `POST /v2/dars` (200). |
| Ops | `drive/ops-local.ts` on :8780 (room :8788), `DRY_RUN=0`, `ROLLER_SERIES=BTC-1m,ETH-1m,BTC-5m`, projector on Postgres `pm_c11b`. There is no push-clock in ops-local, so nothing was ever sent to Expo. |
| Web | `next build --webpack` (2 min 31 s; 1 min 20 s and 1 min 1 s on the two rebuilds for this lane's server fixes), then `next start -p 3180`. Throwaway secrets lived in a mode-600 scratch file that was deleted with the scratch area. |

## The drive (iPhone 17 simulator, seat `EGkR…gG5E` → `agari-user-seat-1`)

| Step | Seen | Evidence |
|---|---|---|
| First run | Brand intro, the three pages, then the demo-credits gate: "Free · no cash value · test network", **Accept and take a seat** or **Look around first** | `01-onboarding-1`, `02-onboarding-demo-credits-gate` |
| Take a seat | Accepting made the ed25519 key in the Keychain and leased a party with a signed request. Ops: `funded agari-user-seat-1-muwelc6n with 1000000000 base (lease 8d2bc1fc…)`. The header reads 1,000 | `03-seat-taken-live-prices` |
| Live prices | Spot and ladder over `react-native-sse` from ops :8780: the hero line, "$54 above the UP line", UP 98¢ / DOWN 5¢ ticking | `04-live-prices-1m-window` |
| A 1-minute call | The ticket at the live book, then the held price row with its 20 s ring and the **You + venue** chip, then "Bought 1 UP contracts at 62¢" | `05b-ticket-held-price-ring-and-chip`, `05c-bought-toast` |
| The Call | The receipt carries the stake, what it wins after the fee, the countdown to its own bell, `TX 1220…`, the chip, and Share | `06a`, `06b`, `06c` |
| Settle and verdict | Past the bell the same sheet reads "BTC 1m settled: you lost · Net −0.66", then the settlement receipt (paid out 0.00, settlement tx, Coinbase/Kraken/Bitstamp quorum) | `07-settle-verdict-on-the-call` |
| Portfolio | 999.16 after three calls, "3 settled". After C11b.6: **Your record −0.82 credits, win rate 33 %** (it read +0.82, 67 % before) | `08a`, `08b` |
| Who can see this | §04 on the Window: the literal `active-contracts-page` query per party. **You** sees its own `Leg` (BTC-5m:12, DOWN, 0.87 credits at 14¢, chip "You + venue"). **Outsider**, Alice and Bob get the ledger's empty list | `09a`, `09b`, `09c` |
| Push | See "Push" below | `10a`–`10d` |
| Seat link, phone → web | Phone (holder) "Use on another device": code `5R4H 4G8J` with its QR and a 60 s timer. The web at :3180 joined it, the phone asked "Allow this device? key 75XB…CgUk", Allow, then "Linked". The web then read the same seat: 998.29, 4 settled (after C11b.7) | `11a`, `12a`–`12e` |
| Reset (holder) | The confirm names what is lost. After it: `seat-1` draining, then `holds nothing, cash withdrawn, seat free` 30 s later. The phone is back to "Take a seat" | `13a`, `13b` |
| Seat link, web → phone | The web took `seat-2` (funded, lease `b0356b7a…`) and showed `2FVA S5UX`. `xcrun`/tool `open_url agaricanton://seat/link?code=2FVAS5UX` (the QR's own link) filled the boxes, joining only on the button. The web's Allow made "Joined. This device now uses that seat". The phone then read 1,000.00, the same seat: `agari-user-seat-2` in its account sheet, with no "Use on another device" (holders only) | `14a`–`14f`, `15a` |
| Reset (joined phone) | Only the phone's key left: its `seat_linked_keys` row is gone, and `seat-2` is still leased to the web key (`/api/seat` on web: `leased`) | `15b` |

### The calls on the ledger (seat-1, from the projection `pm_c11b`)

| Window (UTC open) | Side, price, lots | Fill update | Placed | Result | Settle update |
|---|---|---|---|---|---|
| BTC-1m:34 (08:49:00) | Up 540, 1 | `122087fe889ce7aa1fc9dd55dfa401c3f439330120bca76efda715fc27eac50aafb6` | 08:49:21 | lost | `1220e1d9129af5f3c84991565840024d3be8ba1e7750224a6503e100e75f466ed811` |
| BTC-1m:42 (08:57:00) | Up 623, 1 | `1220bff55b06fce9d15cd25d7cb1bf859ba6988b15f3c2c28f682b5ca9819b6e8098` | 08:57:17 | won 1.00 | `1220813823c7fa7e20c6d1e867236f266fc291f37c9e4a7c268d98168fe45d390c09` |
| BTC-1m:53 (09:08:00) | Up 663, 1 | `12204932f8154461db6915db94e20c4092667026f4a787beda05770bf20347390703` | 09:08:15 | lost | `12209da25c6d6cecd98547e276cc5659a87ac64e1ab3bfa8f33b664d610cb3e24ed3` |
| BTC-5m:12 (09:15:00) | Down 856 (144 side), 6 | `12206fc8fee0aa807eb521858d9f5586d516ca6f06b59fef74e83a86cd09c3d6f477` | 09:16:42 | lost | `12207f59f66ee8ecce7068dce39f5474db9ef83004f5f613d65d8ef97bb4db4c5796` |

**Conservation.** The receipts' costs are 542,484 + 625,349 + 665,235 + 871,396 = 2,704,464 base, fees included, and the one payout is 1,000,000. That gives 1,000,000,000 − 2,704,464 + 1,000,000 = **998,295,536**. This is exactly the `spendableBase` that `/api/ledger/me/balance` returned on both devices.

## Push

- **Remote path.** "Turn on notifications" got iOS permission (Allow), then stopped with "This phone could not get a push address" (`10a`). The cause is `expoPushToken()` in `mobile/src/features/alerts/push.ts`: it returns `no-project` because `app.identity.json` has `easProjectId: null`. A real token, and so a real APNs delivery, waits on the EAS project. That project waits on Abu's App Store Connect record (`c11a-ios.md`, "What Abu must do", steps 3–4).
- **The drain's own messages.** A scratch script ran web's real `drainPush` against `pm_c11b`. It registered one device row for the seat with a token that can only be local (`ExponentPushToken[c11b-simulator-local-only]`), and a `fetch` stub answered `https://exp.host/…`, so nothing left the Mac. Report: `devices 1, sent 2, failed 0`. The two messages:
  - **fill:** "Filled on BTC 5m / Your Down call was filled.", priority default;
  - **settle:** "BTC 5m settled: you lost / The Window settled the other way.", priority high.

  Both carry `data {path: "/markets/4UzR…j6aD", kind, itemId}` and `threadId` = the Window. The row was deleted afterwards.
- **On the simulator.** The settle message was put into APNs shape and sent with `xcrun simctl push <udid> xyz.useagari.canton settle-payload.json`:
  - title and body → `aps.alert`;
  - `sound` → `aps.sound`;
  - `threadId` → `aps.thread-id`;
  - `data` → the top-level `body` key, which is where expo-notifications reads a remote notification's data (`NotificationRecords.swift`, `serializedNotificationData`: `userInfo["body"]`; Expo's docs do not state the mapping).

  Results:
  - **App open:** a banner, since the handler banners results and lists fills quietly (`10b`). Tapping it routed to `/markets/<id>`, and the app said the 5m Window had settled and moved to its successor (`10c`).
  - **App in background:** the banner showed on the Home Screen (`10d`).

## What was broken, and is fixed (one commit each)

| Commit | What the simulator showed | Fix | Test |
|---|---|---|---|
| `53135be` C11b.1 | The first call failed with "Not placed · signer-required: a seat write must come from this site with the seat header" (`05x`). React Native's XHR defaults to `withCredentials = true`, so iOS stored the `agari_seat` cookie the lease call set and sent it, with no page Origin, on every write | The phone's fetch wrapper sends `credentials: "omit"` (→ `HTTPShouldHandleCookies = NO`). The phone proves its seat with signed headers only, as designed | (C11b.2) |
| `0d8541b` C11b.2 | The same refusal, server side: the cookie branch refused before reading the write proof | A cookie that may not write defers to the one-request write proof. Without a proof, or with a failing one, it is still refused 403 | `seat-write-auth.test.ts` +3; the first fails on the old code |
| `7bf4a01` C11b.3 | The fill landed in BTC-1m:34 at T+21, after the ticket's no-entry cutoff (lock 50 − 30 = T+20), so the ticket had advanced to :35 while the price was held. The Call counted down to :35's bell and would have read :35's verdict | `usePlacedWindow`: web's `PlacedCall` and the phone's `CallReceipt` describe the order's Window (`booked.marketId`), never the advanced one | `placed-window.test.ts` (3) |
| `87a5103` C11b.4 | With no cookie, the portfolio, receipts and verdict were refused: "indexer 403: a seat reads only its own rows". The indexer client never sent the read header. It had worked only through the accidental cookie | `wallet/<address>/…` index reads carry the registered seat's read header; public reads never do | `index-api.seat.test.ts` (2); fails on the old code |
| `8fa4b12` C11b.5 | At the first settle the app froze, with "Maximum update depth exceeded" about 25 times a second (traced over Hermes CDP to `useWindowActivity`). A settled bet stays in the list through its 20-minute verdict wait, so the Live Activity re-picked the Window it had just ended | Windows whose activity ended this launch are skipped by `pickFollowed` | `activity-model.test.ts` (2) |
| `a20a759` C11b.6 | "Your record +0.82 credits, 67 %" for a seat that had lost 0.83 over three calls with one won. `walletFills` gave the party id as the taker, so the replay took every fill as the venue's opposite side. **The same inversion was on web** | `walletFills` names the asking seat as the taker of its own rows | `read-lease.test.ts` +1 (Postgres, `pm_c11b_it`); fails on the old code |
| `7ba22aa` C11b.7 | The web joined the phone's seat, `/api/seat` said `leased`, yet the web's balance read "—": `/api/ledger/me/*` named the holder's key, and the client refuses an answer about another address | The route answers with `seat.caller` (the holder's key or the joined key) | `me/[view]/route.test.ts` (2); fails on the old code |
| `32af446` C11b.8 | `no-party-from-request` matched `body.party` in that test (a reply) | renamed | invariants 0/0 |

## Side by side (web at 390, phone at 402)

- **Seat link card.** No drift. Web stacks the QR over the code at ≤ 400 px (`seat.css`), the phone does the same at ≤ 400 pt (`NARROW_PT`). So web at 390 stacks (`14a`) and the iPhone 17 at 402 sits side by side (`12a`); a 390-pt phone stacks like web.
- **Held price row, ring, chip, The Call, verdict.** Same structure and words on both (`05b`, `06a`, `07` against web's `PlacedCall` and `CallPlacedCard`).
- **For Abu (subjective, not changed):**
  1. The phone's `SectionHeader` truncates "04 · Who sees what on t…" and its eyebrow on one line, by design (its own comment). Web wraps the title over three lines (`16a` against `09b`).
  2. Web's view-switcher tabs carry count pills ("Alice 0") at 390. The phone's `UnderlineTabs` is the cockpit port, which hides counts at phone width (web's `.cp-page` rule only). On web at 390, though, the fourth tab ("You") runs past the card's edge, while the phone fits all four.

## Decisions

### K-305 — The phone proves its seat with signed headers only; its fetch never stores or sends cookies (C11b)
- **Date / owner:** 2026-10-06 · Claude (C11b).
- **Evidence:** §"What was broken" C11b.1. React Native XHR `withCredentials` defaults to true; `RCTNetworking.mm` sets `HTTPShouldHandleCookies` from it.
- **Rule:** `mobile/src/polyfills.ts` sends every request with `credentials: "omit"`. The phone's seat proof is the read header (reads) and the one-request write proof (writes).
- **User-visible:** calls place from the phone.
- **Approval:** default; overrulable.

### K-306 — A cookie that may not write defers to the write proof (C11b)
- **Date / owner:** 2026-10-06 · Claude (C11b).
- **Evidence:** C11b.2; `seat-write-auth.test.ts`.
- **Rule:** in `seatFromRequest`, a cookie write without our Origin and CSRF header is refused only when no write proof comes with it. With a proof, the proof alone decides. A cross-site page cannot make a proof for someone else's key, so the cookie still guards what it guarded.
- **User-visible:** none on web; any native client works.
- **Approval:** default; overrulable.

### K-307 — The Call describes the order's Window (C11b)
- **Date / owner:** 2026-10-06 · Claude (C11b).
- **Evidence:** C11b.3; the BTC-1m:34 fill at T+21.
- **Rule:** the placed card reads the Window by `booked.marketId` (`usePlacedWindow`). The Window in hand is used only when it is the order's own.
- **User-visible:** a call held across the 1-minute no-entry cutoff shows its own bell and verdict.
- **Approval:** default; overrulable.

### K-308 — A seat's own index rows carry its read header (C11b)
- **Date / owner:** 2026-10-06 · Claude (C11b).
- **Evidence:** C11b.4.
- **Rule:** `indexRows` adds `x-agari-seat-read` to `wallet/…` paths when a seat key is registered, and never to public paths.
- **User-visible:** the phone's portfolio, history and verdicts load.
- **Approval:** default; overrulable.

### K-309 — A seat's fills name the seat as taker (C11b)
- **Date / owner:** 2026-10-06 · Claude (C11b).
- **Evidence:** C11b.6.
- **Rule:** `indexReader.walletFills(wallet)` returns `taker = wallet`, since every row it returns is that seat's own leg. Public tapes keep their published handle.
- **User-visible:** record, win rate and P&L read the seat's own side on web and phone.
- **Approval:** default; overrulable.

### K-310 — `/api/ledger/me/*` answers under the key that asked (C11b)
- **Date / owner:** 2026-10-06 · Claude (C11b).
- **Evidence:** C11b.7.
- **Rule:** the reply's `address` is `seat.caller` (the lease's own key or a key joined to it). Party and offset stay as they were.
- **User-visible:** a device joined by a seat link shows the seat's balance and positions.
- **Approval:** default; overrulable.

### K-311 — The Live Activity never re-follows a Window it ended (C11b)
- **Date / owner:** 2026-10-06 · Claude (C11b).
- **Evidence:** C11b.5.
- **Rule:** ended Windows are kept for the launch and skipped by `pickFollowed`. The next bet, if any, is followed.
- **User-visible:** the app no longer freezes at a settle.
- **Approval:** default; overrulable.

### K-312 — Push is proven on the simulator in the drain's own shape; the remote path waits on the EAS project (C11b)
- **Date / owner:** 2026-10-06 · Claude (C11b).
- **Evidence:** §Push.
- **Rule:**
  - the drain is exercised for real with Expo's endpoint answered locally;
  - a device row for a simulator is local-only and deleted after;
  - the APNs payload puts the message's `data` under `body`, as expo-notifications reads it;
  - nothing is sent to Expo until the EAS project exists.
- **User-visible:** "This phone could not get a push address" until then.
- **Approval:** default; overrulable.

### K-313 — Lane simulators are made per lane and driven by the iOS Simulator tool (C11b)
- **Date / owner:** 2026-10-06 · Claude (C11b).
- **Evidence:** §Setup. Metro started with `--localhost` listened on `[::1]` only, and the dev client asked `127.0.0.1`.
- **Rule:**
  - each lane runs `xcrun simctl create "<lane> iPhone 17"` and deletes it at the end;
  - start Metro without `--localhost` and open the dev client by `agaricanton://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A<port>`;
  - evidence screenshots come from `simctl io`.
- **User-visible:** none.
- **Approval:** default; overrulable.

### K-314 — Side-by-side items that change a shared phone component go to Abu (C11b)
- **Date / owner:** 2026-10-06 · Claude (C11b).
- **Evidence:** §Side by side.
- **Rule:** the section-header truncation and the tab-count pills are listed for Abu, not changed in this lane: each touches a shared component, and web's own 390 view overflows.
- **User-visible:** none yet.
- **Approval:** default; overrulable.

## Found, not fixed here (owner or another lane)

1. **"Guest seat 0".**
   - The link card's allow and linked lines name the seat by `seatNumberOf(party)`. It parses only a bare `seat-N` hint, so the local hints (`agari-user-seat-1-<run>`) and DevNet's (`pm-seat-3`) give null, and both cards print 0 (`12b`, `14d`).
   - `web/src/providers/wallet/seat-lease-context.ts` is owner-only. The fix is one line: `/(?:^|[-_])seat[-_]?(\d+)(?:[-_]|$)/i`. It keeps `seat-a-lk2` null, as its test wants.
2. **Joined device, resting calls.** `leasedAddressOf` (same owner-only file) requires the lease's address to equal the session's, so a joined device sees no resting calls (`RestingRows`, schedule ticket). It should accept a joined key.
3. **Stale balance after the holder resets.** The joined web kept showing 998.29 and "NO PARTY" after `/api/seat` turned `none` and `/me/balance` turned 401. A reading keeps its last good value on error.
4. **Record against balance.** The record (−0.82, then −1.69) leaves out the fees: the balance moved −0.833068 and −1.704464. The replay settles rounds with `feeBps: 0`.
5. **The verdict.** "No entry cost on record for this seat — showing the payout" (`07`). `useVerdict` takes the cost basis from the open positions, which no longer hold a settled Window. The settlement receipt carries the cost.
6. **"Vault credit — withdrawal · 998.29 credits sits in your Trading Balance".** Under To collect, the agents vault on Canton reports the seat's own cash as `availableBase` (`packages/markets/src/server/agents.ts`). The plate meanwhile says Trading Balance 0.00.
7. **The network label.** On localnet The Call reads "CANTON DEVNET" and web's welcome says "This is Canton DevNet".

## Gates

| Gate | Result |
|---|---|
| `pnpm typecheck` | green (all projects) |
| `pnpm invariants` | 0 errors, 0 warnings |
| `pnpm test` | 330 files and 2,542 tests passed; 13 files and 62 tests skipped (Postgres) |
| Postgres | `read-lease.test.ts` 9/9 and `resting.test.ts` 9/9 on `pm_c11b_it` |
| `pnpm --filter @agari/mobile typecheck` | green |
| `expo export --platform ios` (`EXPO_OFFLINE=1`) | green: 5,573 modules, 24 MB, 26 s |
| Simulator drive | above |

## Cleanup

- **Stopped by pid:** Metro, web, ops and the sandbox.
- **Dropped:** `pm_c11b` and `pm_c11b_it`.
- **Deleted:** the `pm-c11b iPhone 17` simulator, DerivedData (4.3 GB), the export and every scratch file.
- **Removed:** `mobile/ios` (gitignored).
