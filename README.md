# HackCanton Season 3 — a prediction market on Canton (working name)

A port of Abu's prediction market, web and iOS, from Solana to **Canton and Daml**, entered in HackCanton League Season 3, Track 2 (Financial Applications). The plan: Up/Down calls on short price windows for stocks and crypto, with games, agents and desks, designed so that each position is visible only to its owner and the venue. The core loop (take a seat, make a call, settle on a signed price, get paid) runs end to end on a local Canton sandbox; DevNet and a hosted URL come next.

The product name is not chosen yet; the code still carries the reference's identity until the rename step.

## Status

Everything proven so far runs on a **local Canton sandbox** (Canton 3.5.17, dpm 3.5.10). Nothing is on Noders DevNet yet and there is no hosted URL. The native iPhone app has not run against Canton: it typechecks only.

- **Daml:** four packages (`abu-pm-main`, `abu-pm-tickets`, `abu-pm-agents`, `abu-pm-games`) and the `pm-tests` Daml Script suite, all written in the window.
- **Capabilities:** in [`docs/plan/capabilities.json`](docs/plan/capabilities.json), 49 of 221 are `local` (each cites its evidence note in [`docs/evidence/`](docs/evidence/)) and none is `live`. A capability becomes `live` only when its DevNet acceptance row exists; the `capabilities-evidence` invariant enforces that.
- **Waiting on Abu:** Noders onboarding (DevNet), the App Store Connect record (iOS), the domain (hosting).

Where a surface is not connected yet, the app says so ("Not connected yet · waiting on …") instead of showing invented data. [`docs/plan/STATUS.md`](docs/plan/STATUS.md) has the numbers by stage and what is in flight; the plan starts at [`docs/plan/00-plan.md`](docs/plan/00-plan.md).

## Run it locally

The same steps the evidence runs in [`docs/evidence/`](docs/evidence/) used (for example `c9d-seats-games.md`). Needs Node 22+, pnpm, dpm (Canton 3.5) and a Postgres database.

```sh
pnpm install

# 1. Build the Daml packages, and optionally run the Daml tests
(cd daml && dpm build --all)
(cd daml/pm-tests && dpm test)

# 2. A local Canton sandbox with the JSON Ledger API on :7575 (leave it running)
dpm sandbox --json-api-port 7575

# 3. Bootstrap it: upload the DARs, allocate the venue parties, create the Series, cash shards,
#    ticket reserves, arena and a guest-seat pool; writes ~/.config/agari/canton/parties.json.
#    It refuses anything but an unauthenticated local sandbox.
LEDGER_JSON_API_URL=http://127.0.0.1:7575 LEDGER_AUTH_MODE=none \
  pnpm --filter @agari/scripts exec tsx bootstrap-local.ts --seats 6

# 4. Environment: copy the examples and fill them in (DATABASE_URL, OPS_INTERNAL_SECRET,
#    AGARI_SEAT_COOKIE_SECRET, AGARI_PARTIES_FILE, LEDGER_JSON_API_URL=http://127.0.0.1:7575, LEDGER_AUTH_MODE=none)
cp .env.example .env.local
cp services/ops/.env.example services/ops/.env.local
cp web/.env.example web/.env.local

# 5. The venue's operations (roller, oracle feeders, pricer, resolver, settler, projector, seat pool)
pnpm ops:start

# 6. The web app, on http://localhost:3000
pnpm dev
```

Then open `/markets`, take a guest seat (the browser makes its key; the venue leases it a Canton party with demo credits) and make a call. Stock lanes quote only while US markets trade and need the Alpaca keys in `services/ops/.env.local`; the crypto lanes (Coinbase, Kraken and Bitstamp candles) run around the clock. The fast gate is `pnpm typecheck && pnpm invariants && pnpm test`.

## Prior work (Agari, Solana) vs built 18 Sep – 9 Oct (Canton)

The Rules: "Work submitted for judging must be done during the delivery phase, September 18 – October 9, 2026. You may build on a pre-existing codebase, but you must disclose it, and the work done during the hackathon must be clearly identifiable. Judges evaluate only that work."

**Prior work.** Commit `6f3f3cf`, tagged **`hackcanton-s3-start`**, imports Agari, Abu's prediction market on Solana (web, native iOS app, packages, ops, docs site) at `661a24ee`, without its Solana programs. Agari's own commits of 14–27 Sep were made for a separate Solana hackathon and count as prior work here. Lineage: [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) and [`docs/plan/references.md`](docs/plan/references.md).

**Built in the window.** Everything after the tag:
- the four Daml packages and their Daml Script tests (`daml/`, all new);
- the JSON Ledger API v2 client (`packages/ledger`);
- the Canton adapter behind `@agari/markets`;
- the venue operations (`services/ops`);
- the seat, privacy-view, proof and receipt surfaces on the web.

```sh
git log --oneline hackcanton-s3-start..submission
git diff --shortstat hackcanton-s3-start..submission
#  2339 files changed, 86252 insertions(+), 162843 deletions(-)   (at f6ac105, 30 Sep; update at submission)
```

Until the `submission` tag exists, use `HEAD` in its place. Most of the deletions are Solana-generated clients (`packages/clients`, −121,874 lines). Full disclosure: [`docs/business/prior-work-disclosure.md`](docs/business/prior-work-disclosure.md).

## Layout

`web/` (Next.js) and `mobile/` (Expo) apps · `packages/` shared code · `services/ops/` venue operations · `daml/` the Daml packages and their tests · `docs-site/` guides · `docs/plan/` the plan and its evidence.

## Licence

See [`LICENSE`](LICENSE) and [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
