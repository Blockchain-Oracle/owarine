# GTM Materials: Agari on Canton

*Platform material 4 of 6. The criterion reads: "Plausibility of the distribution strategy and audience fit."*

## Positioning

A **private event-risk desk**: firm two-way prices, positions nobody else can see or copy, and resolution anyone at the table can re-derive. We compare ourselves to an OTC desk, not to Polymarket.

## First 10 users

| # | Segment | Channel | Offer | Next action |
|---|---|---|---|---|
| 1–5 | Small crypto trading desks and prop traders | Personal outreach on X and Telegram (drafts in `docs/business/outreach.md`) | A 20-minute interview, then a seat on the demo | Abu sends, 30 Sep – 2 Oct |
| 6–8 | Canton finance builders (S1/S2 RFQ and desk teams) | GitHub and the HackCanton Telegram | A critique of the privacy design, and a try | Abu sends, 30 Sep – 2 Oct |
| 9–10 | Canton validator and wallet operators | Canton forum post and the Grofty community | A seat, and a view of the trust boundary | Forum post after the hosted demo is live |

## Who pays and how

- **Traders** pay a fee per fill and the quoted spread. The fee is held in the leg and kept only when the market settles; a void refunds it.
- **The operator** (a licensed dealer or venue) licenses the software and runs it in its jurisdiction. That is the production path. This hackathon build is a technology demonstration on demo credits.
- **Pricing hypothesis:** the build's default fee is 100 bps on the curve `t × (1 − t)`. That is about 0.25% of the payout at even odds, and it falls towards zero at the ends. The C7a sell-back paid 0.2498 on a 100-lot call at 51.3¢ (`docs/evidence/c7a-exit-2026-09-29.md`). Interviews will test whether desks accept this plus the spread.

## Acquisition hypotheses and cheap tests

1. **Private positions pull size.** Test: ask 5 traders whether they have shrunk or moved a trade because it was visible. The target is 3 of 5.
2. **No wallet install converts.** A guest seat lets a stranger place a call in under a minute. Test: 3 usability tests, timed.
3. **Canton-native distribution.** The routes are Featured App status (needs a node on MainNet and verifiable activity), the AppsFactory accelerator, and wallet integrations such as Grofty. Test: one message to Grofty and one forum post. Neither is sent yet.

## Why this fits Canton's users

Canton's participants are institutions with onboarding already in place. The privacy we offer is from competitors, not from authorities, which is what they already have in every other asset class.

## Competition, named

- **Confimarket** (won S1) offers crypto up/down with custodial deposits. It has no public dynamic pricing, no exit and no shown privacy.
- **Unhedged** is a consumer venue with sports and esports markets. It makes no privacy claim in the product.
- **Our wedge:** shown privacy, firm prices with sell-back, and resolution that can be re-derived.
