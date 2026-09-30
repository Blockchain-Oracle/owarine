# Usability test script (3 sessions, about 15 minutes each)

For Abu, planned for Mon 5 – Tue 6 Oct. Run it on the hosted URL (M1) in a browser, and on the phone. The iOS build goes to the internal TestFlight group, whose testers must be App Store Connect users until the public link opens. If the hosted URL is not up, run on a local stack and say so in the notes.

**Rule:** say nothing that helps them. If they are stuck for 30 seconds, note it and give the smallest hint. Time each task from the moment you finish reading it.

## Setup

- A fresh browser profile (private window) with no seat.
- The phone with the build installed but never opened.
- Notes open, with the table at the bottom.

## Opening line

> "This is a test of the product, not of you. Please think aloud: say what you expect, what you look for, and what confuses you. There are no wrong answers."

## Tasks

| # | Task (read aloud) | Success means | What we watch |
|---|---|---|---|
| 1 | "You have one minute. Place a call that BTC goes up in the next minute." | A call confirmed with a receipt, within 60 s | Do they find "Take a seat"? Do they understand demo credits? Where do they hesitate? |
| 2 | "Who else can see the call you just placed?" | They open "Who can see this" and read the Outsider view as empty | Do they believe it? Ask: "What would convince you?" |
| 3 | "You changed your mind. Get half your money out before the close." | "Sell half" completes and the position halves | Do they understand the bid is lower than what they paid? |
| 4 | "The window has closed. Did you win, and where is your money?" | They find the result and the credits, and notice they did not sign anything | Do they look for a "claim" button that does not exist? |
| 5 (phone) | "Do the same call on the phone." | A call confirmed on the phone | Differences from the web that confuse them |

## After the tasks (3 min)

1. "In one sentence, what is this?"
2. "Who would use it?"
3. "What almost made you give up?"
4. "From 1 to 5, how much do you trust that no one else can see your position? Why?"

## Record, one row per session

| Date | Tester role | Device | T1 time (s) | T1 done? | T2 read Outsider as empty? | T3 done? | T4 found result? | Trust /5 | Biggest problem (their words) |
|---|---|---|---|---|---|---|---|---|---|
| | | | | | | | | | |

The leading indicator in `metrics.md` is T1 time under 60 s without help. File each confusion as an issue with the tester's words, not with our fix.
