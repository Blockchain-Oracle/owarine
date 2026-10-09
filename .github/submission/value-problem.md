[![Owarine: Call the close. Keep your position private.](https://raw.githubusercontent.com/Blockchain-Oracle/owarine/main/.github/assets/banner.png)](https://owarine.xyz)

# Owarine

**Private price predictions on Canton, built with Daml.**

[Try Owarine](https://owarine.xyz) · [Watch the demo](https://youtu.be/YlijOtBl5Zw) · [View the source](https://github.com/Blockchain-Oracle/owarine)

## Problem

Active traders who want to call the next price move face a trade-off:

- **Public-chain positions** expose their activity.
- **Hosted venues** require them to trust private settlement rules.

## Value

Owarine offers:

- **Short Up/Down markets**
- **Firm quotes**
- **Position contracts shared with the owner and the venue**, rather than unrelated parties

Traders can make a price call while keeping their position private and inspecting the contract rules behind the outcome, payout and refund.

In the current DevNet prototype, the participant operator and application server remain trusted.

[![Watch the Owarine product walkthrough: Call it. Close it. Check it.](https://raw.githubusercontent.com/Blockchain-Oracle/owarine/main/web/public/demo/cover.png)](https://youtu.be/YlijOtBl5Zw)

## How it works

- **Canton** scopes contract visibility.
- **Daml** enforces acceptance, oracle-based outcomes, payouts and refunds.
- **The proof view** lets traders inspect the opening and closing prints and the recorded resolution.

![Owarine architecture: web app, venue operations, Canton contracts and Postgres projections](https://raw.githubusercontent.com/Blockchain-Oracle/owarine/main/.github/assets/architecture.png)

## Current status

- A **working web prototype** is available.
- **Recorded end-to-end Canton DevNet runs** demonstrate the flow.
- The **mobile app** is being built.
- A **TestNet launch** is planned.
- **External user-demand validation** is still in progress.

The prototype uses **demo credits with no cash value** and **DevNet test funds**.

![Owarine DevNet print and resolution proof, captured 8 October 2026](https://raw.githubusercontent.com/Blockchain-Oracle/owarine/main/web/public/pitch/proof-timeline-devnet-2026-10-08.png)

[Recorded DevNet acceptance](https://github.com/Blockchain-Oracle/owarine/blob/main/.github/verification/acceptance.md) · [Five-slide pitch](https://owarine.xyz/pitch) · [Documentation](https://docs.owarine.xyz)
