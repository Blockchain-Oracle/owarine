# HackCanton Season 3 — a prediction market on Canton (working name)

A port of Abu's prediction market, web and iOS, from Solana to **Canton and Daml**, entered in HackCanton League Season 3, Track 2 (Financial Applications). The plan: Up/Down calls on short price windows for stocks and crypto, with games, agents and desks, designed so that each position is visible only to its owner and the venue. None of that runs on Canton yet.

The product name is not chosen yet; the code still carries the reference's identity until the rename step.

## Status

**Stage C0 (bootstrap), 29 Sep 2026.** What exists today:

- The reference app imported unchanged (see below), not yet ported: it still targets Solana.
- The design system's stylesheets, in the repo byte-identical.
- The plan, decisions, parity ledger, acceptance ledger and capability registry in [`docs/plan/`](docs/plan/). Start with [`docs/plan/00-plan.md`](docs/plan/00-plan.md) and [`docs/plan/STATUS.md`](docs/plan/STATUS.md).

Nothing on Canton runs yet. Every capability is marked `not-live` in [`docs/plan/capabilities.json`](docs/plan/capabilities.json) until its stage gate passes and an acceptance row records the evidence.

## Prior work vs work in the HackCanton window

The HackCanton rules: "You may build on a pre-existing codebase, but you must disclose it, and the work done during the hackathon must be clearly identifiable. Judges evaluate only that work."

- **Prior work.** The first commit (`6f3f3cf`) imports **Agari**, Abu's own prediction market on Solana (web app, native Expo app, shared packages, ops services and docs site), from branch `codex/mobile-takeover` at `661a24ee`. It was imported unchanged, except that the Solana programs (`anchor/`) were left out because Daml replaces them. Agari itself descends from Abu's earlier Masayume; see [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) and [`docs/plan/references.md`](docs/plan/references.md) for the full lineage. **All of it is prior work.**
- **The boundary.** That import commit carries the annotated tag **`hackcanton-s3-start`**. Everything after the tag is work done in the HackCanton delivery window.
- **See the in-window work:**

  ```sh
  git log --oneline hackcanton-s3-start..HEAD
  git diff --stat hackcanton-s3-start..HEAD
  git diff hackcanton-s3-start..HEAD
  ```

  At submission the same commands run against the `submission` tag.

The baseline was proven on the untouched Agari tree before import (typecheck, invariants, 1,773 unit tests, web build, mobile typecheck); the results are in [`docs/plan/acceptance.md`](docs/plan/acceptance.md).

## Layout

`web/` (Next.js) and `mobile/` (Expo) apps · `packages/` shared code · `services/ops/` venue operations · `daml/` the Daml packages (being written) · `docs-site/` guides · `docs/plan/` the plan and its evidence.

## Licence

See [`LICENSE`](LICENSE) and [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
