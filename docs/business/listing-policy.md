# Market listing policy

This page says which subjects the venue lists, which it does not, and who decides. The mechanism does not depend on the subject; this policy is where the line is drawn.

## Who decides

- **Now:** Abu, as the venue operator of this demonstration.
- **In production:** the licensed operator's listing committee, with compliance holding a veto. A decision is recorded with the date, the subject, the jurisdiction and the reason.
- **To delist:** any subject that becomes unlistable in a jurisdiction is removed there. Open positions settle or void under their own terms. Nothing is closed at a price the trader did not accept.

## Tiers

| Tier | Subjects | Status in this build | Rule |
|---|---|---|---|
| **Listed** | Crypto price windows: BTC and ETH at 1m, 5m, 15m, 1h, 4h and 1d | live on demo credits (`docs/evidence/c6-lanes-2026-09-29.md`) | commodities, resolved by three price parties from named exchanges |
| **Listed** | Institutional and operational events: data releases, rate decisions, settlement performance | the committee-event path works (`docs/evidence/c6d-gap-events.md`) | resolved by attestation quorum; a disagreement voids and refunds |
| **Demo only** | Index and ETF windows (QQQ, VOO) | lanes exist on demo credits | real money only through an operator licensed for index event contracts |
| **Demo only** | Single-name equities (TSLA, AAPL and others) and tokenised stocks (xStocks) | lanes exist on demo credits | not listed for real money; they may be security-based swaps |
| **Demo only** | Pre-IPO names and baskets (PreStocks) | lanes exist on demo credits | not listed for real money; PreStocks tokens are not issued or endorsed by the companies they reference |
| **Never** | Sports, elections and politics | not built | not listed |
| **Never** | Unlawful activity, terrorism, assassination, war | not built | not listed |

## Games

Duels, Lucky and the season pool run on demo credits only. They are never convertible to money. A product that turns points into money is a money product, and these stay points.

## Required on every listed market

- The price source is named on the market and on every receipt.
- The resolution rule is written down before trading opens: quorum, deviation limit, admission window and void reasons.
- A void refunds each leg's backing plus its fee.
