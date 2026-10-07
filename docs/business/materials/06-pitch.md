# Pitch Materials: Owarine on Canton

*Platform material 6 of 6. The criterion reads: "Quality and conciseness of the overall presentation." The Rules ask the deck to cover "the problem and why it matters; the solution and how Canton Network is used; target users and go-to-market thinking; key metrics or validation evidence".*

## Problem → solution → why us

**Problem.** On public prediction markets, a trader's position is public the moment it is placed, and an industry tracks and copies it. Traders with an edge pay for that leak, so size stays away.

**Solution.** A private event-risk desk on Canton:
- firm two-way prices, accepted in one click;
- positions only the trader and the venue can see;
- sell-back before the close;
- three oracle parties and a separate resolver, with prints anyone can re-derive;
- batch settlement, so the trader never signs to get paid.

**How Canton is used.** Every position is a Daml contract signed by the trader and the venue only. Another party's query returns nothing, and the app shows that query live. Resolution is a contract signed by the resolver and the venue together, so neither can forge it, and a market resolves or voids exactly once.

**Target users.** Traders at small crypto funds, prop desks and market makers, for whom being seen is a cost. In production, the operator is a licensed dealer or venue.

**Go-to-market.** Start with direct outreach to desks and Canton finance builders, then Canton-native routes: wallet integration, the AppsFactory accelerator, and Featured App status once it runs on MainNet. Revenue is a fee per fill plus the spread, and a software licence to the operator.

**Evidence.** 43 consecutive 1-minute windows resolved unattended, 160 trades with 0 failures, 175 Daml tests, and a sell-back in under 2 s, all on a local Canton sandbox. Interviews: *[fill in from Abu's notes]*.

**Why us.** Abu built and ran this product on Solana devnet first: a web app, a native iOS app and live resolution. On Canton the privacy is real rather than bolted on. The port was done in the delivery window, and the diff is public.

## Links

Deck: `<URL>` · Video (5 min or less): `<URL>` · Repo: `<URL>` · Live demo: `<URL>`

Slide-by-slide outline: `docs/business/deck-outline.md`. The 90-second demo: `docs/business/demo-script.md`.
