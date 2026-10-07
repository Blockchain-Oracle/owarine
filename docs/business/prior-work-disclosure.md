# Prior-work disclosure

## The rule (Rules tab, verbatim)

> "Work submitted for judging must be done during the delivery phase, September 18 – October 9, 2026. You may build on a pre-existing codebase, but you must disclose it, and the work done during the hackathon must be clearly identifiable. Judges evaluate only that work."

## The boundary

- **Tag:** `hackcanton-s3-start`, an annotated tag on commit `6f3f3cf` (2026-09-29 01:26 UTC). Its message: "Prior-work boundary: Agari 661a24ee imported unchanged. Work after this tag is HackCanton S3 in-window work."
- **Everything at or before the tag is prior work. Everything after it was done in the window.**

## What is prior work

| What | Detail |
|---|---|
| **Agari** (Abu's own) | His prediction market on **Solana**: web app, native iOS app (Expo), shared packages, ops services and docs site, from branch `codex/mobile-takeover` at `661a24ee` (27 Sep). It was imported by `git archive` without `anchor/` (the Solana programs), which Daml replaces |
| Agari's own history | Agari was built for a separate Solana hackathon (Stocklana). Some of its commits, 14–27 Sep, fall inside this window's dates. **They are still prior work here**: they were made for Solana and another event, not for HackCanton |
| Agari's evidence | `docs/evidence/prior-work/agari-solana-acceptance.md` and `docs/submission/tracks.md` are Agari's Solana devnet records, imported unchanged. They are not evidence for this entry |
| Masayume (Abu's own) | Agari descends from it. See `docs/plan/references.md` |
| Design system lineage | `web/src/styles/yosuku/**` is byte-identical from `661a24ee` and descends from third-party Yosuku. Game patterns from PIPS and Flicky are used as ideas only. See `THIRD_PARTY_NOTICES.md` |

## What was built in the window (after the tag)

| Area | What | Lines |
|---|---|---|
| Daml | `abu-pm-main`, `abu-pm-tickets`, `abu-pm-agents`, `abu-pm-games`, and the `pm-tests` suite (175 scripts). **None existed before the tag** | `daml/`: 57 files, +11,679 |
| Ledger client | JSON Ledger API v2 client: paging, deduplication, the updates stream | `packages/ledger`: 20 files, +2,422 |
| Markets adapter | `@owarine/markets` rewritten from Solana to Canton behind the same exports | `packages/markets`: 353 files, +15,224 / −16,694 |
| Venue operations | roller, 3 oracle feeders, pricer, quote issuer, resolver, settler, projector, seat drain | `services/ops`: 163 files, +9,698 / −2,211 |
| Web | seat routes, the view switcher, proof, receipts, Canton copy | `web`: 444 files, +15,995 / −3,215 |
| Mobile | seat identity and Canton copy (not yet run on a device against Canton) | `mobile`: 133 files, +1,265 / −2,383 |
| Removed | Solana-generated clients and Solana-bound code | `packages/clients`: −121,874 |

**Diff stat for the product**, measured at `f6ac105` (the product tip before these business docs):

```
$ git diff --shortstat hackcanton-s3-start..f6ac105
 2339 files changed, 86252 insertions(+), 162843 deletions(-)
```

That is 249 commits after the tag. Re-run at submission against the `submission` tag.

## Where the rest of the window went

This repo's commits start on 29 Sep. From 18 to 28 Sep, the work lived in Abu's separate knowledge-base workspace: Canton research, the design, and throwaway Daml spikes. None of it is in this repo, and the spikes were never uploaded to any network. The journal names each day's work in Abu's words.

## AI use

The Rules ask that AI-assisted tools be used "transparently". Abu built this with AI coding agents in parallel lanes. Commits carry a `Co-Authored-By` trailer naming the model. Abu is responsible for all code submitted.

---

## README section draft

Paste this into the root `README.md`, replacing its current "Prior work vs work in the HackCanton window" section.

```markdown
## Prior work (Agari, Solana) vs built 18 Sep – 9 Oct (Canton)

The Rules: "Work submitted for judging must be done during the delivery phase, September 18 – October 9, 2026. You may build on a pre-existing codebase, but you must disclose it, and the work done during the hackathon must be clearly identifiable. Judges evaluate only that work."

**Prior work.** Commit `6f3f3cf`, tagged **`hackcanton-s3-start`**, imports Agari, Abu's prediction market on Solana (web, native iOS app, packages, ops, docs site) at `661a24ee`, without its Solana programs. Agari's own commits of 14–27 Sep were made for a separate Solana hackathon and count as prior work here. Lineage: `THIRD_PARTY_NOTICES.md` and `docs/plan/references.md`.

**Built in the window.** Everything after the tag:
- the four Daml packages and 175 Daml Script tests (`daml/`, all new);
- the JSON Ledger API v2 client (`packages/ledger`);
- the Canton adapter behind `@owarine/markets`;
- the venue operations (`services/ops`);
- the seat, privacy-view, proof and receipt surfaces on the web.

    git log --oneline hackcanton-s3-start..submission
    git diff --shortstat hackcanton-s3-start..submission
    #  2339 files changed, 86252 insertions(+), 162843 deletions(-)   (at f6ac105, 30 Sep; update at submission)

Most of the deletions are Solana-generated clients (`packages/clients`, −121,874 lines).
Full disclosure: `docs/business/prior-work-disclosure.md`.
```
