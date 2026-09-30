# D1 design review of the surfaces the Canton port added or changed, 2026-09-30

Lane D1, branch `slice/D1-design-review` (from main 44b3798). Web and phone, checked at 320, 390, 768 and 1440 in both themes. Only surfaces the port added or changed are in scope (D-036, D-081): the reference at `agari-wt/mobile-takeover` (661a24ee, the import at tag `hackcanton-s3-start`) is the design authority, so lines byte-identical to it were skipped, and every fix below is on a line or a component the port wrote. Where a defect lives in a reference primitive (`Money`, `BlockedButton`, the desk kit's `StatusDot`, `--color-ink-muted`) the primitive is left as it is and the port's use of it is fixed, or the defect is listed for the owner.

## What was reviewed

316 UI files (`git diff --name-status hackcanton-s3-start..HEAD -- web/src mobile/src`, `.tsx` and `.css`, deleted files excluded: 66 added, 250 modified). The surfaces the lane named, and where each was looked at:

| Surface | Files | Seen as |
|---|---|---|
| Who-can-see chip, view switcher, code block | `web/src/features/canton-ux/privacy/*`, `web/src/components/ui/code-block.*`, phone `features/privacy/*` | `/dev/canton-privacy`; live `/markets/<id>` needs an index, so code and states read |
| Resolution timeline, trust boundary | `canton-ux/proof/*`, `features/proof/*` | `/dev/proof-canton`, `/dev/proof` |
| Seat account menu, pool plates, seat link, OTP input, QR, lease dialog, seat modal | `canton-ux/seat/*`, `components/ui/otp-input.*`, `providers/wallet/*`, `app/seat/link`, `components/shell/header/HeaderAccount.tsx` | `/dev/seat`, `/seat/link`, the "Take a seat" modal (390 and 1440) |
| Write progress, quote ring, held price, receipt | `canton-ux/ticket/*`, `features/markets/ticket/*`, `portfolio/CashOut.tsx`, phone `markets/ticket/CantonWrite.tsx` | `/dev/ticket-canton` (three directions, six states each), `/dev/states` |
| Resting call (ticket, receipt, rows) | `ScheduleTicket`, `ScheduledCall`, `RestingRows`, `PlacedCall` | `/dev/states` "Pre-open calls", `docs/evidence/ux/c7c/*` (real run) |
| Maker vault tab, desk live figures, creator fee claim | `features/earn/*`, `features/desk/cockpit/*`, `features/strategies/LiveDesk.tsx` | `/earn` (loading state; the diff is copy only), `/dev/desk` "live", code |
| Landing "Built on" band, `/status` seat-pool row, `/legal`, `/stats` audit view | `features/landing/*`, `features/status/*`, `features/legal/*`, `features/stats/AuditSection.tsx` | `/`, `/status`, `/legal`, `/dev/stats` (band populated by injection at 390, 768 and 1440) |
| Phone ports | `mobile/src/**` added or changed | Static review only (a read-only subagent plus my own reading); no simulator run |

## Method

- `21st review <paths> --json` on the 316 files, before and after. The CLI's rules are local and deterministic (hard-coded colour, autofocus, `transition-all`, `outline-none`, fixed width, hover scale). `--context` is accepted and changes nothing in its output, so no design context was needed; no `.21st/` or other tool file was created in the repo. `--fix` was not run: no finding is `autofix: true`.
- Because the CLI has no rule for most of what matters here, each page was also driven in headless Chrome (`playwright-core`, scripts in the lane's scratch dir, not committed) against `next dev` on :3491 (my own PID, stopped afterwards): page and container overflow, tap targets, accessible names, `alt`, keyboard tab order with a focus-indicator check per stop, text contrast per element in both themes, clipped text, infinite animations under `prefers-reduced-motion`, landmarks and heading levels, and a touch/mouse/keyboard test of the chip. States that need data (the desk, the ticket after a write, the seat plates) were read from the `/dev/*` fixture pages.
- Line attribution: every CLI finding was mapped to `git diff -U0` to separate lines the port wrote from reference lines.

## `21st review` counts (316 files)

| | errors | warnings | suggestions |
|---|---|---|---|
| Before (44b3798) | 0 | 5 | 157 |
| After (HEAD) | 0 | 5 | 157 |

Unchanged, on purpose: the CLI found nothing the fixes below address. Triage of its 162 findings:

- 139 are on reference lines (icons, ticket, stats, funding, ledger-plate, cockpit CSS): not in scope.
- 23 are on port lines, and none is a defect:
  - 15 are `design-hardcoded-color` false positives: a 21st component id in a comment or doc block (`#29246`, `#23586`, `#23543`, ...) reads as a hex colour (`canton-ux/seat/seat.css:3,31`, `SeatLinkCard.tsx:118,122`, `code-block.{tsx,css}`, `otp-input.{tsx,css}`, `WhoCanSee.tsx`, `ViewSwitcher.tsx`, `ResolutionTimeline.tsx`, `WriteProgress.tsx`, three phone files).
  - 4 are `a11y-autofocus` on `web/src/components/ui/otp-input.tsx:43,62,83,84`: the component's opt-in `autoFocus` prop; no caller sets it (`SeatLinkCard` passes `focusOnError` only).
  - 2 are `web/src/styles/icons.css:37,38` (`--brand-bitcoin`, `--brand-ethereum`): brand-disc variables, the same pattern as the 30 sibling lines.
  - 2 are `ledger-plate.css:27,32` (`rgba(224, 77, 38, 0.65)`): the third segment between the reference's own `#E04D26` and `rgba(224, 77, 38, 0.35)`. The vermilion token differs in the light theme (`#D93E1F`), so tokenising this one line would break the bar's ramp there. Left on purpose.

`design-literals` and `mobile-design-literals` stay green (`pnpm invariants`: 0 errors, 0 warnings).

## Fixes, by commit

Each was checked in the browser (or typechecked, for the phone) after the change. Before and after specimens at 390 dark: `docs/evidence/ux/d1/` (the "before" side re-applies the old rule to the current page, so the two sides are the same data).

| Commit | Defect (evidence) | Fix, file:line |
|---|---|---|
| D1.1 seat | The seat menu measured 210px, not the 280px its rule asks for: `.header-account-menu { min-width: 210px }` (shell.css) beat `.cx-seat-menu` on order, so "Party id", "Demo cash" and the party hash wrapped at 390 (`d1-seat-menu-390-dark.png`) | `canton-ux/seat/seat.css:9` two-class selector |
| D1.1 | The party copy button shrank to 21px wide (under the 24px target floor) | `seat.css:14` `flex: none` |
| D1.1 | The "Not allowed" plate used the success wash (profit green) (`d1-seat-refused-390-dark.png`) | `SeatLinkCard.tsx:179` `data-tone="declined"`, `seat.css:66` warning treatment as the ticket's expired note |
| D1.1 | The "Allow this device?" `alertdialog` had no accessible name or description | `SeatLinkCard.tsx:135` `aria-labelledby`/`aria-describedby` on the title and body |
| D1.1 | While joining, the button label is a 47-character sentence, `white-space: nowrap`: the button grew to 364px inside a 281px card at 390 (`d1-seat-join-busy-390-dark.png`) | `SeatLinkCard.tsx:112` class, `seat.css:78` wraps, keeps the primary height when one line |
| D1.1 | If the holder's first code did not issue, the page showed the join-only card and a muted error, with nothing to press | `SeatLinkPanel.tsx:100-108` "Show a new code", `seat.css:84` |
| D1.1 | Warning hue as text is 1.96:1 on the light theme | new token `styles/tokens.css:108,125` `--color-warning-ink` (5.55:1); `seat.css:29,62` |
| D1.2 privacy | "Who can see this" opens on hover and focus only: a tap on a phone or tablet showed nothing (tested: tap left 0 tooltips) | `canton-ux/privacy/WhoCanSee.tsx:27-52` controlled state; a touch tap toggles, a touch elsewhere closes; mouse and keyboard unchanged (hover, leave, click, Escape, focus, tap, second tap, outside tap all checked) |
| D1.2 | A shortened contract id wrapped after its ellipsis ("00a1c3…" / "3c1a") at 390 | `privacy/privacy.css:42` |
| D1.3 legal | `/legal`'s notice had an h2 at body size, no paragraph spacing, and credit links the colour of their text (`d1-legal-390-dark.png`) | new `features/legal/legal.css`, `LegalScreen.tsx:2,14-19,30` (tokens only, focus ring) |
| D1.4 contrast | Trust-boundary dot and icon, and the "unknown" write status and step number, were warning-hue text on paper (about 2:1) | `canton-ux/proof/proof-canton.css:8,9`, `ticket/ticket-canton.css:21,22` on `--color-warning-ink` |
| D1.5 funding | `.fund-facts` restated `12px` for `--radius-lg` | `features/funding/funding.css:134` |
| D1.6 events | The event board said "reading the board…" for ever when the lane read failed, while the word board above it says why (web and phone) | `features/markets/events/EventBoard.tsx:12,22,23`, `MarketsScreen.tsx:89`; phone `events/EventBoard.tsx:12-14`, `MarketsScreen.tsx:93` |
| D1.7 phone seat | Web's `@media (max-width: 400px)` stack (QR over code) had no phone counterpart: the code row needs about 176pt beside a 136pt QR | `mobile/src/features/seat-link/SeatLinkCard.tsx:19,86,116,128,244-253` |
| D1.7 | Joining: the kit Button holds one line, so the waiting sentence was an ellipsis; announced results and prompt (`accessibilityLiveRegion` is Android-only); copy control 44pt; clipboard write no longer throws | `SeatLinkCard.tsx:54,172,202-205,225` |
| D1.7 | The QR's label was not exposed on iOS | `seat-link/SeatQr.tsx:28` `accessible` |
| D1.7 | A failed first code had no retry (phone) | `mobile/src/app/seat/link.tsx:4,116` |
| D1.8 phone | 28pt chip and 34pt copy control under the 44pt floor; quote ring label not exposed; the seat credit refusal was never drawn (the reference drew its failure there); X sign-in looked unchanged while busy | `privacy/WhoCanSee.tsx:30`, `privacy/ViewSwitcher.tsx:135,139`, `markets/ticket/CantonWrite.tsx:27`, `app/funds.tsx:6,11,107-113`, `x/LinkStep.tsx:47-50`, `recovery/ClaimFlow.tsx:73`, `recovery/ClaimParts.tsx:55` |
| D1.9 pre-open | A blocker on the scheduled call's CTA is a sentence; the one-line button's label measured 406-593px in a 324px CTA and spilled out (`d1-preopen-blocked-390-dark.png`) | `features/markets/ticket/ScheduleTicket.tsx:110-111` wraps and grows; unblocked it is the same 52px CTA |
| D1.10 stats | The auditor recount's "Differs at ledger offset …" and each differing line read in the footnote gray (2.61:1), like the lines that agree (`d1-stats-recount-390-dark.png`) | `features/stats/AuditSection.tsx:17,24,28,29`, `styles/stats.css:165,166`: verdict 8.08:1, differences in the loss ink 7.57:1 |
| D1.11 phone | Each completed write step stayed a VoiceOver button and no step was read; "Retract" (nested Text) was not its own element | `CantonWrite.tsx:78-89` (steps hidden, one status line naming the step, announced), `portfolio/bets/PublishCall.tsx:29` role `link` |
| D1.12 CTA | "credits" on the Buy and Schedule buttons was gray on green, 1.31:1: the word that says these are demo credits was near-invisible (`d1-cta-credits-390-dark.png`) | `features/markets/ticket/on-fill.ts:1-6`, used at `TicketCta.tsx:9,30`, `ScheduleTicket.tsx:13,114`, `canton-ux/ticket/Directions.tsx:7,49`: 5.09:1 |
| D1.13 seat link page | Two `<main>` landmarks (the shell's and the page's) and no h1 | `app/seat/link/page.tsx:12-15`, `SeatLinkCard.tsx:47,157-172`, `SeatLinkPanel.tsx:97` `headingLevel={1}` |
| D1.14 OTP | Eight code cells need 283px; a 320 screen leaves the card 250px, so the last cells ran 14px out of it (from 353 down) | `seat.css:87-92` (26px cells under 353px) |
| D1.14 | `/dev/states` frames were grid items with `min-width: auto`: one nowrap sentence widened the grid to 499-612px on a 390 screen and clipped every specimen | `app/dev/states/_sections/Fixture.tsx:13` `min-w-0` |
| D1.15 phone | "Lease a party" tile stayed pressable while leasing | `mobile/src/app/account.tsx:81,115-127` |
| D1.16 phone | The signed share-link check had no timeout: a hung request left `/markets/<id>` blank | `mobile/src/app/(tabs)/markets/[id].tsx` 8 s abort |

Measured, before and after (390 unless noted):

| Check | Before | After |
|---|---|---|
| Seat menu width | 210px | 280px |
| Party copy button | 21 x 24 | 24 x 24 |
| Join button label vs its card | 364px in a 281px card | 283px in a 283px card, two lines |
| Chip tooltip on a touch tap | opens: no | opens, toggles, closes on an outside tap |
| Pre-open blocker labels vs the 324px CTA | scroll widths 406, 560, 593 | wrapped, no overflow |
| OTP cells at 320 | 14px past the card | inside |
| Contrast: warning text on paper / CTA unit / recount verdict | 1.96 / 1.31 / 2.61 | 5.55 / 5.09 / 8.08 |
| `/seat/link` landmarks / h1 | 2 / 0 | 1 / 1 |
| Page overflow at 390, 768, 1440 on 18 routes and 4 canton fixtures; at 320 on 9 of them | 0 | 0 |
| Unnamed controls, images without alt, tab stops without a focus indicator (canton fixtures) | 0 | 0 |
| Infinite animations under `prefers-reduced-motion` (5 routes) | 0 | 0 |

## Reviewed, no defect found

Code block (labelled focusable scroll region, copy state announced); OTP input semantics (group, per-cell names, `aria-invalid`, status region, reduced-motion paths); quote ring and write progress on web (steps `inert`, one `role="status"` line); resolution timeline; trust boundary; pool-full and draining plates; the seat lease dialog; the landing "Built on" band (populated and empty, 390, 768, 1440); `/status` seat-pool row; the seat modal at 390 and 1440. Add funds and `/native-auth` were read in code and diff only (Add funds needs a seat; `/native-auth` was rendered in its no-session state). The port's CSS uses the tokens throughout; the only raw colours on port lines are the two listed above.

## Recommendations for the owner (not applied)

Subjective, or a decision that changes how something looks or works. D1 changed nothing in this section. Lane D2 (2026-09-30, branch `slice/D2-port-ux`) then resolved the items marked **D2** below, on the surfaces the port built; the reference's own surfaces and token values were not touched (see "Resolved by D2" at the end for commits, what was checked and how, and what is left).

**In the port's own surfaces**
1. **D2.2, resolved (web; the phone already drew the neutral plate).** "Allow this device?" (the seat link's confirm step) uses the success wash and a shield. A security question in green reads as already-approved; consider the accent or a neutral plate.
2. **D2.3, resolved (web and phone).** `FastChip` ("one tap"): a chip drawn as pressed that cannot be pressed, with its explanation in a `title` that a touch screen never shows. Consider dropping it or making it a plain note.
3. **D2.1, resolved (web and phone).** Add funds' "Request demo credits" button still carries the tUSDC coin mark.
4. Landing "Built on": when a source's name wraps ("Coinbase, Kraken, Bitstamp" at 1440) its figures fall out of line with the other columns.
5. `/seat/link` (web and phone) shows the join-only card for a moment before the lease and the first code arrive; a loading state needs copy.
6. **D2.5, resolved.** `partyLead(party)` (`indexOf("::") + 6`) is written five times (`ResolutionTimeline`, `SeatAccountMenu`, `ViewSwitcher`, `AccountModal`, `AddFunds`); one helper would keep the shortened id consistent.
7. `.cx-panel` in `proof-canton.css` restates the desk kit's `.dk-panel` value for value (documented there); hoisting it into the kit sheet would remove the copy.
8. Comments cite 21st components as `#29246`; the CLI reads those as hex colours (15 false positives). A `21st:29246` form would keep its signal clean.
9. `OtpInput`'s `autoFocus` prop has no caller; removing it clears the CLI's 4 warnings.
10. `/native-auth`'s consent step uses `text-lg font-semibold` and `text-muted-foreground` where the rest of the app uses `type-*`.
11. **D2.4, resolved (web and phone).** Party and update ids are shortened with a `title` for the full value; a touch screen cannot read it. A tap-to-copy or a popover would give phones the whole id.

**Inherited from the reference (shared primitives; changing them changes reference surfaces)**
12. `--color-ink-muted` is 4.3:1 on dark and 4.0:1 on light, `--color-ink-disabled` about 2.6:1, and `.stats-note` gray-600 2.6:1; every small muted label on the port's surfaces (the `cx-muted` and `cx-label` text, meta lines, the timeline's ids) sits under AA (4.30 on the ground, 3.78 on a card).
13. On the light theme `--color-warning` as text is 1.96:1 (the kit's `StatusDot` warn tone, "Demo setup"), the danger link "Reset seat" 2.94:1, and the UP/DOWN CTA ink (`cream-ink` on `#2E6B4F` / `#C2381F`) 2.97:1 and 3.45:1.
14. Input boundaries (`--input-border` = hairline, the OTP's empty cells) are about 1.1-1.9:1, under WCAG 1.4.11's 3:1.
15. `Button` is one line, `nowrap`, at a fixed height, so any long label overflows; `BlockedButton` carries it to every blocker. Only the pre-open CTA was changed here (D1.9).
16. `header-account-menu` is `role="menu"` with non-menuitem children and no arrow-key focus; `SeatAccountMenu` inherits it.
17. `/status`, `/proof`, `/markets` and `/portfolio` have no h1 (their `SectionHeader` is an h2).
18. `.desk-link-btn` (the creator fee "Claim to your seat") is about 22px tall and `.desk-fine` is 9px, under the 24px target and small for text.

**Phone, found by static review and not changed (needs a device pass or a decision)**
19. **D2.7, resolved (static).** `seat/link.tsx` has no keyboard avoidance: the join boxes, the result note and the button are the last things in a tall card.
20. **D2.6, pool-full half resolved (static); the draining plate after a reset is left.** `connect.tsx` and `SeatProvider.tsx`: with the pool full, `takeSeat()` resolves without throwing, the sheet fires the success haptic and closes; the phone has no queue plate, and after a reset no draining plate (web has `SeatLeaseDialog`).
21. **D2.10, resolved (static; needs the VoiceOver pass below), including the four-and-four grouping and focus-on-error.** `LinkCodeInput`: the only labelled control is a hidden 1pt, alpha-0 `TextInput` and the visible row is `accessible={false}`; check with VoiceOver. It also lacks web's four-and-four grouping and focus-on-error.
22. **D2.8, the hero half resolved (static); `EventCard`'s duplicated style entries are now shared with the hero for the bar and the chip, its header row still has no `flexShrink`.** `events/EventHero` drops web's "Trading ends in" label, the urgent tone, the odds bar and the step list (one 12pt paragraph); `EventCard` copies twelve style entries from `WordCard`, and its header row has no `flexShrink`.
23. **D2.9, wrap and 44pt target resolved (static); the 9pt claim result is left.** `LiveDesk` `CreatorFees` (phone): two `flex: 1` cells are about 95-130pt wide, so the uppercase claim pill and the 24pt amount wrap to 2-3 lines; the pill is about 34pt tall for a money action; the claim result is 9pt. Stacking the cells at narrow widths would fix it.
24. **D2.9, resolved (static), by layout rather than by shortening the copy.** `TakeSeat`: "Have a seat on the web? Link this phone" is a one-line kit Button label of about 330pt against about 310pt; shortening the copy is the copy lane's call.
25. `CopyFormFields` calls `router.push("/funds")` while `CopyDrawer` is a native `Modal`; the route may present beneath it.
26. `ClaimFlow` draws the X sign-in error under step 2, which is dimmed until step 1 is proven.
27. `OnboardingScreen` fires the success haptic before `takeSeat()` resolves.
28. `PublishCall` (phone) publish target is about 30pt and it hand-rolls a 12/18 caption where the row has `TextAction` and `RowNote`; `WhoCanSee` tips can be open on several chips at once and sit in flow inside a horizontal row.
29. `account.tsx` and `FundingFacts` lack web's copy-party-id, lease timer, "Canton party" row and region hold.

## Gates

`pnpm typecheck` (all workspaces, including `mobile`): exit 0. `pnpm --filter @agari/mobile typecheck`: exit 0. `pnpm invariants`: 0 errors, 0 warnings. `pnpm test`: 309 files passed, 13 skipped; 2391 tests passed, 61 skipped, no failures (the known load timeouts in `api/venue/routes.test.ts` and `reply-card.test.ts` did not occur). No `next build` and no sandbox run.

## Resolved by D2 (2026-09-30)

Lane D2, branch `slice/D2-port-ux` (from main 8713ee1). Only surfaces the port built or changed; nothing on a reference surface and no reference token value changed (`web/src/styles/ticket.css` is byte-identical to the reference again, the port's `data-on` rule having gone with the chip).

| Commit | Item | What changed | Test |
|---|---|---|---|
| `ab01834` D2.1 | Add funds coin (rec. 3) | The tUSDC disc is off the "Get demo credits" pill on web (`AddFunds.tsx`, the dead `.fund-cta-mark` rule) and phone (`app/funds.tsx`): credits are said in words, as the CTA unit and the seat menu do | none (no logic) |
| `0b4ec94` D2.2 | Allow-this-device plate (rec. 1) | `data-tone="ask"` on the confirm plate: the balance plate's inset surface and a hairline, the shield on the accent wash (`seat.css`); green stays for "Linked", warning for "Not allowed". The phone's `Decide` already used the accent wash. Checked at 390 in both themes | markup test pins the three plates apart |
| `3777457` D2.3 | `FastChip` (rec. 2) | A static label: the desk kit's quiet `StatusDot`, the same pill the reference draws for "Always open", on web and phone; no button, no pressed styling, no `title` | markup test |
| `69318bc` D2.5 | `partyLead` (rec. 6) | One `partyLead` in `@agari/core/units` (with the floor of eight the proof formatter had); 7 web sites and 2 phone sites import it, and the phone shortens through `shortHex` as `Hash` does | 4 cases |
| `f657a13`, `067bcc1` D2.4 | Ids on touch (rec. 11) | New `TapHash` (web `components/data`, phone `components/ui`): the short form and dotted underline of `Hash`; a tap shows the whole id in place with a 24px (web) or 44pt (phone) Copy beside it, a second tap folds it, a mouse still gets the title. Used for party and update ids on the timeline, receipt signatories, oracle prints "signed by", the ledger update plate, the write receipt, the view switcher, the account modal and Add funds; on the phone the view switcher and the seat sheet. Left as `Hash`: the receipt's update link (it goes to the update), payload and contract ids, code-block ids (Copy copies the literal text) and the seat menu's party (it has a Copy button) | closed, open and never-cut states |
| `d490988` D2.6 | Pool full on the phone (rec. 20, first half) | `takeSeat()` resolves with the lease view; a full pool turns the Take a seat sheet into web's pool-full plate (kit empty-state anatomy, the ring around a seat, "This page will take the next free seat for you", clock, warn `StatusDot` with the place in line) and "Keep waiting". Haptic: the selection tick (no seat yet, nothing failed); success and close when the app's retries lease a seat; no party and no queue reads as the network not taking seats, with the error haptic | `takeOutcomeOf`, `poolFullOf` (web's lease dialog now uses the same) |
| `ba3f6a0` D2.7 | Keyboard on `/seat/link` (rec. 19) | The chat sheets' `KeyboardAvoidingView` (padding on iOS) around the page's own scroll view, and scroll-to-end on each resize while the code entry holds the keyboard | none (layout) |
| `657a8e1` D2.8 | `EventHero` (rec. 22) | Rebuilt in the price hero's frame (`HeroPanel`, `HeadShell`, `AssetRow`, `Settles`): "Trading ends in" label with the urgent tone, Committee chip, when the committee answers, odds bar with when trading ends and the implied share, the locked note, the numbered "How it settles" steps | `eventClockOf` (shared with web's hero): no reading, calm, last minute, lock, short event |
| `c1ff4a8` D2.9 | Claim pill, `TakeSeat` (rec. 23, 24) | Fee cells stack under 600pt (238pt wide at 320, 308pt at 390, against a pill of about 190pt) and the pill is held to 44pt. "Have a seat on the web?" is a caption over a "Link this phone" button (the kit `Button` holds one line: the sentence was about 330pt against 310 at 390 and 240 at 320) | none (layout) |
| `861bd66` D2.10 | Code input (rec. 21) | One full-size transparent text field over the boxes (not a 1pt alpha-0 one) with label, hint and the code spelled out as its value; the boxes are hidden from VoiceOver and ignore touches; four-and-four grouping and focus-on-error as on web | `spokenCode` |

Checked in headless Chrome (touch, 390, both themes where noted, `next dev` on my own port and PID, stopped afterwards): the confirm plate; on the resolution timeline, the view switcher and the write receipt, a tap opens the whole id, Copy puts the whole id on the clipboard, a second tap folds it, no page overflow. This also found and fixed a real defect in the first version of D2.4 (the hit area of a wrapped id covered Copy). The phone changes are static: `pnpm --filter @agari/mobile typecheck` only, no simulator or device run.

**VoiceOver pass to confirm D2.10 (needs a device):** on `/seat/link` (from "Have a seat on the web? Link this phone" or a QR), swipe to the code field. Expected: one stop reading "Seat link code, text field", the hint ("Eight letters and numbers, from the other screen. That device then allows this one."), and the value "none of 8 characters entered". The eight boxes are not separate stops. Type `K7M`: the keyboard echoes each character; re-focusing the field reads "K 7 M, 5 more to enter". With eight characters the message ("Joining…" then the result) is announced and, on a refusal, the caret returns to the field. Also confirm on a device that the transparent field takes a long-press Paste and iOS autofill of a one-time code, and that a tap on any box focuses it.

**Left for a device or another lane:**
- Not device-checked: D2.6 (plate, ring, haptics), D2.7 (whether `onLayout` scroll-to-end lands the boxes above the keyboard on every iPhone size), D2.8, D2.9 (layout arithmetic above, no render), D2.10.
- The header money pill and the phone header pill (reference) and the phone onboarding visual (port) still draw the tUSDC coin; the pill is a reference surface, the onboarding visual was not on the lane's list.
- The draining plate after a reset (rec. 20's second half) has no phone home yet: it needs a host outside the account sheet, which closes on reset. Onboarding's `takeSeat()` (rec. 27) does not show the pool-full plate either; it still fires its success haptic before the answer.
- Contract ids (web view switcher, phone rows) are still hover-only or shortened text; `TapHash` fits them once the row's `nowrap` is relaxed.
- Recommendations 4, 5, 7, 8, 9, 10 and 12 to 18, 25 to 29 are untouched (subjective, copy-lane, reference-owned or needing a device).

Gates after D2: `pnpm typecheck` (all workspaces, including `mobile`): exit 0. `pnpm --filter @agari/mobile typecheck`: exit 0. `pnpm invariants`: 0 errors, 0 warnings. `pnpm test`: 325 files passed, 13 skipped; 2524 tests passed, 61 skipped, no failures (the known `reply-card.test.ts` load timeouts did not occur). No `next build`, no sandbox; no `.21st/` or other tool file created (a 21st search for an inline copyable id found only block-level snippets, so `TapHash` is composed from the seat link's own copy-then-check pattern).
