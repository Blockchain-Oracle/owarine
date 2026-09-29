# References

What this repo builds on, where it came from, and how each source may be used.

**Allowed use:** *code* means it may be adapted into this repo, with attribution in `THIRD_PARTY_NOTICES.md` where the source is not Abu's own; *ideas* means read only, no copied code. Licences are read from each repository's own licence file. **"None" means no licence file, so the source is treated as all rights reserved: ideas only.**

Local clones live outside this repo (the knowledge base's `refs/`, and the reference worktrees in `agari-wt/`). Nothing under `refs/` is ever copied in wholesale or committed.

## The product lineage

| Entry | Source | Pin | Licence | Allowed use |
|---|---|---|---|---|
| Agari | Abu's own project (`agari-wt/mobile-takeover`, branch `codex/mobile-takeover`) | `661a24ee` (27 Sep) | Abu's own | **Code.** The fork base (K-001): imported at tag `hackcanton-s3-start`, without `anchor/` |
| Masayume | Abu's own project (`sommina-events`) | `68f7a09` (the fork base of Agari) | Abu's own | **Code and design authority** where Agari dropped a layer (authority order in `working-rules.md`) |
| Yosuku | github.com/Cybire1/yosuku (third-party) | `3c56ef5` | The pinned README shows an MIT badge; the pinned tree has no root licence file | Lineage of the design system. Its interface and CSS lineage came into Masayume and then Agari; Abu approved implementation reuse on 1 Sep. `web/src/styles/yosuku/**` is in this repo byte-identical from `661a24ee` (K-002). `THIRD_PARTY_NOTICES.md` records the lineage |
| PIPS | github.com/Blockchain-Oracle/pips (third-party) | `fe8f6963` | None | Ideas (game selection, settings, Lucky, Moonshot, arcade patterns), unless licensed |
| Flicky | github.com/Blockchain-Oracle/flicky, a fork of nikola0x0/flicky (third-party) | `56054bae` | None (README: "to be determined"; one Apache-2.0 file header is not a repository licence) | Ideas (practice/duel, commit-reveal, scoring, matchmaking), unless licensed |

## Canton and Daml

| Entry | Source | Pin (local clone) | Licence | Allowed use |
|---|---|---|---|---|
| `splice` | github.com/canton-network/splice | `fda19e6` | Apache-2.0 | Code (token standard, wallet and validator patterns) |
| `dpm` | github.com/digital-asset/dpm | `b65a815` | Apache-2.0 | Code (tooling) |
| `dpm-assembly` | github.com/digital-asset/dpm-assembly | `1878cb1` | Apache-2.0 | Code (the local sandbox assembly, 3.5.10) |
| `daml-finance` | github.com/digital-asset/daml-finance | `155f931` | Apache-2.0 | Code/ideas |
| `docs.daml.com` | github.com/digital-asset/docs.daml.com | `52629c4` | Apache-2.0 | Docs; cite, do not copy prose |
| `cn-quickstart` | github.com/digital-asset/cn-quickstart | `8984e43` | Permissive notice (Digital Asset, "Permission to use, copy, modify, and/or distribute … with or without fee") | Code (LocalNet shape) |
| `decentralization-manager` | github.com/DLC-link/decentralization-manager | `7b4966d` | Apache-2.0 | Code (BitSafe add-on) |
| Daml stdlib 3.5.2 | shipped with the SDK | 3.5.2 | Apache-2.0 | Code (the Daml standard library the packages depend on) |

The remote URLs are the local clones' `origin`; the pins are the local clones' HEADs on 29 Sep. A pin is re-recorded here when code from that repo is adapted.

## Data and services

| Entry | Source | Licence | Allowed use |
|---|---|---|---|
| DB-IP IP-to-Country Lite | db-ip.com | CC BY 4.0 | Data for the region hold (K-003); attribution on `/legal` |
| Exchange candle APIs (Coinbase, Kraken, Bitstamp) | public REST endpoints | Each provider's API terms | Oracle feeder input (C3); raw payloads archived byte-identical |

## 21st components

Every 21st component adopted into this repo gets a row here when it is pulled, with its catalogue id, author and licence as stated on its catalogue page at that time.

| Component | 21st id | Where used | Licence | Allowed use |
|---|---|---|---|---|
| Desk-kit pieces already in the reference (StepProgress #29458, UnderlineTabs #24956, Timeline #28276, #29318) | see ids | ticket, view switcher, proof timeline | recorded in the reference; re-recorded here when reused | Code (already adapted in the reference) |
| Code Block | #23586 | literal ledger query on screen | to be recorded when pulled | — |
| Two-Factor Authentication Card (layout only) | #29246 | seat link | to be recorded when pulled | — |
| OTP Input | #23543 | seat link code entry | to be recorded when pulled | — |
