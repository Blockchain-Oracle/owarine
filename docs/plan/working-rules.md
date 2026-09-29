# Working rules

The prediction market ported from Agari (Solana, `661a24ee`) to Canton and Daml, as a web app and an iOS app, for HackCanton Season 3 (Track 2). The reference is the minimum baseline. Standing rules live here and nowhere else; handoffs and lane briefs never restate them (D-113 records a rule lost because a handoff said the opposite).

## Read order (every session, before editing)

1. This file (`docs/plan/working-rules.md`).
2. `docs/plan/STATUS.md`: the single resume pointer. **Never trust memory over STATUS.md.**
3. The current stage file `docs/plan/stage-NN-*.md`: first unchecked box, then `## Handoff`.
4. The last 10 `K-` entries in `docs/plan/decisions.md`, and its `## Open questions`.
5. Only the `docs/plan/00-plan.md` sections the stage names, then the stage's "Open first" sources.
6. Run `git status && git log --oneline -5`, confirm HEAD matches STATUS, and run the fast gate.

## Rules

- **Scope and the deadline** (Abu's standing rule, D-113, 2026-09-20; restated for this repo 2026-09-29): the deadline is never a reason for anything and is never raised. Never cut, hide, defer or thin a feature; never take a page out of the nav instead of building it; never tell Abu something does not fit or ask which features to drop. Every planned feature is built in full, with its full gate, to the same quality as the rest. When a list has unbuilt features, start the next one. Order work by dependency and run it in parallel lanes.
- **Fidelity:** the reference is the minimum baseline. Authority order: Abu's latest statement → fork code (web, mobile) → Masayume where Stocklana dropped a layer → Yosuku → documents. Exclusions exist only as dated owner decisions (`parity.md`, `decisions.md`).
- **Package manager:** pnpm only (`pnpm add`, `pnpm dlx`); no npm/npx/yarn/bun lockfiles.
- **File size:** at most 400 lines (TS/TSX/CSS/MJS/`.daml`), target 300. The `file-length` invariant covers `.daml`. Exempt in `docs/plan/`: `00-plan.md`, `parity.md`, `capabilities.json`.
- **Pure core:** `packages/core` stays pure: no I/O, no ledger, no network.
- **Tests:** not a deliverable. Targeted tests are written where money, settlement or privacy correctness is in doubt: the Daml money gate, the TS-pricer vs `prepare` differential, seat hygiene, the drop-a-response proxy, `seat.ts` signing parity, and the reference's existing vitest suites kept green.
- **Libraries:** read a library's docs before using it and follow its recommended patterns; reading the docs is the review. Context7 first. When the Context7 quota is out, read the same library's official docs directly (WebFetch or Firecrawl) and cite them. Canton sources are local: `context/03-sdks-tools/json-ledger-api-v2.md`, the node's `GET /docs/openapi`, `refs/official`. Performance is designed in, not tuned afterwards.
- **Change boundary:**
  - Only `packages/ledger` (and the ledger halves `@…/markets/server` and `@…/markets/ops` built on it) talks to the JSON Ledger API or sends commands. `write-boundary` bans `/v2/commands`, `execute` and `actAs` outside the ledger packages; `ledger-import-boundary` replaces `kit-import-boundary`.
  - Every ledger or OAuth module in `web/` starts with `import 'server-only'` (`web/src/lib/ledger.server.ts`). No ledger credential reaches a browser or the phone, ever.
  - A route derives the acting party **only** from the seat row its cookie (web) or signed seat header (iOS) names, never from body or query (`no-party-from-request`). Infrastructure party ids live in a module `web/` may not import. Quote issuance goes web → ops over HMAC.
  - Web never imports from `mobile/` (D-129). A web split that moves a file in `mobile/metro.config.js`'s shim map changes the shim map in the same commit.
  - Only the stage owner edits manifests, the lockfile, `packages/core/src/ports/**`, `packages/markets/src/{env,index}.ts`, `packages/ledger/src/{auth,env}.ts`, Daml version fields, `web/src/providers/**`, `services/ops/src/main.ts`, `scripts/invariants/**`, `.env*` and `docs/plan/**`.
- **Money:** integers end to end, including in Daml (`Int`): price in ticks 1–999, size in lots, `cashUnit`; `userStake = lots × ticks × cashUnit`, `venueStake = lots × (1000 − ticks) × cashUnit`. Fee is an integer ceiling computed once in the pricer and carried as a quote field. `Decimal` appears only at the CIP-56 edge (C7b). Strings ↔ bigint only in `packages/ledger/src/units.ts`, never `Number`; `no-float-money` covers it.
- **Secrets:** never print or commit them. Nothing secret is `NEXT_PUBLIC_*`. The Noders platform credential is server-only, unique to this login, and rotated after judging. Seat seeds live in the Keychain (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`) or as non-extractable browser keys, never in the repo or a log.
- **CLI and toolchain:** a fresh zsh has no `dpm` on PATH, no JVM and Homebrew Node 26.7.0 as default (measured 2026-09-29). Every shell that builds Daml adds `~/.dpm/bin` to PATH and sets `JAVA_HOME` to openjdk@21. `mobile/` runs under `nvm use 25.9.0`. The local sandbox comes from the dpm 3.5.10 assembly (Canton 3.5.17); `daml.yaml` pins `sdk-version: 3.5.2` (LF 2.2). No contract keys. A toolchain check script does all of this (a C0 step, not yet written).
- **Network:** all building and testing runs on the local Canton sandbox first (K-009). **DevNet (Noders, Canton 3.5.18) is single-writer:** only the stage owner sends commands there. **Parties are a fixed set** created in the Noders Console; the budget and its final split are in `00-plan.md` ("Seats") and recorded as a decision after onboarding. Never create parties or upload DARs by API on Noders.
- **DAR releases:** package names are shared across the whole participant, and the same name and version with different content is rejected, so every upload bumps `daml.yaml`'s version. The spike is never uploaded. Every DAR release (R1, R2 …) runs `dpm upgrade-check` against the last DAR in `daml/released/` and **ends "needs Abu"**: the Console upload is his.
- **UX:** the reference is the authority for everything it already has (D-036/D-081); drift is fixed, not waived, and byte-identical reference values are never "inconsistency". For a new surface: reuse the reference kit first (`components/ui`, `components/ui/desk-kit`, `components/states`, the phone's `features/desk/kit`), then 21st: `21st search "<need>" --context auto` → `21st get <id>` → adapt into `tokens.css`/`theme.css` (no raw hex or px; `design-literals`), every state wired, a `/dev/<surface>` fixture, then a literal React Native port (`mobile-design-literals`). A change to a reference-authority surface (the ticket, chrome, cards, portfolio) follows D-081: 2–3 directions at `/dev/<surface>`, Abu chooses, the choice is recorded before the surface changes. Real brand logos wherever a brand is named. At every gate, `21st review <changed paths>`; only deterministic fixes are applied, subjective ones go to Abu as a list.
- **Hosting facts:** never write Cloudflare hosting facts into this product's docs or config. This product uses no Cloudflare (K-003); `TRUSTED_PROXY=forwarded`.
- **Docs consistency:** the `docs-consistency` invariant fails the fast gate if any file under `docs/plan/` contains one of four phrases. They are written here with a middle dot so this file does not trip the check: "will·not·fit", "de·scope", "time·permitting", "if·time·allows". Never write them.
- **Honest state:** a capability shows live only when its gate has passed and its acceptance row exists (`capabilities.json`). Until then its route renders the D-015 state naming the gate it waits on.
- **Commits:** one per step, `<type>(C<n><lane>.<step>/<area>): <summary>` (for example `feat(C1c.3/seat): lease a seat on click`), trailers `Stage:` and `Parity:`, then the attribution trailer. Tick the stage checkbox in the same commit. Never end a session dirty (`wip(C<n><lane>.<step>): …`). Gate commit `docs(plan): C<n> gate passed` moves "last green". Commit only when Abu asks.
- **Evidence:** every command sent to Noders gets a row in `docs/plan/acceptance.md`, failures included, with its trace id or update id. `parity.md` advances only at stage gates.

## Gates

- **Fast:** `pnpm typecheck && pnpm invariants`
- **Web:** `pnpm build` (only in the owner's and the `live` worktree)
- **Daml:** `cd daml && dpm build --all && (cd pm-tests && dpm test)`
- **Release:** `dpm upgrade-check` against the last DAR in `daml/released/`
- **Mobile:** `pnpm --filter @agari/mobile typecheck`; `expo export` for iOS and Android at stage gates

`main` is the trunk from day one. Checks that need Abu are separate "owner check" boxes that never block a merge.
