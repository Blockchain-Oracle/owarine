![Owarine problem and value: Call the move. Keep it private.](https://raw.githubusercontent.com/Blockchain-Oracle/owarine/main/.github/assets/submission/value-problem-header.png)

## Problem

Active traders who want to call the next price move face a trade-off:

- **Public-chain positions** expose their activity.
- **Hosted venues** require them to trust private settlement rules.

## Value

Owarine offers:

- **Short Up/Down markets**
- **Firm quotes**
- **Positions visible only to the owner and the venue**

The platform is designed to give traders a way to participate in price-move markets without the same visibility trade-offs of public-chain positions or the same trust concerns of hosted venues.

## How it works

- **Canton** scopes contract visibility.
- **Daml** enforces:
  - acceptance
  - oracle-based outcomes
  - payouts
  - refunds

## Current status

- A **working web prototype** is available.
- **Recorded end-to-end Canton DevNet runs** demonstrate the flow.
- The **mobile app** is being built.
- A **TestNet launch** is planned.
- **External user-demand validation** is still in progress.

The prototype uses **demo credits with no cash value** and **DevNet test funds**. Contract visibility is scoped to the owner and venue; the participant operator and application server remain trusted in this prototype.

[Try Owarine](https://owarine.xyz) · [Watch the demo](https://youtu.be/YlijOtBl5Zw) · [Recorded DevNet acceptance](https://github.com/Blockchain-Oracle/owarine/blob/main/.github/verification/acceptance.md)
