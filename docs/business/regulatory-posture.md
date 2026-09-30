# Regulatory posture

**Not legal advice.** This is a technology demonstration, not a licensed venue.

## What this build is

- It runs on demo credits minted by the venue on a test network. **No real money** is accepted or paid out.
- It is designed to be operated by a licensed dealer or venue in its own jurisdiction. In this design the venue is the counterparty to every trade.
- Every account is a party that the venue onboards. The venue holds the complete record of every trade, and a regulator or auditor can be given observer rights. The auditor party already sees reserve totals (`NavStatement`).

## What we claim

- A technology demonstration of confidential event markets on Canton.
- Positions are hidden from other traders and the public, not from the venue or from authorities.
- Anyone who can see a market can check how it resolved. Each print carries a hash of the raw exchange payload.

## What we never claim

- "Regulated", "compliant", "licensed" or "CFTC-approved".
- "Legal in the US", or anything that implies a designated contract market.
- "Anonymous" or "untraceable".
- An "official close" for any equity price.
- Investment advice, expected returns, or anything "guaranteed".

## Subjects

The listing policy (`listing-policy.md`) decides what may be listed. In short:
- crypto price windows and institutional or operational events are listed;
- single-name equities are demo only;
- sports, elections, war and unlawful activity are never listed.

## Two questions to rehearse

**"Isn't a private betting market a money-laundering tool?"**
> No. The design is the opposite. The venue onboards every account and is the counterparty to every position, so it holds the full record and can give a regulator observer rights over any part of it. What is hidden is competitor visibility, not authority visibility. That is compliant confidentiality, which institutions on this network already have in every other asset class.

**"What happens when a regulator bans your category?"**
> The mechanism does not depend on the subject. If a subject cannot be listed in a jurisdiction, the listing policy removes it and the venue keeps running the rest. The first markets are crypto windows and institutional events, the part of the category that regulated venues have listed throughout.

## What production would need

1. A licensed operator (a dealer or an exchange) in each jurisdiction served, with onboarding and KYC.
2. A geofence: a region check plus an explicit acknowledgement. The build plans one from a local IP-to-country database (K-003), but no evidence note shows it working yet.
3. "Not investment advice" and "demo data" labels on every price display.
4. Independent price sources. The three feeders are self-run today.
5. Real settlement assets instead of demo credits.

## Open tension (for Abu)

The app is a fidelity port, so it also shows single-name stock lanes (TSLA, AAPL and others), PreStocks pre-IPO names, and games with pots (duels, Lucky, a season pool), all on demo credits.

`listing-policy.md` puts equities and pre-IPO names in "demo only" and says game credits are never money. The demo video and deck lead with crypto windows and committee events. A judge can still open the board and see stock lanes. Two options:
- a "demo credits, technology demonstration" label on those lanes; or
- one sentence in the pitch saying why they are demo-only.

Abu decides which.
