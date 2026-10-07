# Owarine 終値

**Call the close.** Owarine (終値, "closing price") is a prediction market on **Canton and Daml**, on the web and as a native phone app: Up/Down calls on short price Windows for stocks and crypto, with games, agents and desks. Every position is a contract signed by its owner and the venue, so no one else's node ever receives it. Entered in HackCanton League Season 3, Track 2 (Financial Applications).

## Status

- **On Noders DevNet:** five Daml packages uploaded and vetted, the venue bootstrapped, and the first call passed on 6 Oct from four viewpoints: a seat took a firm quote and accepted it, the owner saw its position, an outsider's query returned nothing, three oracles attested, the resolver settled it, a void refunded stake and fee, and a stale refund worked with the venue's operations stopped. Every command is logged, failures included, in [`docs/plan/acceptance.md`](docs/plan/acceptance.md).
- **Daml:** `abu-pm-main`, `abu-pm-tickets`, `abu-pm-agents`, `abu-pm-games` and the Canton Coin rail `abu-pm-cc`, with the `pm-tests` Daml Script suite, all written in the window. `daml/released/` holds the uploaded files; `dpm build --all` reproduces them byte for byte.
- **Phone:** the iPhone app runs end to end on the iOS Simulator against a local stack; TestFlight and an Android build come next.
- **Capabilities:** [`docs/plan/capabilities.json`](docs/plan/capabilities.json) records each one's state and evidence; the `capabilities-evidence` invariant fails anything marked live without its DevNet row.

[`docs/plan/STATUS.md`](docs/plan/STATUS.md) has the numbers by stage; the plan starts at [`docs/plan/00-plan.md`](docs/plan/00-plan.md).

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
#    ticket reserves, arena and a guest-seat pool; writes ~/.config/owarine/canton/parties.json.
#    It refuses anything but an unauthenticated local sandbox.
LEDGER_JSON_API_URL=http://127.0.0.1:7575 LEDGER_AUTH_MODE=none \
  pnpm --filter @owarine/scripts exec tsx bootstrap-local.ts --seats 6

# 4. Environment: copy the examples and fill them in (DATABASE_URL, OPS_INTERNAL_SECRET,
#    OWARINE_SEAT_COOKIE_SECRET, OWARINE_PARTIES_FILE, LEDGER_JSON_API_URL=http://127.0.0.1:7575, LEDGER_AUTH_MODE=none)
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

**Prior work.** Owarine was called Agari before 7 Oct. Commit `6f3f3cf`, tagged **`hackcanton-s3-start`**, imports Agari, Abu's prediction market on Solana (web, native iOS app, packages, ops, docs site) at `661a24ee`, without its Solana programs. Agari's own commits of 14–27 Sep were made for a separate Solana hackathon and count as prior work here. Lineage: [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) and [`docs/plan/references.md`](docs/plan/references.md).

**Built in the window.** Everything after the tag:
- the five Daml packages and their Daml Script tests (`daml/`, all new);
- the JSON Ledger API v2 client (`packages/ledger`);
- the Canton adapter behind `@owarine/markets`;
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
