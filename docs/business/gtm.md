# Go-to-market

The upload version is `materials/04-gtm.md`. This page adds the economic flows Track 2 asks for ("A clear explanation of economic flows and user incentives") and a 90-day plan.

## Positioning

A private event-risk desk: firm two-way prices, positions nobody else can see or copy, and resolution anyone at the table can re-derive. We are an OTC desk for event windows, not "Polymarket but private".

## Economic flows (as built in `abu-pm-main`)

All amounts are integers. A price is in ticks from 1 to 999, out of 1,000.

1. **Quote.** The venue's pricer publishes a price ladder. At the click, ops walks it and issues one firm `Quote` for 20 s. If the cost is above what the user confirmed, it requotes and creates nothing.
2. **Accept.** The trader pays `lots × ticks × cashUnit` plus a fee. The venue locks `lots × (1000 − ticks) × cashUnit` from its own cash. Both sit in the `Leg`, so every pair is fully backed.
3. **Fee.** The fee is `⌈quantity × rateBps × t × (1000 − t) / 10¹⁰⌉`, with a default of 100 bps: about 0.25% of the payout at even odds, falling to zero at the ends. It is held in the leg, kept by the venue only at a non-void settle, and returned in full on a void.
4. **Exit.** Before the close, the venue quotes a firm bid (`BuyQuote`). The trader sells all or part and gets the proceeds at once (`docs/evidence/c7a-exit-2026-09-29.md`).
5. **Resolve.** Three oracle parties post prints. The resolver records one `Resolution` signed by the resolver and the venue. A market resolves or voids exactly once.
6. **Settle.** The venue settles legs in batches. The winner receives `lots × 1000 × cashUnit`, and the trader signs nothing. If the venue never settles, the owner can take a stale refund after `refundAfter`, and needs no other contract to do it.
7. **Void.** Missing prints, prints that deviate from each other, or disagreeing attestors void the market. Each leg gets back its backing plus its fee.

**Who earns what:**
- **Trader:** the payout if right, an exit if they change their mind, and no leak.
- **Venue:** the fee plus the spread. The bid sits below fair; C8e measured it at 30 ticks under.
- **Liquidity providers (Earn):** a share of the reserve that backs tickets. The auditor sees only reserve totals (`NavStatement`).
- **Strategy creators:** a fee from subscribers, who stay anonymous to them.

On DevNet the venue mints its own demo cash, so solvency is a reserve claim the auditor party checks. It is not yet backed by Canton Coin (plan, "Money rules fixed by review").

## Who pays

| Payer | For what | Status |
|---|---|---|
| Trader | fee per fill plus the spread | built, on demo credits |
| Operator (a licensed dealer or venue) | a software licence to run the desk in its jurisdiction | hypothesis, to test in interviews |

## First 10 users

See the table in `materials/04-gtm.md`. The drafts are in `outreach.md`.

## Channels, in order

1. **Direct:** 15 personal messages (`outreach.md`), then a demo seat for everyone who replies.
2. **HackCanton community:** the participant Telegram, and publishing the project early on the Projects tab.
3. **Canton forum:** a post asking for criticism of the privacy matrix, as CompressRail did. Send it once the hosted demo is live.
4. **After the hackathon:** the AppsFactory accelerator and Crowdloans; Featured App status once a node on MainNet shows activity a reviewer can verify.

## Next 90 days (if the thesis holds)

| When | Goal | Signal |
|---|---|---|
| Oct | 5 interviews, 3 usability tests, a hosted demo on Noders DevNet | H1 confirmed; strangers place a call in under 60 s |
| Nov | 3 desks trading demo credits weekly; one operator conversation | weekly settled calls by outside users |
| Dec | a pilot plan with a licensed operator, or a pivot to operator-only software | a signed letter of intent, or a clear no |
