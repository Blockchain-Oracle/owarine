# Demo script (90 seconds)

This follows the plan's "Demo, 90 seconds", changed to match what the evidence notes prove. Record it against the snapshot tag (`snap-N`).

## Changes from the plan's version

| Plan step | Change | Why |
|---|---|---|
| "first on the web and then on the phone" | Web only. Add the phone shot only if the iOS build places a call on Canton before recording | No evidence note shows the iOS app on Canton yet. The web at 390 px is shown (`docs/evidence/ux/c4b/04-ticket-armed-phone-390-dark.png`) |
| "Alice takes 100 Up at 62" | 100 Up at the live quote, whatever it is | C7a bought 100 Up at 513 ticks (51.3¢); prices move |
| "a push arrives on the phone" | Cut unless proven before recording | No evidence note for push on Canton |
| "A second market voids on disagreement and refunds cost plus fee" | A committee event with answers YES, NO, YES voids and refunds what was paid | Proven for events (`docs/evidence/c6d-gap-events.md`). For price windows, void on deviation is proven in Daml tests only |

## Script

| Time | On screen | Voice-over (plain, short) | Evidence |
|---|---|---|---|
| 0:00–0:10 | The markets board, a BTC 1-minute window counting down | "On public prediction markets, your position is public within a block. Traders get tracked and copied. This is a private event desk on Canton." | — |
| 0:10–0:25 | Take a seat → Guest seat → 1,000 demo credits. Buy 100 Up. The steps read Price → Sent → Placed, and the receipt names the ledger update | "No wallet to install. The venue quotes a firm price and I accept it as my own Canton party." | `ux/c4b/02-*`, `05-*`, `06-*`; `c7a-exit-2026-09-29.md` |
| 0:25–0:42 | "Who can see this" → Alice, Bob, then Outsider: "The ledger returned nothing for this party", with the query below | "Here is the same ledger query run as other parties. Bob sees his own position, not mine. The outsider gets nothing back. That is not a filter: the ledger never sent it." | `ux/c4b/08-view-*` |
| 0:42–0:55 | "Sell half" → a held bid with a ring → Sold. The position halves | "I changed my mind. The venue quotes a firm bid, and I sell half back in about a second." | `c7a-exit-2026-09-29.md` (0.91–1.61 s) |
| 0:55–1:15 | The window closes. `/proof/<market>`: three prints, the resolution, the settle update. Credits rise | "Three oracle parties post the exchange closes. A separate resolver resolves, and the venue settles every leg in one batch. I didn't sign anything to get paid." | `c3-gate-2026-09-29.md`; `ux/c4b/10-proof-*` |
| 1:15–1:28 | A committee event receipt: YES, NO, YES → void, "SourceDisagreement", refunded in full | "When the attestors disagree, the market voids and everyone gets back what they paid." | `c6d-gap-events.md` |
| 1:28–1:30 | The repo URL and the demo URL | "Positions private, resolution you can check, all on Daml." | — |

## Say it honestly (keep in the longer video, not the 90 s cut)

- The three price feeders are ours: separate parties, and every print can be re-derived from the public candle.
- On the shared participant our code, not the ledger, decides which party a seat acts as.
- Demo credits only. No real money.

## Before recording

1. Place the call on a window that closes during the take, so 0:55 is live, not waited for.
2. Run the void event beforehand, and show its receipt. `scripts/drive/committee-event.ts create --id … --minutes 5`, then `attest --id … --answers yes,no,yes`. It runs only against an unauthenticated local sandbox. On Noders DevNet the attestations need another path, which is not built yet.
3. Check the top banner. The C4b screenshots still show "Solana devnet — test funds only". C4c changed the copy, so confirm the banner now says Canton before recording.
