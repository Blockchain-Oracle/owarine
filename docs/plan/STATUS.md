# STATUS — updated 2026-10-06 00:20 UTC by Claude (main)

```
Where it runs:  local Canton sandbox only. Noders DevNet: the node is up (Canton 3.5.19, public preflight 6 Oct), nothing uploaded, not onboarded. Hosted URL: none yet.
Repository:     one checkout, branch main only, no worktrees. Pushed to github.com/Blockchain-Oracle/hackcanton-pm (private until Abu makes it public; the Rules need it public by submission).
Deadline:       delivery closes Fri 9 Oct 23:59 UTC.
Capabilities:   live 0 · local 59 · not-live 162 (of 221; docs/plan/capabilities.json). A row goes live only with a DevNet acceptance row.
Fast gate:      main on 6 Oct: typecheck green (all projects) · invariants 0 errors, 0 warnings · vitest 325 files, 2,524 tests passed, 61 skipped
Daml:           dpm build --all green on 6 Oct, reproducing the released main DAR byte for byte. Last dpm test: 227 scripts (C7c, 30 Sep) plus the rail's 38 (C7b)
DAR release R1: five files staged in daml/released/, none on Noders: abu-pm-main 0.5.1, tickets 0.1.3, agents 0.2.1, games 0.1.1, cc 0.1.0 (K-249). abu-pm-governance 0.1.0 (BitSafe) is LocalNet-only
Blocked on Abu: DevNet R1 (his Console session); the hosted deploy (a domain); iOS (the App Store Connect record)
```

## Stages

"Local" means proven end to end on the local sandbox with the real ops process, with an evidence note. It does not mean on DevNet or on a hosted URL.

### Done (local)

| Stage | Evidence |
|---|---|
| **C0** fork builds | `acceptance.md` C0 rows |
| **C1** Canton shell | gate passed 29 Sep |
| **C2** Daml engine | abu-pm-main 0.5.1 (maker vault C2d, pre-open resting call C7c, K-235) |
| **C2z** R1 rehearsal | `evidence/c2z-r1-rehearsal.md`: the whole R1 sequence and the four-viewpoint first call on one sandbox |
| **C3** ledger, projector, ops | gate passed 29 Sep; C3f: a slow write pauses under the same command id |
| **C5** proof and analytics | `ux/c5` |
| **C6** lanes and states | `evidence/c6-*`; C6f: halts follow each lane's real source |
| **C7a** trading balance and exit | `evidence/c7a-exit-2026-09-29.md` |
| **C7b** Canton Coin rail | `evidence/c7b-canton-coin.md`: built and proved in Daml and unit tests; `not-live` until `runbooks/cc-rail.md` runs on DevNet |
| **C7c** pre-open resting calls | `evidence/c7c-resting-call.md`, 24/24 end to end |
| **C8** tickets, agents, desk, maker vault | `evidence/c8e`, `c8f`, `c8g`, `c8i`, `c2d-maker-vault.md`; C8j phase A (live desk timing, PreStocks prices) |
| **C9** games | `evidence/c9b`, `c9c`, `c9d-seats-games.md`; Lucky placed from its own screen (`ux/c8j`) |
| **C10** copy and docs | C10a–C10e: truthful copy on web and phone, docs site rewritten for Canton |
| **D1, D2** design review | 18 deterministic fixes (D1), then the recommendations Abu accepted (D2) |

### Not done, and what each waits on

| Stage | State | Waits on |
|---|---|---|
| **C2x / R1** on DevNet | not started | Abu's Console session (below), then four agent commands (`runbooks/devnet-r1.md`) |
| **C4 / M1** first call, hosted | local only | a domain and its DNS records; R1 on DevNet |
| **C8d** baskets hub, valuation hub | not started | valuation lanes need an entitled Pyth key (denied 403 on 30 Sep) |
| **C10** public story | copy and docs merged | landing and `/download` updates; docs site on Coolify |
| **C11** iOS | typechecks and exports | Abu: app name, Apple identifiers, App Store Connect record. Never run on a simulator or device |
| **BitSafe** | B2 merged (abu-pm-governance 0.1.0, 14 Daml tests) | the LocalNet run; the Gold path's 4 Oct deadline has passed, so the contribution pool is the target |
| **Grofty** | not started | an invite (MainNet only) |
| **Business** | B1 drafts merged | nothing sent; 0 interviews, 0 usability tests |

## MainNet and TestNet

Not needed for judging: the Rules say projects on DevNet, TestNet or LocalNet are fully eligible. Running our own Daml on MainNet needs our own validator node, which needs approval from the Canton Foundation's Tokenomics Committee (request at sync.global/validator-request), a sponsoring Super Validator, and our server's IP on the allowlist (2–7 days after the sponsor agrees). TestNet needs the same MainNet approval first, so it is not a shortcut. Detail: `canton-season3/context/11-wallet-and-deployment/mainnet-and-testnet-requirements.md`. It is a post-hackathon step and a roadmap line in the pitch.

## Needs Abu

1. **Every day until 9 Oct:** press "claim mana" on the HackCanton dashboard and write the evening journal entry.
2. **DevNet, once (about 20 minutes):** onboard the Noders wallet, sign in to the Console with Authfactory, create the 19 parties, save the party list on this Mac, upload the 5 DARs in order, and put the platform login in `~/.config/agari/canton/devnet.env`. The clicks are in `docs/plan/runbooks/devnet-r1.md`. Then tell me "done".
3. **Website:** a domain, and its A records at Namecheap (`runbooks/coolify-deploy.md` §1). Then either a Coolify API token for this session or Abu clicks the deploy steps.
4. **iPhone app:** confirm "Agari Canton" and `xyz.useagari.canton`, create the App Store Connect record (`docs/evidence/c11a-ios.md`). TestFlight review took about 2 days last time, so this only makes 9 Oct if it starts by 7 Oct.
5. **At the end:** make the GitHub repository public, record the video, send the submission form.

Everything else has a default in `decisions.md` that Abu can overrule.

## Known gaps (named, not hidden)

- The Docker images have not been built here (this Mac's disk was full on 6 Oct, 7 GB free after clearing build caches); the first build happens on the Coolify server.
- The phone has never run against Canton: it typechecks and exports only.
- Pyth, the Pyth index and Switchboard are down on Canton (no entitled key; Switchboard Surge not answering). Stocks settle on RedStone and Alpaca, xStocks on the Jupiter Price v3 median.
- Resting calls and the Canton Coin rail run on the local sandbox only.
- Third-party marks (C-S25, K-250): only Canton Network, Noders and BitSafe logos are drawn, from their published brand kits; every other source, PreStocks included, is named in plain text.
