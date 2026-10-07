# Product brief

**Owarine on Canton** is a private event-risk desk. The name is a working one (K-007). It is entered in HackCanton Season 3, Track 2 (Financial Applications).

## One sentence

We help traders whose size or thesis is their edge take and exit short-dated event risk on Canton. Their positions stay between them and the venue, and anyone at the table can re-derive how a market resolved.

## The problem

On a public-chain prediction market, every position is public the moment it is placed.
- Whale trackers alert on trades of $10,000 or more ([Polywhaler](https://polywhaler.com/)).
- Copy-trading services rank wallets by verified P&L and sell the follow ([Polycopy](https://polycopy.app/best-polymarket-traders)).
- A 2026 study of 193 leaderboard wallets found traders using copy-bait patterns to turn followers into exit liquidity ([CopyGrade](https://copygrade.com/blog/we-scored-the-polymarket-leaderboard)).

So a trader with an edge pays a tax just for using the venue, and serious size stays away. A lit order book has the same problem in a milder form, because a resting order is public intent.

## Who it is for

- **User:** a trader at a crypto fund, prop desk or market maker who expresses or hedges short-horizon BTC/ETH risk and event outcomes. For this user, being seen is the cost. See `icp.md`.
- **Buyer (production):** a licensed dealer or venue that wants to offer event contracts to institutional clients on Canton. The design makes the venue the counterparty, which is the dealer's role.

## What it does (evidence on a local Canton sandbox)

| Step | Evidence |
|---|---|
| A visitor takes a guest seat (a Canton party) funded with demo credits. No wallet install | `docs/evidence/c8e-tickets-ux.md` |
| The venue quotes a firm price, and the seat accepts it as its own party | `docs/evidence/c3-gate-2026-09-29.md` (160 trades, 0 failed) |
| The seat sells half back before the close, in 0.9–1.6 s from tap to "Sold" | `docs/evidence/c7a-exit-2026-09-29.md` |
| Three oracle parties post 1-minute closes from Coinbase, Kraken and Bitstamp, and a separate resolver party resolves | `docs/evidence/c3-gate-2026-09-29.md` (43 consecutive windows per lane, 3/3 prints each) |
| The venue settles every leg in one batch, and the trader signs nothing | `docs/evidence/c3-gate-2026-09-29.md`, `c7a-exit-2026-09-29.md` |
| An outsider's ledger query returns nothing, and the query body is on screen | `docs/evidence/ux/c4b/08-view-outsider-1440-dark.png` |
| A committee event voids when attestors disagree and refunds what was paid | `docs/evidence/c6d-gap-events.md` |

## Why Canton

On a transparent chain, the position, side, size and owner would leak to every competitor. On Canton, a `Leg` contract has two signatories, the owner and the venue, and no other party's participant ever receives it. This is not a UI filter. `Test.Privacy.testOutsiderSeesNothing` proves it in Daml, and the outsider view shows it live.

## Why now

- Regulated event contracts are a real market: they exceeded $25B across CFTC-designated contract markets in 2025, and a CFTC proposed rulemaking on event contracts followed on 2026-06-10 ([CFTC 9249-26](https://www.cftc.gov/PressRoom/PressReleases/9249-26)).
- The organisers' own wishlist asks for "Outcome markets on institutional events … where positions stay confidential while resolution and payouts are auditable."
- The first Canton prediction market (Confimarket, S1) claims privacy but has never shown it. No one on Canton demonstrates private positions with live prices and an exit.

## Who pays

- **Traders** pay a fee per fill (escrowed in the leg and kept by the venue only when the market settles; refunded on a void) plus the quoted spread.
- **The operator** pays for the software. This is a technology demonstration designed to be run by a licensed venue in its jurisdiction. See `gtm.md` and `regulatory-posture.md`.

## What we do not claim

- It is not regulated or licensed, and it holds no real money. It runs on demo credits.
- The three price feeders are ours. They give honest prices that anyone can re-derive, but they are not independent oracles.
- On a shared participant, our code, not the ledger, enforces which party a seat acts as. See `privacy-matrix.md`.
