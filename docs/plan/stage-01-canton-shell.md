# C1 — Canton shell, web and mobile

**Goal:** the app builds and runs with no Solana left: a stub Canton adapter behind `@…/markets`' existing exports (including web's Solana-bound hooks that mobile imports), the seat island on web and phone, live prices on the phone, and the new Canton surfaces built from the reference kit and 21st.

- **Dates:** Wed 30 Sep – Fri 2 Oct.
- **Plan:** `00-plan.md`, "Architecture" (1, 2, adapter mapping), "UX and 21st", "iOS" steps 1–7.
- **Lanes, in order:** 1a core edits → 1b stub adapter → 1c web seat island → 1d consumer port → 1e mobile seat island → 1f live prices on the phone; 1g UX lane beside them.
- **K-number block:** K-010–019 (K-010 ticket direction default recorded).

## Steps

- [ ] 1a `packages/core` edits: `isSignature` accepts a Canton update id; `TICKER_SYMBOLS` gains BTC/ETH (24/7); `VoidReason` gains specific reasons; `ClaimKind` gains `stale-refund`; `Cluster`, `SOLANA_EXPLORER_URL`, `FEE_RESERVE_LAMPORTS` go
- [ ] 1b stub adapter over all 27 subpaths and web's Solana-bound hooks (behaviour-neutral splits, D-129); `./sponsor` reports no fee; `./prices/legacy` and `/api/rpc*` deleted
- [ ] 1c web seat island: seat key (non-extractable, D-066), "Take a seat", avatar + dropdown (seat, party id, lease left, reset)
- [ ] 1d consumer port: every web consumer on the stub adapter; region hold on the local country source (K-003); L-10 stays unmounted (decision entry)
- [ ] 1e mobile seat island: iOS steps 1–7 (seat signer, seat store and provider, 2b seat link, first-run gate, deletions, env, funds, links and copy)
- [ ] 1f `react-native-sse` spot stream and venue ladder on the phone
- [ ] 1g UX: chip, view switcher, StepProgress, quote ring, seat link, Code Block, demo-credits grant, each with a `/dev` fixture; native ports only for the chip, switcher, StepProgress, ring, seat link and grant; D-081 ticket directions at `/dev/ticket-canton` by Thu 1
- [ ] Seam inventory generator
- [ ] `/dev/wallet` → `/dev/seat`; `/api/dev/verify-message` checks seat signatures

## Gate

- Fast and web gates; `pnpm --filter @owarine/mobile typecheck`.
- `no-solana` allowlist empty.
- Every web route at 390/768/1440 in both themes; mobile side-by-side via `mobile/scripts/webdump.mjs`.
- Settled-state sweep; `21st review` on changed paths; `expo export` for iOS and Android.

**Acceptance rows required:** the gate run; seat signing parity test; the D-081 pick recorded.

## Findings

## Handoff
