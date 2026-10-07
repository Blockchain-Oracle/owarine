# Value / Problem Statement: Owarine on Canton

*Platform material 1 of 6. The criterion reads: "Clarity of the problem, why it matters and why now."*

## The problem

On public prediction markets, a trader's position is public the moment it is placed: owner, side, size and history.

An industry already sells that information.
- Whale trackers alert on trades of $10,000 or more, because "positions that size often move before the news does" ([Polywhaler](https://polywhaler.com/)).
- Copy-trading sites rank wallets by P&L and sell the follow ([Polycopy](https://polycopy.app/best-polymarket-traders)).
- A 2026 study of leaderboard wallets found traders baiting copiers and using them as exit liquidity ([CopyGrade](https://copygrade.com/blog/we-scored-the-polymarket-leaderboard)).

The result:
1. A trader with an edge pays a tax to use the venue, because the thesis is republished at once.
2. Size stays away. A fund cannot take a position its competitors can read the same afternoon.
3. The venue prices against leakage. Polymarket charges its highest taker fees on 15-minute crypto markets "to prevent latency arbitrage" ([Crypticorn](https://www.crypticorn.com/polymarket-fees-explained/)).

## Why it matters

Event risk (a 1-hour BTC move, a data release, an operational outcome) is risk that desks want to take or hedge. Today they choose between public on-chain venues that leak and lit order books that show intent. Neither works for someone whose size is the information.

## Why now

- Event contracts are a regulated, growing market. They exceeded $25B on CFTC-designated contract markets in 2025, and a CFTC proposed rulemaking on event contracts was published 2026-06-10 ([CFTC](https://www.cftc.gov/PressRoom/PressReleases/9249-26)).
- The organisers' wishlist asks for "Outcome markets on institutional events … where positions stay confidential while resolution and payouts are auditable."
- The Canton prediction market that won S1 asserts privacy but has not shown it publicly. No one on Canton shows private positions with live two-way prices and an exit.

## Our answer

A **private event-risk desk**, not "Polymarket but private":
- The venue quotes a firm price, and the trader accepts it with one click.
- The position is a Daml contract signed by the trader and the venue only. No other party's node ever receives it.
- The trader can sell back before the close at a firm bid.
- Three price-feeder parties and a separate resolver decide each market. The raw exchange candle is hashed into each print, so anyone can re-derive it.
- The venue settles every leg in a batch. The trader signs nothing to get paid.

## If this ran on a transparent chain, what breaks?

Every position, with its side and size, would be readable by every competitor and copy-trader within a block. That is the leak this product removes.
