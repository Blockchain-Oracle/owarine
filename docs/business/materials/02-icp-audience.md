# ICP / Audience: Owarine on Canton

*Platform material 2 of 6. The criterion reads: "Specificity and understanding of the target user."*

## Primary user

**A trader at a small crypto fund, prop desk or market maker (2–30 people) who takes or hedges short-horizon BTC and ETH risk, and for whom being seen is a cost.**

- **Workflow today:** perps or options on a centralised exchange, and sometimes Polymarket or Kalshi for event views. They split orders or avoid on-chain venues to hide size.
- **Pain:** on public venues their wallet is tracked and copied. On lit books, resting size signals intent. So they trade smaller than they want or stay off the venue.
- **Trigger:** a clear view into a known event window (a data release, a 1-hour close, a weekend gap) that they cannot express at size without it being read.
- **Who signs off:** the head of trading or a partner, and compliance for any new venue.
- **Where they are:** crypto trading Telegram groups, X, prediction-market trader communities, Deribit and Hyperliquid communities.

## Secondary: the operator (who pays in production)

**A licensed dealer or exchange on Canton that wants to offer event contracts to institutional clients.**
- In this design the venue is the counterparty. It quotes, holds its side of every leg, and sees what a broker has always seen.
- It needs private positions, resolution its clients can check, and a regulator who can be given observer rights.

## Not for

1. Retail users looking for sports or election betting. We do not list those subjects (`listing-policy.md`).
2. Anyone who needs anonymity from the venue or from authorities. The venue onboards every account and holds the full record.
3. Users in jurisdictions where event contracts need a licensed venue the operator does not have.

## The one-line project sentence

We help **small crypto trading desks** take and exit **short-dated event risk** on Canton, because **their positions must not be visible to competitors**.

## Validation status (30 Sep)

**0 interviews done.** Five are planned for 1–6 Oct, with the guide in `docs/business/interview-guide.md`. This section will be updated from Abu's own notes only.
