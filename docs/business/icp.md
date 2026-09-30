# Ideal customer profile

The upload version is `materials/02-icp-audience.md`. This is the working version, with the fields the judging playbook asks for and the hypotheses the interviews must test.

## Primary: the desk trader (user)

| Field | Value |
|---|---|
| Role and seniority | Trader or portfolio manager, mid to senior, who places the trades |
| Organisation | Crypto fund, prop desk or market maker, 2–30 people |
| Workflow today | Perps and options on centralised venues; occasional Polymarket or Kalshi for event views; orders split or kept off-chain to hide size |
| Tool today | Exchange UIs and APIs; on Polymarket, a wallet anyone can track |
| How often the pain happens | Every time a view has size behind it. **Hypothesis**: weekly or more for an active desk |
| What it costs | Smaller size than wanted, worse fills after being copied, or no trade at all. **Hypothesis**: to be put in their words and numbers |
| Trigger event | A known window: a data release, a 1-hour close, a weekend gap, a committee decision |
| Who signs off | Head of trading or a partner; compliance approves any new venue |
| Where they are | Crypto trading Telegram groups, X, Polymarket and Kalshi trader communities, Deribit and Hyperliquid communities |

## Secondary: the operator (buyer in production)

| Field | Value |
|---|---|
| Role | Head of product or business development at a licensed dealer, broker or exchange on Canton |
| Need | Offer event contracts to institutional clients with private positions and resolution the clients can check |
| Why this design fits | The venue is the counterparty and holds the full record. A regulator or auditor can be given observer rights. Privacy is from competitors, not from authorities |
| Who signs off | CEO or COO, plus compliance and legal |
| Where they are | The Canton forum, Canton ecosystem events, and the validator and participant operators |

## Disqualifiers

1. Retail users looking for sports, elections or casino games with real money.
2. Anyone who wants anonymity from the venue or from authorities.
3. Anyone who needs real-money trading today in a jurisdiction that requires a licensed venue.

## Hypotheses the interviews must confirm or kill

| # | Hypothesis | Kill signal |
|---|---|---|
| H1 | Public visibility changes how desks size or where they trade | Fewer than 3 of 5 say so |
| H2 | Short windows (minutes to a day) on BTC and ETH are a real risk need, not only entertainment | They use them only for fun |
| H3 | A firm quote from a venue that sees your trade is acceptable, as with an OTC desk | "I would not let any venue see my book" |
| H4 | Re-derivable prints from named exchanges are enough to trust resolution | They require an independent oracle before any size |
| H5 | The fee plus spread is acceptable against their current venue | The cost kills it |

Record the result of each hypothesis in `materials/03-metrics-validation.md`, from Abu's notes only.
